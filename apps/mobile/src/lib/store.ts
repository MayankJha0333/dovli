// The phone app's workspace store. Pages are saved on the phone (SQLite) the moment they change,
// so the app works offline; when signed in, the shared sync engine sends them to the cloud.

import { useSyncExternalStore } from "react";
import { childrenOf, descendantIds, pageWithBlockIds, seedPages, withBlockIds, type BoardData, type Page, type PageKind } from "@dovli/core";
import { kv } from "./kv";

const PAGES = "dovli.pages.v1";
const OUTBOX = "dovli.outbox.v1";

// Pages saved before blocks had ids get them on load (see pageWithBlockIds).
let pages: Record<string, Page> = Object.fromEntries(
  Object.values(kv.get<Record<string, Page> | null>(PAGES, null) ?? seedPages()).map((p) => [p.id, pageWithBlockIds(p)]),
);
let outbox: Record<string, { id: string; purge?: boolean }> = kv.get(OUTBOX, {});
const listeners = new Set<() => void>();
const changeHooks = new Set<() => void>();

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    kv.set(PAGES, pages);
    kv.set(OUTBOX, outbox);
  }, 250);
}

function commit(next: Record<string, Page>, changed: string[], { local = true, purged = [] as string[] } = {}) {
  pages = next;
  if (local) {
    for (const id of changed) if (next[id]) outbox[id] = { id };
    for (const id of purged) outbox[id] = { id, purge: true };
    changeHooks.forEach((h) => h());
  }
  persist();
  listeners.forEach((l) => l());
}

const newId = () => Math.random().toString(36).slice(2, 12);

/** A copied block gets new ids (withBlockIds adds them), so two pages never share block ids. */
function stripIds(b: any): any {
  const { id: _id, ...rest } = b ?? {};
  return Array.isArray(rest.children) ? { ...rest, children: rest.children.map(stripIds) } : rest;
}

export const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getPages: () => pages,
  onLocalChange(fn: () => void) {
    changeHooks.add(fn);
    return () => changeHooks.delete(fn);
  },

  createPage(
    input: { id?: string; kind?: PageKind; parentId?: string | null; title?: string; mark?: string; style?: string; blocks?: any[]; board?: BoardData } = {},
  ): Page {
    const now = Date.now();
    const parentId = input.parentId ?? null;
    const kind = input.kind ?? "doc";
    const id = input.id ?? newId();
    const sibs = childrenOf(pages, parentId, { includeTrashed: true });
    const page: Page = {
      id,
      parentId,
      kind,
      title: input.title ?? "",
      mark: input.mark ?? (kind === "board" ? "◇" : "¶"),
      style: input.style,
      blocks: kind === "board" ? undefined : (withBlockIds(input.blocks, id) ?? []),
      board: kind === "board" ? (input.board ?? { elements: [] }) : undefined,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      order: sibs.length ? Math.max(...sibs.map((s) => s.order)) + 1 : 0,
    };
    const next = { ...pages, [page.id]: page };
    const changed = [page.id];
    // Open the parent in the page tree, as on the web.
    if (parentId && next[parentId] && !next[parentId].expanded) {
      next[parentId] = { ...next[parentId], expanded: true };
      changed.push(parentId);
    }
    commit(next, changed);
    return page;
  },

  updatePage(id: string, patch: Partial<Page>, touch = true) {
    const cur = pages[id];
    if (!cur) return;
    // The editor saves once when a page opens; nothing changed, so it isn't an edit.
    if ((Object.keys(patch) as (keyof Page)[]).every((k) => JSON.stringify(cur[k]) === JSON.stringify(patch[k]))) return;
    commit({ ...pages, [id]: { ...cur, ...patch, updatedAt: touch ? Date.now() : cur.updatedAt } }, [id]);
  },

  /** Show or hide a page's sub-pages in the page tree. Not an edit. */
  toggleExpanded(id: string) {
    const p = pages[id];
    if (p) store.updatePage(id, { expanded: !p.expanded }, false);
  },

  duplicatePage(id: string): Page | null {
    const src = pages[id];
    if (!src) return null;
    const copy = store.createPage({
      parentId: src.parentId,
      kind: src.kind,
      title: src.title ? `${src.title} (copy)` : "",
      mark: src.mark,
      style: src.style,
      blocks: src.blocks ? JSON.parse(JSON.stringify(src.blocks)).map((b: any) => stripIds(b)) : undefined,
      board: src.board ? JSON.parse(JSON.stringify(src.board)) : undefined,
    });
    if (src.cover || src.look) store.updatePage(copy.id, { cover: src.cover, look: src.look }, false);
    return copy;
  },

  /** Remember that a page was opened (for Recent), without counting it as an edit. */
  markOpened(id: string) {
    const p = pages[id];
    if (!p || (p.lastOpenedAt && Date.now() - p.lastOpenedAt < 60_000)) return;
    store.updatePage(id, { lastOpenedAt: Date.now() }, false);
  },

  toggleFavorite(id: string) {
    const p = pages[id];
    if (p) store.updatePage(id, { favorite: !p.favorite }, false);
  },

  trashPage(id: string): string[] {
    const now = Date.now();
    const ids = [id, ...descendantIds(pages, id)].filter((x) => pages[x] && !pages[x].deletedAt);
    const next = { ...pages };
    for (const x of ids) next[x] = { ...next[x], deletedAt: now, updatedAt: now };
    commit(next, ids);
    return ids;
  },

  /** Bring pages back from the trash, with whatever was trashed with them. A page whose parent is still in the trash moves to the top. */
  restorePages(ids: string[]) {
    const next = { ...pages };
    const all = new Set<string>();
    for (const id of ids) {
      const p = next[id];
      if (!p?.deletedAt) continue;
      for (const x of [id, ...descendantIds(next, id)]) if (next[x].deletedAt === p.deletedAt) all.add(x);
    }
    for (const x of all) {
      const p = next[x];
      const parentGone = p.parentId && (!next[p.parentId] || (next[p.parentId].deletedAt && !all.has(p.parentId)));
      next[x] = { ...p, deletedAt: null, parentId: parentGone ? null : p.parentId, updatedAt: Date.now() };
    }
    commit(next, [...all]);
  },

  /** Delete pages for good, here and in the cloud. */
  deleteForever(ids: string[]) {
    const doomed = new Set<string>();
    for (const id of ids) {
      if (!pages[id]) continue;
      doomed.add(id);
      descendantIds(pages, id).forEach((x) => doomed.add(x));
    }
    if (!doomed.size) return;
    commit(Object.fromEntries(Object.entries(pages).filter(([k]) => !doomed.has(k))), [], { purged: [...doomed] });
  },

  emptyTrash() {
    store.deleteForever(Object.values(pages).filter((p) => p.deletedAt).map((p) => p.id));
  },

  /* ---------- For the sync engine ---------- */
  applyFromCloud(list: Page[], removed: string[]) {
    if (!list.length && !removed.length) return;
    const next = { ...pages };
    for (const p of list) next[p.id] = p;
    for (const id of removed) delete next[id];
    commit(next, [], { local: false });
  },
  pending: () => Object.values(outbox),
  clearPending(id: string, pushed: Page | null) {
    if (pushed && JSON.stringify(pages[id] ?? null) !== JSON.stringify(pushed)) return;
    delete outbox[id];
    persist();
  },
  /**
   * A different account signed in on this phone: start from the sample pages, so the previous
   * account's pages (already in its cloud copy) don't end up in this one.
   */
  resetForAccount() {
    outbox = {};
    commit(Object.fromEntries(Object.values(seedPages()).map((p) => [p.id, pageWithBlockIds(p)])), [], { local: false });
  },
  queueAll() {
    for (const id of Object.keys(pages)) outbox[id] = { id };
    persist();
  },
};

export function usePages<T>(select: (pages: Record<string, Page>) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(pages), () => select(pages));
}
