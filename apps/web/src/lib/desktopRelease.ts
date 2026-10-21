// Dovli for Mac and Windows is released on GitHub (see apps/desktop/README.md → Releasing). The
// download page and the landing page read the newest published release from there, so a new
// version shows up on the site without a deploy. No release yet: they say "coming soon".

export const DESKTOP_REPO = "MayankJha0333/dovli";

export interface DesktopFile {
  name: string;
  url: string;
  /** Bytes. */
  size: number;
}

export interface DesktopRelease {
  version: string;
  publishedAt: string;
  /** The release on GitHub, with its notes. */
  notesUrl: string;
  /** The universal disk image (Apple silicon and Intel). */
  mac: DesktopFile | null;
  /** One installer for every Windows PC (64-bit Intel/AMD and Arm). */
  windows: DesktopFile | null;
}

export type DesktopOs = "mac" | "windows" | "other";

interface GitHubAsset {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
}

const file = (a: GitHubAsset | undefined): DesktopFile | null =>
  a && typeof a.name === "string" && typeof a.browser_download_url === "string" && typeof a.size === "number"
    ? { name: a.name, url: a.browser_download_url, size: a.size }
    : null;

/** GitHub's "latest release" answer, as what the site needs. Anything unexpected means no release. */
export function parseRelease(raw: unknown): DesktopRelease | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { tag_name?: unknown; draft?: unknown; prerelease?: unknown; published_at?: unknown; html_url?: unknown; assets?: unknown };
  if (r.draft || r.prerelease || typeof r.tag_name !== "string" || !Array.isArray(r.assets)) return null;
  const version = r.tag_name.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  const assets = r.assets as GitHubAsset[];
  const named = (re: RegExp) => file(assets.find((a) => typeof a.name === "string" && re.test(a.name)));
  const release: DesktopRelease = {
    version,
    publishedAt: typeof r.published_at === "string" ? r.published_at : "",
    notesUrl: typeof r.html_url === "string" ? r.html_url : `https://github.com/${DESKTOP_REPO}/releases`,
    mac: named(/-mac-universal\.dmg$/i) ?? named(/\.dmg$/i),
    windows: named(/-win-setup\.exe$/i) ?? named(/\.exe$/i),
  };
  return release.mac || release.windows ? release : null;
}

/** Which installer to offer first, from the browser's own description of the computer. */
export function detectOs(userAgent: string, platform = ""): DesktopOs {
  const s = `${platform} ${userAgent}`;
  if (/iPhone|iPad|iPod|Android/i.test(s)) return "other";
  if (/Mac/i.test(s)) return "mac";
  if (/Win/i.test(s)) return "windows";
  return "other";
}

/** "214 MB". */
export function formatSize(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}
