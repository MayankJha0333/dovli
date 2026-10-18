// The phone app's workspace store. Pages are saved on the phone (SQLite) the moment they change,
// so the app works offline; when signed in, the shared sync engine sends them to the cloud.

import { useSyncExternalStore } from "react";
import { childrenOf, descendantIds, pageWithBlockIds, seedPages, type Page, type PageKind } from "@dovli/core";
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

  createPage(input: { id?: string; kind?: PageKind; parentId?: string | null; title?: string } = {}): Page {
    const now = Date.now();
    const parentId = input.parentId ?? null;
    const sibs = childrenOf(pages, parentId, { includeTrashed: true });
    const page: Page = {
      id: input.id ?? newId(),
      parentId,
      kind: input.kind ?? "doc",
      title: input.title ?? "",
      mark: input.kind === "board" ? "◇" : "¶",
      blocks: input.kind === "board" ? undefined : [],
      board: input.kind === "board" ? { elements: [] } : undefined,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      order: sibs.length ? Math.max(...sibs.map((s) => s.order)) + 1 : 0,
    };
    commit({ ...pages, [page.id]: page }, [page.id]);
    return page;
  },

  updatePage(id: string, patch: Partial<Page>, touch = true) {
    const cur = pages[id];
    if (!cur) return;
    commit({ ...pages, [id]: { ...cur, ...patch, updatedAt: touch ? Date.now() : cur.updatedAt } }, [id]);
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

  restorePages(ids: string[]) {
    const next = { ...pages };
    for (const id of ids) if (next[id]) next[id] = { ...next[id], deletedAt: null, updatedAt: Date.now() };
    commit(next, ids);
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
  queueAll() {
    for (const id of Object.keys(pages)) outbox[id] = { id };
    persist();
  },
};

export function usePages<T>(select: (pages: Record<string, Page>) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(pages), () => select(pages));
}
