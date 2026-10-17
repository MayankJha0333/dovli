// The web app's workspace store: pages + current route, saved to this browser (localStorage).
// Shared types and helpers live in @dovli/core; this file only adds state, saving and routing.
import { useSyncExternalStore } from "react";
import { nanoid } from "nanoid";
import { seedPages, descendantIds, type BoardData, type Page, type PageKind, type Route, type SaveStatus } from "@dovli/core";

interface State {
  pages: Record<string, Page>;
  route: Route;
  saveStatus: SaveStatus;
}

const STORAGE_KEY = "dovli.workspace.v1";
/** Where the app saved pages when it was still called Quire. Read once, so nothing is lost. */
const OLD_STORAGE_KEY = "quire.workspace.v1";

function loadPages(): Record<string, Page> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(OLD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.pages === "object") return parsed.pages;
    }
  } catch {
    /* storage blocked or corrupt: fall back to the sample workspace */
  }
  return seedPages();
}

function routeFromHash(pages: Record<string, Page>): Route {
  try {
    const h = location.hash.replace(/^#/, "");
    if (h === "templates") return { name: "templates" };
    if (h.startsWith("p-")) {
      const id = h.slice(2);
      if (pages[id]) return { name: "page", id };
    }
  } catch {
    /* ignore */
  }
  return { name: "home" };
}

const initialPages = loadPages();
let state: State = {
  pages: initialPages,
  route: routeFromHash(initialPages),
  saveStatus: "saved",
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

let saveTimer: number | undefined;
function scheduleSave() {
  if (state.saveStatus !== "saving") setState({ saveStatus: "saving" });
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, pages: state.pages }));
      setState({ saveStatus: "saved" });
    } catch {
      setState({ saveStatus: "error" });
    }
  }, 450);
}

function setPages(pages: Record<string, Page>) {
  setState({ pages });
  scheduleSave();
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  navigate(route: Route) {
    setState({ route });
    try {
      const hash =
        route.name === "page" ? `#p-${route.id}` : route.name === "templates" ? "#templates" : "#home";
      history.replaceState(null, "", hash);
    } catch {
      /* ignore */
    }
  },

  createPage(input: {
    parentId?: string | null;
    kind?: PageKind;
    title?: string;
    mark?: string;
    blocks?: any[];
    board?: BoardData;
  }): Page {
    const parentId = input.parentId ?? null;
    const siblings = Object.values(state.pages).filter((p) => p.parentId === parentId);
    const now = Date.now();
    const kind = input.kind ?? "doc";
    const page: Page = {
      id: nanoid(10),
      parentId,
      kind,
      title: input.title ?? "",
      mark: input.mark ?? (kind === "board" ? "◇" : "¶"),
      blocks: kind === "doc" ? input.blocks : undefined,
      board: kind === "board" ? input.board ?? { elements: [] } : undefined,
      createdAt: now,
      updatedAt: now,
      order: siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0,
    };
    const pages = { ...state.pages, [page.id]: page };
    if (parentId && pages[parentId]) pages[parentId] = { ...pages[parentId], expanded: true };
    setPages(pages);
    return page;
  },

  updatePage(id: string, patch: Partial<Page>, touch = true) {
    const current = state.pages[id];
    if (!current) return;
    setPages({
      ...state.pages,
      [id]: { ...current, ...patch, updatedAt: touch ? Date.now() : current.updatedAt },
    });
  },

  deletePage(id: string) {
    const doomed = new Set([id, ...descendantIds(state.pages, id)]);
    const parent = state.pages[id]?.parentId ?? null;
    const pages = Object.fromEntries(Object.entries(state.pages).filter(([k]) => !doomed.has(k)));
    setPages(pages);
    if (state.route.name === "page" && doomed.has(state.route.id)) {
      store.navigate(parent && pages[parent] ? { name: "page", id: parent } : { name: "home" });
    }
  },

  resetWorkspace() {
    setPages(seedPages());
    store.navigate({ name: "home" });
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state));
}
