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

const textOf = (content: any): string =>
  Array.isArray(content) ? content.map((c: any) => (c.type === "pageLink" ? c.props?.title ?? "" : c.type === "link" ? textOf(c.content) : c.text ?? "")).join("") : "";

/** Every to-do in a page, in reading order. */
export function todoItems(page: Page): { id: string; text: string; checked: boolean }[] {
  const out: { id: string; text: string; checked: boolean }[] = [];
  const walk = (blocks: any[] | undefined) => {
    for (const b of blocks ?? []) {
      if (b.type === "checkListItem") out.push({ id: b.id, text: textOf(b.content).trim(), checked: !!b.props?.checked });
      walk(b.children);
    }
  };
  if (page.kind === "doc") walk(page.blocks);
  return out;
}

export type AttachmentKind = "image" | "video" | "audio" | "file" | "pdf" | "embed";

/** Pictures, videos, files and embeds placed in a page. */
export function attachments(page: Page): { id: string; kind: AttachmentKind; name: string; url: string }[] {
  const out: { id: string; kind: AttachmentKind; name: string; url: string }[] = [];
  const kinds: Record<string, AttachmentKind> = { image: "image", video: "video", audio: "audio", file: "file", pdf: "pdf", embed: "embed" };
  const walk = (blocks: any[] | undefined) => {
    for (const b of blocks ?? []) {
      const kind = kinds[b.type];
      if (kind) {
        const url: string = b.props?.url || b.props?.link || "";
        const fallback = url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("dovli-file:") ? "" : url.replace(/^https?:\/\/(www\.)?/, "").split(/[?#]/)[0];
        out.push({ id: b.id, kind, url, name: (b.props?.name || b.props?.title || b.props?.siteName || b.props?.caption || fallback || kind[0].toUpperCase() + kind.slice(1)).trim() });
      }
      walk(b.children);
    }
  };
  if (page.kind === "doc") walk(page.blocks);
  return out;
}

/** Web links written inside a page's text, without repeats. */
export function webLinks(page: Page): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  const walkInline = (content: any) => {
    if (!Array.isArray(content)) return;
    for (const c of content) if (c?.type === "link" && c.href && !out.some((o) => o.href === c.href)) out.push({ href: c.href, text: textOf(c.content).trim() || c.href });
  };
  const walk = (blocks: any[] | undefined) => {
    for (const b of blocks ?? []) {
      walkInline(b.content);
      walk(b.children);
    }
  };
  if (page.kind === "doc") walk(page.blocks);
  return out;
}
