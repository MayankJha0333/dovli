import type { Page } from "./types";

// Small, pure helpers for reading the page tree. No React, no browser APIs.

/** How long a page stays in the trash before it is deleted for good. */
export const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export const isTrashed = (p: Page | undefined | null) => !!p?.deletedAt;

/** Pages that are not in the trash. */
export function livePages(pages: Record<string, Page>): Page[] {
  return Object.values(pages).filter((p) => !p.deletedAt);
}

/** Children of a page in order. Pages in the trash are left out unless asked for. */
export function childrenOf(
  pages: Record<string, Page>,
  parentId: string | null,
  { includeTrashed = false }: { includeTrashed?: boolean } = {},
): Page[] {
  return Object.values(pages)
    .filter((p) => p.parentId === parentId && (includeTrashed || !p.deletedAt))
    .sort((a, b) => a.order - b.order);
}

/** Every page below `id`, at any depth, including pages in the trash. */
export function descendantIds(pages: Record<string, Page>, id: string): string[] {
  const out: string[] = [];
  for (const child of childrenOf(pages, id, { includeTrashed: true })) out.push(child.id, ...descendantIds(pages, child.id));
  return out;
}

export function ancestors(pages: Record<string, Page>, id: string): Page[] {
  const chain: Page[] = [];
  const seen = new Set<string>([id]);
  let cur = pages[id]?.parentId;
  while (cur && pages[cur] && !seen.has(cur)) {
    seen.add(cur);
    chain.unshift(pages[cur]);
    cur = pages[cur].parentId;
  }
  return chain;
}

/** Pages in the trash that should be deleted for good now. */
export function expiredTrash(pages: Record<string, Page>, now = Date.now()): string[] {
  return Object.values(pages)
    .filter((p) => p.deletedAt && now - p.deletedAt > TRASH_DAYS * DAY)
    .map((p) => p.id);
}

export function daysLeftInTrash(page: Page, now = Date.now()): number {
  if (!page.deletedAt) return TRASH_DAYS;
  return Math.max(0, Math.ceil((page.deletedAt + TRASH_DAYS * DAY - now) / DAY));
}

/** The top-level trashed pages (ones whose parent is not also in the trash), newest first. */
export function trashRoots(pages: Record<string, Page>): Page[] {
  return Object.values(pages)
    .filter((p) => p.deletedAt && !(p.parentId && pages[p.parentId]?.deletedAt))
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

/** Text of one inline content array (text runs, links, page links). */
export function inlineText(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((c: any) => {
      if (typeof c === "string") return c;
      if (c.type === "text") return c.text ?? "";
      if (c.type === "link") return inlineText(c.content);
      if (c.type === "pageLink") return c.props?.title ?? "";
      return c.text ?? "";
    })
    .join("");
}

/** Plain text of a doc page, used for search, previews, tags and word counts. */
export function pageText(page: Page): string {
  if (page.kind !== "doc" || !page.blocks) return "";
  const parts: string[] = [];
  const walk = (blocks: any[]) => {
    for (const b of blocks) {
      if (Array.isArray(b.content) || typeof b.content === "string") {
        parts.push(inlineText(b.content));
      } else if (b.content?.type === "tableContent") {
        for (const row of b.content.rows ?? [])
          for (const cell of row.cells ?? []) parts.push(inlineText(Array.isArray(cell) ? cell : cell.content ?? []));
      }
      if (b.type === "dataTable") parts.push(dataTableText(b.props?.data));
      if (b.props?.caption) parts.push(b.props.caption);
      if (b.children?.length) walk(b.children);
    }
  };
  walk(page.blocks);
  return parts.filter(Boolean).join("\n");
}

function dataTableText(raw: unknown): string {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const cols: any[] = data?.columns ?? [];
    const rows: any[] = data?.rows ?? [];
    return [cols.map((c) => c.name).join(" "), ...rows.map((r) => cols.map((c) => r.cells?.[c.id] ?? "").join(" "))].join("\n");
  } catch {
    return "";
  }
}

export function wordCount(page: Page): number {
  const t = pageText(page).trim();
  return t ? t.split(/\s+/).length : 0;
}

export function displayTitle(page: Pick<Page, "title" | "kind">): string {
  return page.title.trim() || (page.kind === "board" ? "Untitled board" : "Untitled");
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Favourite pages, in the order they were starred (oldest first keeps the list stable). */
export function favoritePages(pages: Record<string, Page>): Page[] {
  return livePages(pages)
    .filter((p) => p.favorite)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Pages opened or edited most recently. */
export function recentPages(pages: Record<string, Page>, limit = 8): Page[] {
  const seen = (p: Page) => Math.max(p.lastOpenedAt ?? 0, p.updatedAt);
  return livePages(pages)
    .sort((a, b) => seen(b) - seen(a))
    .slice(0, limit);
}
