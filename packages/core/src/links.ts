// Link previews ("unfurling"), like the cards WhatsApp shows when you paste a link.
//
// Videos and images are recognised from the link itself, with no network call.
// Other pages need their title and image read from the page's HTML. Browsers
// can't read other sites directly (CORS), so we ask a metadata service:
//   - noembed.com for YouTube / Vimeo titles
//   - microlink.io for everything else (free tier, about 50 links a day)
// To use your own server instead, set VITE_UNFURL_ENDPOINT to a URL that
// returns the same shape as microlink, e.g. https://your.app/api/unfurl?url=

export type EmbedKind = "youtube" | "vimeo" | "loom" | "video" | "image" | "link";

export interface EmbedMeta {
  url: string;
  kind: EmbedKind;
  title: string;
  description: string;
  image: string;
  siteName: string;
  favicon: string;
  embedUrl: string;
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

/** True when pasted text is a single web address, with or without https://. */
export function isLikelyUrl(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t) || t.length > 2048) return false;
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(t);
}

export function normalizeUrl(text: string): string {
  const t = text.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/);
    if (m) return m[2];
  }
  return null;
}

/** Work out what kind of link this is from the address alone. */
export function classify(url: string): EmbedMeta {
  const base: EmbedMeta = {
    url,
    kind: "link",
    title: "",
    description: "",
    image: "",
    siteName: hostOf(url),
    favicon: "",
    embedUrl: "",
  };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return base;
  }
  const file = decodeURIComponent(u.pathname.split("/").pop() || "");

  if (IMAGE_RE.test(u.pathname)) return { ...base, kind: "image", image: url, title: file };
  if (VIDEO_RE.test(u.pathname)) return { ...base, kind: "video", embedUrl: url, title: file };

  const yt = youtubeId(u);
  if (yt) {
    const start = u.searchParams.get("t") ?? u.searchParams.get("start");
    const startSec = start ? parseInt(start, 10) : 0;
    return {
      ...base,
      kind: "youtube",
      siteName: "YouTube",
      image: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0${startSec ? `&start=${startSec}` : ""}`,
    };
  }

  const vimeo = u.hostname.endsWith("vimeo.com") && u.pathname.match(/\/(\d{5,})/);
  if (vimeo) {
    return { ...base, kind: "vimeo", siteName: "Vimeo", embedUrl: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };
  }

  const loom = u.hostname.endsWith("loom.com") && u.pathname.match(/\/(share|embed)\/([\w-]+)/);
  if (loom) {
    return { ...base, kind: "loom", siteName: "Loom", embedUrl: `https://www.loom.com/embed/${loom[2]}?autoplay=1` };
  }

  return base;
}

async function getJson(url: string, ms = 8000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const DEFAULT_ENDPOINT = "https://api.microlink.io/?url=";
let ENDPOINT = DEFAULT_ENDPOINT;

/**
 * Point link previews at your own server. It must answer like microlink:
 * { data: { title, description, publisher, image: { url }, logo: { url } } }.
 * The link is appended URL-encoded, so end the address with `?url=`.
 */
export function setUnfurlEndpoint(endpoint: string | undefined | null) {
  ENDPOINT = endpoint?.trim() || DEFAULT_ENDPOINT;
}

/** Fill in title, description and image. Never throws: on failure the card shows the site's address. */
export async function unfurl(rawUrl: string): Promise<EmbedMeta> {
  const meta = classify(rawUrl);
  if (meta.kind === "image" || meta.kind === "video") return meta;

  try {
    if (meta.kind === "youtube" || meta.kind === "vimeo") {
      const j = await getJson(`https://noembed.com/embed?url=${encodeURIComponent(rawUrl)}`);
      if (!j.error) {
        return {
          ...meta,
          title: j.title || meta.title,
          description: j.author_name ? `${j.author_name}` : "",
          image: meta.image || j.thumbnail_url || "",
        };
      }
    }
    const j = await getJson(`${ENDPOINT}${encodeURIComponent(rawUrl)}`);
    const d = j?.data ?? j ?? {};
    return {
      ...meta,
      title: d.title || meta.title,
      description: d.description || "",
      image: meta.image || d.image?.url || (typeof d.image === "string" ? d.image : "") || "",
      siteName: meta.kind === "link" ? d.publisher || meta.siteName : meta.siteName,
      favicon: d.logo?.url || (typeof d.logo === "string" ? d.logo : "") || "",
    };
  } catch {
    return meta;
  }
}

/**
 * Block props for an embed. The address is stored as `link`, not `url`:
 * BlockNote treats any block with a `url` prop as a file and shows its file toolbar.
 */
export function toEmbedProps(meta: EmbedMeta, status: "loading" | "ready") {
  const { url, ...rest } = meta;
  return { ...rest, link: url, status };
}
