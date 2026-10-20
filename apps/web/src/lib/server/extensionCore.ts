// What the browser extension's side panel shows of a page, and the Markdown for what it clips (a
// selection, a picture, a link or a bookmark from the website, with tags and a remark). No Next.js
// here, so it's easy to test (extensionCore.test.ts). The route is app/api/extension.

import { blockToMarkdown, displayTitle, extractTags, flattenBlocks, inlineToMarkdown, markdownToBlocks, type Page } from "@dovli/core";
import { getStyle } from "@dovli/theme";
import { htmlToMarkdown, textToMarkdown } from "./webPageCore";

const MAX_BLOCKS = 2000;
// The props the panel draws with; everything else stays on the server.
const PROPS = ["level", "checked", "language", "tone", "emoji", "url", "caption", "name", "link", "title", "siteName", "pageId"];

/** A page for the side panel: its blocks as stored (so it draws them as text, never as HTML), plus each block as Markdown for editing. */
export function pageView(page: Page) {
  const style = getStyle(page.style);
  const all = page.kind === "doc" ? flattenBlocks(page.blocks) : [];
  return {
    id: page.id,
    title: displayTitle(page),
    icon: page.mark,
    kind: page.kind,
    // backdrop is the style's own artwork (CSS gradients and inline SVG), drawn behind the paper as in the app.
    style: style ? { id: style.id, name: style.name, paper: style.paper, ink: style.ink, accent: style.accent, dark: !!style.dark, title: style.title, backdrop: style.backdrop } : null,
    blocks: all.slice(0, MAX_BLOCKS).map(({ block, depth }) => ({
      id: block.id as string,
      type: block.type as string,
      depth,
      props: Object.fromEntries(PROPS.filter((k) => block.props?.[k] !== undefined).map((k) => [k, block.props[k]])),
      content: block.content ?? null,
      markdown: blockToMarkdown(block).join("\n"),
    })),
    more: Math.max(0, all.length - MAX_BLOCKS),
  };
}

const webUrl = (v: unknown, kinds = /^https?:$/) => {
  try {
    const u = new URL(String(v));
    return kinds.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
// A Markdown link or picture address ends at the first ")" or space.
const safe = (u: string) => u.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");

/** "From <site page title>", linked, in small grey text. */
export function sourceCaption(pageUrl: string, pageTitle: string): string {
  const url = webUrl(pageUrl);
  if (!url) return "";
  const name = pageTitle.trim() || new URL(url).hostname.replace(/^www\./, "");
  return `<small>From [${inlineToMarkdown(name.slice(0, 200))}](${safe(url)})</small>`;
}

export interface Clip {
  kind: "selection" | "image" | "link" | "bookmark";
  pageUrl: string;
  pageTitle: string;
  /** The selection as HTML (keeps links, lists and code), with its plain text as a fallback. */
  html?: string;
  text?: string;
  src?: string;
  alt?: string;
  href?: string;
  linkText?: string;
  /** A bookmark's summary: the page's own description of itself. */
  description?: string;
}

/** The Markdown for something taken from a website, without where it came from; null when there's nothing usable. */
export function clipBody(c: Clip): string | null {
  const base = webUrl(c.pageUrl) ?? "https://example.invalid/";

  if (c.kind === "selection") {
    let md = c.html ? htmlToMarkdown(c.html.slice(0, 500_000), base) : "";
    if (!md && c.text) md = textToMarkdown(c.text.slice(0, 200_000));
    if (!md) return null;
    // One plain paragraph reads best as a quote; anything with structure (lists, headings, code) stays as it is.
    const blocks = markdownToBlocks(md);
    if (blocks.length === 1 && blocks[0].type === "paragraph") md = `> ${md}`;
    return md;
  }
  if (c.kind === "image") {
    const src = webUrl(c.src);
    if (!src) return null;
    const alt = (c.alt ?? "").replace(/[[\]\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    return `![${alt}](${safe(src)})`;
  }
  if (c.kind === "bookmark") {
    const href = webUrl(c.href);
    if (!href) return null;
    // The card shows the page's title and picture itself; the summary goes under it as text.
    const about = textToMarkdown((c.description ?? "").replace(/\s+/g, " ").trim().slice(0, 600));
    return `<embed url="${safe(href).replace(/"/g, "%22")}"/>${about ? `\n\n${about}` : ""}`;
  }
  const href = webUrl(c.href, /^(https?|mailto):$/);
  if (!href) return null;
  const text = (c.linkText ?? "").replace(/\s+/g, " ").trim() || href;
  return `[${inlineToMarkdown(text.slice(0, 300))}](${safe(href)})`;
}

/** The Markdown to add for something taken from a website, or null when there's nothing usable. */
export function clipMarkdown(c: Clip): string | null {
  const body = clipBody(c);
  if (!body) return null;
  // A link or a bookmark already says where it goes.
  const caption = c.kind === "selection" || c.kind === "image" ? sourceCaption(c.pageUrl, c.pageTitle) : "";
  return caption ? `${body}\n\n${caption}` : body;
}

/** Tags as Dovli writes them (#recipe #to-read), from what someone typed. At most 10. */
export function tagLine(tags: unknown): string {
  if (!Array.isArray(tags)) return "";
  const typed = tags.filter((t): t is string => typeof t === "string").slice(0, 10).map((t) => `#${t.trim().replace(/^#+/, "").replace(/\s+/g, "-")}`);
  return extractTags(typed.join(" ")).map((t) => `#${t}`).join(" ");
}

/** Someone's own remark about a clip, as a note. */
export function remarkCallout(remark: string): string {
  const t = remark.trim().slice(0, 2000);
  return t ? `<callout tone="note" emoji="💬">${inlineToMarkdown(t)}</callout>` : "";
}
