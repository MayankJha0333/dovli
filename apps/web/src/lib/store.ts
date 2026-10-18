// The web app's workspace store: every page plus the current screen.
// Pages are saved to this device first (IndexedDB), then synced to the cloud when signed in.
// Shared logic (tree, trash, search, merge) lives in @dovli/core; this file adds state and saving.

import { useSyncExternalStore } from "react";
import { nanoid } from "nanoid";
import {
  childrenOf,
  descendantIds,
  expiredTrash,
  pageWithBlockIds,
  seedPages,
  withBlockIds,
  type BoardData,
  type Page,
  type PageKind,
  type Route,
  type SaveStatus,
} from "@dovli/core";
import { db, getMeta, loadAllPages, perAccountStorage, setMeta, writePages } from "./db";

export interface State {
  ready: boolean;
  pages: Record<string, Page>;
  route: Route;
  saveStatus: SaveStatus;
}

/** Where pages lived before IndexedDB (and before the app was renamed from Quire). */
const LEGACY_KEYS = ["dovli.workspace.v1", "quire.workspace.v1"];

let state: State = { ready: false, pages: {}, route: { name: "home" }, saveStatus: "saved" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

const dirty = new Set<string>();
let flushTimer: number | undefined;
let changeHooks: ((ids: string[], purged: string[]) => void)[] = [];

/** The sync layer listens here so it knows which pages changed on this device. */
export function onLocalChange(fn: (ids: string[], purged: string[]) => void) {
  changeHooks.push(fn);
  return () => {
    changeHooks = changeHooks.filter((f) => f !== fn);
  };
}

async function flush() {
  window.clearTimeout(flushTimer);
  if (!dirty.size) return;
  const ids = [...dirty];
  dirty.clear();
  const changed = ids.map((id) => state.pages[id]).filter(Boolean) as Page[];
  const removed = ids.filter((id) => !state.pages[id]);
  try {
    await writePages(changed, removed);
    if (!dirty.size) setState({ saveStatus: "saved" });
  } catch (err) {
    console.error("[dovli] saving failed", err);
    ids.forEach((id) => dirty.add(id));
    setState({ saveStatus: "error" });
  }
}

function scheduleFlush() {
  if (state.saveStatus !== "saving") setState({ saveStatus: "saving" });
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flush(), 300);
}

if (typeof window !== "undefined") {
  const now = () => void flush();
  window.addEventListener("pagehide", now);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && now());
}

/**
 * Apply a change to some pages. `local` changes came from this device and will be synced;
 * cloud changes (local: false) are only saved here.
 */
function commit(next: Record<string, Page>, changedIds: string[], opts: { local?: boolean; purged?: string[] } = {}) {
  const { local = true, purged = [] } = opts;
  setState({ pages: next });
  for (const id of [...changedIds, ...purged]) dirty.add(id);
  scheduleFlush();
  if (local) changeHooks.forEach((h) => h(changedIds.filter((id) => next[id]), purged));
}

/* ------------------------------------------------------------------ */
/* Routing (the address bar hash)                                      */
/* ------------------------------------------------------------------ */

export function routeFromHash(pages: Record<string, Page>): Route {
  try {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (h === "templates") return { name: "templates" };
    if (h === "trash") return { name: "trash" };
    if (h.startsWith("tag-")) return { name: "tag", tag: h.slice(4) };
    if (h.startsWith("p-") && pages[h.slice(2)] && !pages[h.slice(2)].deletedAt) return { name: "page", id: h.slice(2) };
  } catch {
    /* ignore */
  }
  return { name: "home" };
}

function hashFor(route: Route) {
  switch (route.name) {
    case "page":
      return `#p-${route.id}`;
    case "tag":
      return `#tag-${encodeURIComponent(route.tag)}`;
    default:
      return `#${route.name}`;
  }
}

/* ------------------------------------------------------------------ */
/* Starting up                                                         */
/* ------------------------------------------------------------------ */

async function loadLegacy(): Promise<Record<string, Page> | null> {
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.pages === "object") return parsed.pages;
    } catch {
      /* corrupt: try the next one */
    }
  }
  return null;
}

let initPromise: Promise<void> | null = null;

/** Open the database, move old browser-storage pages over, and clear out expired trash. */
export function initStore(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      let pages: Record<string, Page> = {};
      try {
        pages = await loadAllPages();
        // Pages saved before blocks had ids (the old sample pages) get them now, once.
        const fixed = Object.values(pages).filter((p) => pageWithBlockIds(p) !== p).map(pageWithBlockIds);
        if (fixed.length) {
          for (const p of fixed) pages[p.id] = p;
          await writePages(fixed, []);
        }
        if (!Object.keys(pages).length && !(await getMeta<boolean>("seeded"))) {
          // Pages from the very first versions (kept in browser storage) belong to nobody, so with
          // accounts on they are not handed to whoever signs in first: new accounts start fresh.
          const legacy = perAccountStorage() ? null : await loadLegacy();
          pages = legacy ? Object.fromEntries(Object.values(legacy).map((p) => [p.id, pageWithBlockIds(p)])) : seedPages();
          await writePages(Object.values(pages), []);
          await setMeta("seeded", true);
          changeHooks.forEach((h) => h(Object.keys(pages), []));
        }
      } catch (err) {
        console.error("[dovli] could not open this device's storage", err);
        pages = (await loadLegacy()) ?? seedPages();
        setState({ saveStatus: "error" });
      }
      state = { ...state, pages, route: routeFromHash(pages), ready: true };
      emit();
      const expired = expiredTrash(pages);
      if (expired.length) store.deleteForever(expired);
    })();
  }
  return initPromise;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const nextOrder = (pages: Record<string, Page>, parentId: string | null) => {
  const sibs = childrenOf(pages, parentId, { includeTrashed: true });
  return sibs.length ? Math.max(...sibs.map((s) => s.order)) + 1 : 0;
};

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  navigate(route: Route, { replace = false }: { replace?: boolean } = {}) {
    setState({ route });
    try {
      const hash = hashFor(route);
      if (location.hash !== hash) (replace ? history.replaceState : history.pushState).call(history, null, "", hash);
    } catch {
      /* ignore */
    }
    if (route.name === "page") store.markOpened(route.id);
  },

  createPage(input: {
    parentId?: string | null;
    kind?: PageKind;
    title?: string;
    mark?: string;
    style?: string;
    blocks?: any[];
    board?: BoardData;
  }): Page {
    const parentId = input.parentId ?? null;
    const now = Date.now();
    const kind = input.kind ?? "doc";
    const id = nanoid(10);
    const page: Page = {
      id,
      parentId,
      kind,
      title: input.title ?? "",
      mark: input.mark ?? (kind === "board" ? "◇" : "¶"),
      style: input.style,
      blocks: kind === "doc" ? withBlockIds(input.blocks, id) : undefined,
      board: kind === "board" ? (input.board ?? { elements: [] }) : undefined,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      order: nextOrder(state.pages, parentId),
    };
    const pages = { ...state.pages, [page.id]: page };
    const changed = [page.id];
    if (parentId && pages[parentId] && !pages[parentId].expanded) {
      pages[parentId] = { ...pages[parentId], expanded: true };
      changed.push(parentId);
    }
    commit(pages, changed);
    return page;
  },

  updatePage(id: string, patch: Partial<Page>, touch = true) {
    const current = state.pages[id];
    if (!current) return;
    commit({ ...state.pages, [id]: { ...current, ...patch, updatedAt: touch ? Date.now() : current.updatedAt } }, [id]);
  },

  /** Remember that a page was opened (for Recent), without counting it as an edit. */
  markOpened(id: string) {
    const p = state.pages[id];
    if (!p || (p.lastOpenedAt && Date.now() - p.lastOpenedAt < 60_000)) return;
    store.updatePage(id, { lastOpenedAt: Date.now() }, false);
  },

  toggleFavorite(id: string) {
    const p = state.pages[id];
    if (p) store.updatePage(id, { favorite: !p.favorite }, false);
  },

  /** Move a page (and everything inside it) under a new parent, at the end. */
  movePage(id: string, parentId: string | null) {
    const p = state.pages[id];
    if (!p || p.parentId === parentId || id === parentId) return;
    if (parentId && descendantIds(state.pages, id).includes(parentId)) return;
    const pages = { ...state.pages, [id]: { ...p, parentId, order: nextOrder(state.pages, parentId), updatedAt: Date.now() } };
    const changed = [id];
    if (parentId && pages[parentId] && !pages[parentId].expanded) {
      pages[parentId] = { ...pages[parentId], expanded: true };
      changed.push(parentId);
    }
    commit(pages, changed);
  },

  duplicatePage(id: string): Page | null {
    const src = state.pages[id];
    if (!src) return null;
    const copy = store.createPage({
      parentId: src.parentId,
      kind: src.kind,
      title: src.title ? `${src.title} (copy)` : "",
      mark: src.mark,
      style: src.style,
      blocks: src.blocks ? structuredClone(src.blocks) : undefined,
      board: src.board ? structuredClone(src.board) : undefined,
    });
    if (src.cover) store.updatePage(copy.id, { cover: src.cover });
    return copy;
  },

  /** Put a page and everything inside it in the trash. Returns the ids, for Undo. */
  trashPage(id: string): string[] {
    const target = state.pages[id];
    if (!target) return [];
    const now = Date.now();
    const ids = [id, ...descendantIds(state.pages, id)].filter((x) => !state.pages[x].deletedAt);
    const pages = { ...state.pages };
    for (const x of ids) pages[x] = { ...pages[x], deletedAt: now, favorite: pages[x].favorite, updatedAt: now };
    commit(pages, ids);
    const r = state.route;
    if (r.name === "page" && ids.includes(r.id)) {
      const parent = target.parentId && pages[target.parentId] && !pages[target.parentId].deletedAt ? target.parentId : null;
      store.navigate(parent ? { name: "page", id: parent } : { name: "home" }, { replace: true });
    }
    return ids;
  },

  /** Bring pages back from the trash. A page whose parent is still in the trash moves to the top level. */
  restorePages(ids: string[]) {
    const pages = { ...state.pages };
    const all = new Set<string>();
    for (const id of ids) {
      const p = pages[id];
      if (!p?.deletedAt) continue;
      // Restore the page and whatever was trashed with it.
      for (const x of [id, ...descendantIds(pages, id)]) if (pages[x].deletedAt === p.deletedAt) all.add(x);
    }
    for (const x of all) {
      const p = pages[x];
      const parentGone = p.parentId && (!pages[p.parentId] || (pages[p.parentId].deletedAt && !all.has(p.parentId)));
      pages[x] = { ...p, deletedAt: null, parentId: parentGone ? null : p.parentId, updatedAt: Date.now() };
    }
    commit(pages, [...all]);
  },

  /** Delete pages for good, everywhere. */
  deleteForever(ids: string[]) {
    const doomed = new Set<string>();
    for (const id of ids) {
      if (!state.pages[id]) continue;
      doomed.add(id);
      descendantIds(state.pages, id).forEach((x) => doomed.add(x));
    }
    if (!doomed.size) return;
    const pages = Object.fromEntries(Object.entries(state.pages).filter(([k]) => !doomed.has(k)));
    commit(pages, [], { purged: [...doomed] });
  },

  emptyTrash() {
    store.deleteForever(Object.values(state.pages).filter((p) => p.deletedAt).map((p) => p.id));
  },

  /** Add many pages at once (import, restore). */
  addPages(list: Page[]) {
    const pages = { ...state.pages };
    for (const p of list) pages[p.id] = p;
    commit(pages, list.map((p) => p.id));
  },

  /** Replace the whole workspace (restore a backup). Pages not in the backup go to the trash. */
  replaceAll(next: Record<string, Page>) {
    const now = Date.now();
    const pages: Record<string, Page> = { ...next };
    for (const [id, p] of Object.entries(state.pages)) if (!next[id] && !p.deletedAt) pages[id] = { ...p, deletedAt: now, updatedAt: now };
    for (const p of Object.values(pages)) p.updatedAt = Math.max(p.updatedAt, now);
    commit(pages, Object.keys(pages));
    store.navigate({ name: "home" }, { replace: true });
  },

  resetWorkspace() {
    store.replaceAll(seedPages());
  },

  /** Changes that came from the cloud: saved here, not sent back. */
  applyFromCloud(list: Page[], removed: string[]) {
    if (!list.length && !removed.length) return;
    const pages = { ...state.pages };
    for (const p of list) pages[p.id] = p;
    for (const id of removed) delete pages[id];
    commit(pages, [...list.map((p) => p.id), ...removed], { local: false });
    const r = state.route;
    if (r.name === "page" && (!pages[r.id] || pages[r.id].deletedAt)) store.navigate({ name: "home" }, { replace: true });
  },

  /** Wait until every change is written to this device. */
  flush,
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state));
}

/** Read-only database handle for features that need it (files, backups). */
export { db };
