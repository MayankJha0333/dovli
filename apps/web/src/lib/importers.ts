// Reading other apps' exports as plain HTML the editor's parser understands: Evernote (.enex),
// Confluence (HTML space export), OneNote and Word web archives (.mht), and any web page.
// Storing files and making pages happens in ./transfer.

export const parseHtml = (html: string) =>
  new DOMParser().parseFromString(/<(html|body)[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`, "text/html");

const LINE = "p,h1,h2,h3,h4,h5,h6";
const MEDIA = "img,embed,audio,video";

/** Pictures and files inside a line of text would be dropped: each moves out to just after its line. */
export function hoistMedia(root: ParentNode) {
  const last = new Map<Element, Element>();
  for (const el of [...root.querySelectorAll(MEDIA)]) {
    const line = el.parentElement?.closest(LINE);
    if (!line) continue;
    (last.get(line) ?? line).after(el);
    last.set(line, el);
  }
}

/** Removes what is never content, then hoists media. */
export function tidy(root: ParentNode) {
  for (const el of [...root.querySelectorAll("script,style,noscript,template,meta,link,title")]) el.remove();
  hoistMedia(root);
}

const CALLOUT = /^\s*\[!(\w+)\]\s*/;
const TONES: Record<string, string> = { note: "note", info: "note", information: "note", tip: "tip", success: "tip", warning: "warning", caution: "warning", danger: "danger", important: "danger", error: "danger" };

/**
 * A callout as a quote starting with [!TONE], which the editor's parser keeps; `finishBlocks` turns it back
 * into a callout. A callout holds one line of text, so its paragraphs become line breaks.
 */
export function calloutHtml(tone: string, inner: string) {
  const text = inner
    .replace(/<\/(p|div|h\d|li)>\s*<(p|div|h\d|li)\b[^>]*>/gi, "<br>")
    .replace(/<\/?(p|div|h\d|ul|ol|li)\b[^>]*>/gi, "")
    .replace(/(\s*<br\s*\/?>\s*)+$/i, "")
    .trim();
  return `<blockquote><p>[!${tone.toUpperCase()}] ${text}</p></blockquote>`;
}

/**
 * Last touches on parsed blocks: quotes that start with [!TIP] (Obsidian, GitHub and Craft write callouts
 * like that, and so do the importers here) become callouts; files get their names back, and PDFs open as PDFs.
 */
export function finishBlocks(blocks: any[], names: Map<string, string> = new Map()): any[] {
  return (blocks ?? []).map((b) => {
    const children = finishBlocks(b.children ?? [], names);
    const first = Array.isArray(b.content) ? b.content[0] : null;
    const m = b.type === "quote" && first?.type === "text" ? CALLOUT.exec(first.text) : null;
    if (m && TONES[m[1].toLowerCase()]) {
      const rest = first.text.slice(m[0].length);
      const content = rest ? [{ ...first, text: rest }, ...b.content.slice(1)] : b.content.slice(1);
      return { ...b, type: "callout", props: { tone: TONES[m[1].toLowerCase()], emoji: "" }, content, children };
    }
    if (b.type === "file" && b.props?.url) {
      const name = b.props.name || names.get(b.props.url) || "";
      if (/\.pdf$/i.test(name)) return { id: b.id, type: "pdf", props: { url: b.props.url, name }, children };
      return { ...b, props: { ...b.props, name }, children };
    }
    return { ...b, children };
  });
}

/** XML text with its escapes undone. */
export function xmlText(s: string) {
  return s
    .replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/[^A-Za-z0-9+/=]/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ */
/* Evernote                                                            */
/* ------------------------------------------------------------------ */

const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

/** MD5 as hex. Evernote points at each picture in a note by the MD5 of its bytes. */
export function md5(bytes: Uint8Array): string {
  const n = bytes.length;
  const w = new Uint32Array((((n + 8) >>> 6) + 1) * 16);
  for (let i = 0; i < n; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[n >> 2] |= 0x80 << ((n % 4) * 8);
  w[w.length - 2] = (n * 8) >>> 0;
  w[w.length - 1] = Math.floor(n / 0x20000000);
  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let j = 0; j < w.length; j += 16) {
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      const r = i >> 4;
      const f = r === 0 ? (b & c) | (~b & d) : r === 1 ? (d & b) | (~d & c) : r === 2 ? b ^ c ^ d : c ^ (b | ~d);
      const g = r === 0 ? i : r === 1 ? (5 * i + 1) % 16 : r === 2 ? (3 * i + 5) % 16 : (7 * i) % 16;
      const x = (a + f + K[i] + w[j + g]) | 0;
      const s = S[r * 4 + (i % 4)];
      [a, d, c] = [d, c, b];
      b = (b + ((x << s) | (x >>> (32 - s)))) | 0;
    }
    [a0, b0, c0, d0] = [(a0 + a) | 0, (b0 + b) | 0, (c0 + c) | 0, (d0 + d) | 0];
  }
  return [a0, b0, c0, d0].map((v) => [0, 8, 16, 24].map((s) => ((v >>> s) & 255).toString(16).padStart(2, "0")).join("")).join("");
}

export interface EnexResource {
  hash: string;
  mime: string;
  name: string;
  bytes: Uint8Array;
}

export interface EnexNote {
  title: string;
  /** The note as HTML. Pictures and files point at `enex:<hash>`, a resource's hash. */
  html: string;
  created?: number;
  tags: string[];
  resources: EnexResource[];
}

const tagText = (xml: string, tag: string) => {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? xmlText(m[1]) : "";
};

/** Evernote's 20240131T093000Z. */
const enexDate = (s: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s.trim());
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : undefined;
};

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "application/pdf": "pdf", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a", "video/mp4": "mp4" };

/** The notes in an Evernote export (.enex). Read with patterns, not an XML parser, as exports can be very large. */
export function parseEnex(xml: string): EnexNote[] {
  const notes: EnexNote[] = [];
  for (const [, note] of xml.matchAll(/<note>([\s\S]*?)<\/note>/g)) {
    const resources: EnexResource[] = [];
    for (const [, res] of note.matchAll(/<resource>([\s\S]*?)<\/resource>/g)) {
      const data = /<data[^>]*>([\s\S]*?)<\/data>/.exec(res)?.[1];
      if (!data) continue;
      const bytes = base64Bytes(data);
      const mime = tagText(res, "mime") || "application/octet-stream";
      resources.push({ hash: md5(bytes), mime, name: tagText(res, "file-name") || `attachment.${EXT[mime] ?? "bin"}`, bytes });
    }
    notes.push({
      title: tagText(note, "title").trim() || "Untitled",
      html: enmlToHtml(tagText(note.replace(/<resource>[\s\S]*?<\/resource>/g, ""), "content")),
      created: enexDate(tagText(note, "created")),
      tags: [...note.matchAll(/<tag>([\s\S]*?)<\/tag>/g)].map((m) => xmlText(m[1]).trim()).filter(Boolean),
      resources,
    });
  }
  return notes;
}

/** A code block's text. Each line is usually its own <div>; older notes put <br> between lines instead. */
function codeText(el: Element): string {
  const divs = [...el.children].filter((c) => c.tagName === "DIV");
  if (divs.length) return divs.map(codeText).join("\n");
  return [...el.childNodes].map((n) => (n.nodeName === "BR" ? "\n" : (n.textContent ?? ""))).join("");
}

/** A note's ENML as HTML: to-dos, code blocks and pictures in shapes the editor reads. */
export function enmlToHtml(enml: string): string {
  const src = enml
    .replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/gi, "")
    // HTML parsing doesn't know <en-media/> closes itself, and would put everything after it inside.
    .replace(/<(en-[\w-]+)([^>]*?)\/>/g, "<$1$2></$1>")
    .replace(/<\/?en-note\b[^>]*>/g, "");
  const doc = parseHtml(src);
  const body = doc.body;

  for (const el of [...body.querySelectorAll("en-media")]) {
    const type = el.getAttribute("type") ?? "";
    const tag = type.startsWith("image/") ? "img" : type.startsWith("audio/") ? "audio" : type.startsWith("video/") ? "video" : "embed";
    const media = doc.createElement(tag);
    media.setAttribute("src", `enex:${el.getAttribute("hash") ?? ""}`);
    el.replaceWith(media);
  }
  for (const el of [...body.querySelectorAll("en-crypt")]) {
    const p = doc.createElement("p");
    p.innerHTML = "<em>Encrypted text (not imported)</em>";
    el.replaceWith(p);
  }

  // Older notes: <div><en-todo checked="true"></en-todo>Buy milk</div>.
  for (const todo of [...body.querySelectorAll("en-todo")]) {
    const box = doc.createElement("input");
    box.setAttribute("type", "checkbox");
    if (todo.getAttribute("checked") === "true") box.setAttribute("checked", "");
    const line = todo.parentElement;
    if (!line || line === body || line.tagName === "LI") {
      todo.replaceWith(box);
      continue;
    }
    todo.remove();
    const li = doc.createElement("li");
    li.append(box, ...line.childNodes);
    const ul = doc.createElement("ul");
    ul.append(li);
    line.replaceWith(ul);
  }
  // Newer notes: <ul style="--en-todo:true"><li style="--en-checked:true">.
  for (const ul of [...body.querySelectorAll("ul")].filter((u) => /--en-todo\s*:\s*true/.test(u.getAttribute("style") ?? ""))) {
    for (const li of [...ul.children].filter((c) => c.tagName === "LI")) {
      if (li.querySelector(":scope > input")) continue;
      const box = doc.createElement("input");
      box.setAttribute("type", "checkbox");
      if (/--en-checked\s*:\s*true/.test(li.getAttribute("style") ?? "")) box.setAttribute("checked", "");
      li.prepend(box);
    }
  }
  for (const el of [...body.querySelectorAll("div")].filter((d) => /-en-codeblock\s*:\s*true/.test(d.getAttribute("style") ?? ""))) {
    const pre = doc.createElement("pre");
    const code = doc.createElement("code");
    code.textContent = codeText(el);
    pre.append(code);
    el.replaceWith(pre);
  }
  // Evernote writes empty lines as <div><br></div>.
  for (const d of [...body.querySelectorAll("div")]) if (!d.textContent?.trim() && !d.querySelector(MEDIA) && [...d.children].every((c) => c.tagName === "BR")) d.remove();
  return body.innerHTML;
}

/* ------------------------------------------------------------------ */
/* Confluence                                                          */
/* ------------------------------------------------------------------ */

export const isConfluencePage = (html: string) => /id=["']main-content["']/.test(html) && /confluence/i.test(html);

/**
 * The page tree from a Confluence export's index.html ("Available Pages"): each page file with its
 * parent's file (null at the top), in the space's own order.
 */
export function confluenceTree(indexHtml: string): Map<string, string | null> {
  const tree = new Map<string, string | null>();
  const linkOf = (li: Element | null | undefined) => [...(li?.children ?? [])].find((c) => c.tagName === "A")?.getAttribute("href") ?? null;
  for (const li of parseHtml(indexHtml).querySelectorAll("li")) {
    const href = linkOf(li);
    if (!href || !/\.html$/i.test(href) || /(^|\/)index\.html$/i.test(href) || tree.has(href)) continue;
    tree.set(href, linkOf(li.parentElement?.closest("li")));
  }
  return tree;
}

const CONFLUENCE_TONES: Record<string, string> = { information: "note", info: "note", tip: "tip", note: "warning", warning: "danger" };

/** One page of a Confluence HTML export: its title, its parent page file (from the breadcrumbs), and its body. */
export function confluencePage(html: string): { title: string; parent: string | null; body: string } {
  const doc = parseHtml(html);
  const crumbs = [...doc.querySelectorAll("#breadcrumbs a")].map((a) => ({ href: a.getAttribute("href") ?? "", text: a.textContent?.trim() ?? "" }));
  const space = crumbs[0]?.text ?? "";
  let title = (doc.querySelector("#title-text")?.textContent ?? doc.title ?? "").replace(/\s+/g, " ").trim();
  if (space && title.startsWith(`${space} : `)) title = title.slice(space.length + 3);
  const parent = [...crumbs].reverse().find((c) => c.href && !/(^|\/)index\.html$/i.test(c.href))?.href ?? null;

  const main = doc.querySelector("#main-content") ?? doc.body;
  for (const el of [...main.querySelectorAll(".page-metadata,.pageSection,#comments-section,.confluence-anchor-link,.toc-macro,.expand-control-icon,.aui-icon")]) el.remove();
  for (const el of [...main.querySelectorAll("img.emoticon")]) el.replaceWith(el.getAttribute("data-emoji-fallback") ?? "");

  for (const box of [...main.querySelectorAll(".confluence-information-macro")]) {
    const kind = /confluence-information-macro-(information|info|tip|note|warning)\b/.exec(box.className)?.[1] ?? "information";
    const body = box.querySelector(".confluence-information-macro-body") ?? box;
    const heading = box.querySelector(".title")?.textContent?.trim();
    const wrap = doc.createElement("div");
    wrap.innerHTML = calloutHtml(CONFLUENCE_TONES[kind], `${heading ? `<strong>${heading}</strong><br>` : ""}${body.innerHTML}`);
    box.replaceWith(...wrap.childNodes);
  }
  for (const pre of [...main.querySelectorAll("pre")]) {
    const lang = /brush:\s*([\w+#-]+)/.exec(pre.getAttribute("data-syntaxhighlighter-params") ?? "")?.[1];
    const code = doc.createElement("code");
    if (lang && lang !== "plain" && lang !== "text") code.className = `language-${lang}`;
    code.textContent = pre.textContent ?? "";
    pre.replaceChildren(code);
    // Code sits in a panel with its own header; keep just the code.
    pre.closest(".code.panel")?.replaceWith(pre);
  }
  for (const li of [...main.querySelectorAll("ul.inline-task-list > li")]) {
    const box = doc.createElement("input");
    box.setAttribute("type", "checkbox");
    if (li.classList.contains("checked")) box.setAttribute("checked", "");
    li.prepend(box);
  }
  for (const ex of [...main.querySelectorAll(".expand-container")]) {
    const details = doc.createElement("details");
    const summary = doc.createElement("summary");
    summary.textContent = ex.querySelector(".expand-control-text")?.textContent?.trim() || "Details";
    details.append(summary, ...(ex.querySelector(".expand-content")?.childNodes ?? []));
    ex.replaceWith(details);
  }
  return { title: title || "Untitled", parent, body: main.innerHTML };
}

/* ------------------------------------------------------------------ */
/* Web archives (.mht): OneNote and Word "Single File Web Page"        */
/* ------------------------------------------------------------------ */

export interface MhtPart {
  type: string;
  location: string;
  cid: string;
  bytes: Uint8Array;
}

/** Bytes as a string of the same char codes (0–255), so base64 and quoted-printable can be decoded exactly. */
function binary(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
}

function headers(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}

function decodeBody(body: string, encoding: string): Uint8Array {
  if (/base64/i.test(encoding)) return base64Bytes(body);
  const raw = /quoted-printable/i.test(encoding) ? body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))) : body;
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) & 255;
  return out;
}

const charsetOf = (type: string) => /charset="?([\w-]+)"?/i.exec(type)?.[1] ?? "utf-8";

function decodeText(bytes: Uint8Array, charset: string) {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

/** A web archive's page and the files it uses. `generator` names the app that made it ("Microsoft OneNote 15"). */
export function parseMht(bytes: Uint8Array): { html: string; location: string; parts: MhtPart[]; generator: string } {
  const text = binary(bytes);
  const split = text.search(/\r?\n\r?\n/);
  const top = headers(text.slice(0, split));
  const boundary = /boundary="?([^";]+)"?/i.exec(top["content-type"] ?? "")?.[1];
  const parts: (MhtPart & { charset: string })[] = [];
  const chunks = boundary ? text.split(`--${boundary}`).slice(1, -1) : [text];
  for (const chunk of chunks) {
    const at = chunk.search(/\r?\n\r?\n/);
    if (at < 0) continue;
    const h = headers(chunk.slice(0, at));
    const type = h["content-type"] ?? "text/html";
    parts.push({
      type: type.split(";")[0].trim().toLowerCase(),
      charset: charsetOf(type),
      location: h["content-location"] ?? "",
      cid: (h["content-id"] ?? "").replace(/[<>]/g, ""),
      bytes: decodeBody(chunk.slice(at).replace(/^\r?\n\r?\n/, "").replace(/\r?\n$/, ""), h["content-transfer-encoding"] ?? ""),
    });
  }
  const page = parts.find((p) => p.type === "text/html");
  const html = page ? decodeText(page.bytes, page.charset) : "";
  const generator = /<meta\s+name=["']?Generator["']?\s+content=["']?([^"'>]+)/i.exec(html)?.[1] ?? "";
  return { html, location: page?.location ?? "", parts: parts.filter((p) => p !== page), generator };
}

/** The part a page's src="…" means: by Content-ID, by full address, or by file name. */
export function mhtPart(parts: MhtPart[], src: string, base: string): MhtPart | undefined {
  if (src.startsWith("cid:")) return parts.find((p) => p.cid === src.slice(4));
  let full = src;
  try {
    full = new URL(src, base || undefined).href;
  } catch {
    /* not an address: compare names */
  }
  const name = (s: string) => decodeURIComponent(s.split(/[\\/]/).pop() ?? "").toLowerCase();
  return parts.find((p) => p.location === src || p.location === full) ?? parts.find((p) => p.location && name(p.location) === name(src));
}
