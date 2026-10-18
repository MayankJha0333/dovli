import type { Page } from "./types";
import { livePages } from "./pages";

// Links between pages: sub-page cards and [[page links]] written inside text.

/** Ids of every page this page points to, in reading order, without repeats. */
export function outgoingLinks(page: Page): string[] {
  const out: string[] = [];
  const add = (id: unknown) => {
    if (typeof id === "string" && id && id !== page.id && !out.includes(id)) out.push(id);
  };
  const walkInline = (content: any) => {
    if (!Array.isArray(content)) return;
    for (const c of content) {
      if (c?.type === "pageLink") add(c.props?.pageId);
      else if (c?.type === "link") walkInline(c.content);
    }
  };
  const walk = (blocks: any[] | undefined) => {
    for (const b of blocks ?? []) {
      if (b.type === "subpage") add(b.props?.pageId);
      walkInline(b.content);
      if (b.content?.type === "tableContent")
        for (const row of b.content.rows ?? []) for (const cell of row.cells ?? []) walkInline(Array.isArray(cell) ? cell : cell.content);
      walk(b.children);
    }
  };
  if (page.kind === "doc") walk(page.blocks);
  return out;
}

/** For every page, the pages that link to it. Pages in the trash are ignored. */
export function backlinkIndex(pages: Record<string, Page>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const p of livePages(pages)) {
    for (const target of outgoingLinks(p)) {
      const list = index.get(target);
      if (list) list.push(p.id);
      else index.set(target, [p.id]);
    }
  }
  return index;
}

/** Pages that link to `id`, most recently edited first. */
export function backlinksOf(pages: Record<string, Page>, id: string): Page[] {
  const ids = backlinkIndex(pages).get(id) ?? [];
  return ids
    .map((x) => pages[x])
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Ids of sub-page cards placed inside a page (used to list children that have no card). */
export function subpageCardIds(blocks: any[] | undefined, out = new Set<string>()): Set<string> {
  for (const b of blocks ?? []) {
    if (b.type === "subpage" && b.props?.pageId) out.add(b.props.pageId);
    if (b.children?.length) subpageCardIds(b.children, out);
  }
  return out;
}

/** The headings of a page, for an "On this page" outline. */
export function outline(page: Page): { id: string; level: number; text: string }[] {
  const out: { id: string; level: number; text: string }[] = [];
  const text = (content: any) =>
    Array.isArray(content) ? content.map((c: any) => (c.type === "pageLink" ? c.props?.title ?? "" : c.text ?? "")).join("") : "";
  const walk = (blocks: any[] | undefined) => {
    for (const b of blocks ?? []) {
      if (b.type === "heading") {
        const t = text(b.content).trim();
        if (t) out.push({ id: b.id, level: b.props?.level ?? 1, text: t });
      }
      walk(b.children);
    }
  };
  if (page.kind === "doc") walk(page.blocks);
  return out;
}
