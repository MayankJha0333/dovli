import type { Page } from "./types";
import { livePages, pageText } from "./pages";

// Tags are written straight into the text, like #work or #ideas/books. Nothing else to manage:
// type a tag anywhere in a page and the page shows up under it.

// A tag starts after a space or line start, begins with a letter, and may hold letters, numbers, - _ and /.
const TAG_RE = /(^|[\s(])#([\p{L}][\p{L}\p{N}_\-/]*)/gu;

export function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").replace(/\/+$/, "").toLowerCase();
}

/** Tags written in a piece of text, lowercased, without repeats. */
export function extractTags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) out.add(normalizeTag(m[2]));
  return [...out];
}

/** Where each tag sits in a piece of text, for highlighting it. */
export function tagRanges(text: string): { start: number; end: number; tag: string }[] {
  const out: { start: number; end: number; tag: string }[] = [];
  for (const m of text.matchAll(TAG_RE)) {
    const start = (m.index ?? 0) + m[1].length;
    out.push({ start, end: start + 1 + m[2].length, tag: normalizeTag(m[2]) });
  }
  return out;
}

export function pageTags(page: Page): string[] {
  return extractTags(pageText(page));
}

/** Every tag with the pages that use it, most used first. */
export function tagIndex(pages: Record<string, Page>): { tag: string; pages: Page[] }[] {
  const map = new Map<string, Page[]>();
  for (const p of livePages(pages)) {
    for (const t of pageTags(p)) {
      const list = map.get(t);
      if (list) list.push(p);
      else map.set(t, [p]);
    }
  }
  return [...map.entries()]
    .map(([tag, ps]) => ({ tag, pages: ps.sort((a, b) => b.updatedAt - a.updatedAt) }))
    .sort((a, b) => b.pages.length - a.pages.length || a.tag.localeCompare(b.tag));
}

/** Pages tagged with `tag`. A parent tag (#ideas) also finds its children (#ideas/books). */
export function pagesWithTag(pages: Record<string, Page>, tag: string): Page[] {
  const t = normalizeTag(tag);
  return livePages(pages)
    .filter((p) => pageTags(p).some((x) => x === t || x.startsWith(`${t}/`)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
