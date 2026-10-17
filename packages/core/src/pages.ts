import type { Page } from "./types";

// Small, pure helpers for reading the page tree. No React, no browser APIs.

export function childrenOf(pages: Record<string, Page>, parentId: string | null): Page[] {
  return Object.values(pages)
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

export function descendantIds(pages: Record<string, Page>, id: string): string[] {
  const out: string[] = [];
  for (const child of childrenOf(pages, id)) out.push(child.id, ...descendantIds(pages, child.id));
  return out;
}

export function ancestors(pages: Record<string, Page>, id: string): Page[] {
  const chain: Page[] = [];
  let cur = pages[id]?.parentId;
  while (cur && pages[cur]) {
    chain.unshift(pages[cur]);
    cur = pages[cur].parentId;
  }
  return chain;
}

/** Plain text of a doc page, used for search, previews and word counts. */
export function pageText(page: Page): string {
  if (page.kind !== "doc" || !page.blocks) return "";
  const parts: string[] = [];
  const walk = (blocks: any[]) => {
    for (const b of blocks) {
      if (Array.isArray(b.content)) {
        parts.push(b.content.map((c: any) => (typeof c === "string" ? c : c.text ?? (c.content?.map?.((x: any) => x.text).join("") ?? ""))).join(""));
      } else if (typeof b.content === "string") {
        parts.push(b.content);
      } else if (b.content?.type === "tableContent") {
        for (const row of b.content.rows ?? [])
          for (const cell of row.cells ?? [])
            parts.push((Array.isArray(cell) ? cell : cell.content ?? []).map((c: any) => c.text ?? "").join(""));
      }
      if (b.children?.length) walk(b.children);
    }
  };
  walk(page.blocks);
  return parts.filter(Boolean).join("\n");
}

export function wordCount(page: Page): number {
  const t = pageText(page).trim();
  return t ? t.split(/\s+/).length : 0;
}

export function displayTitle(page: Page): string {
  return page.title.trim() || (page.kind === "board" ? "Untitled board" : "Untitled");
}

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
