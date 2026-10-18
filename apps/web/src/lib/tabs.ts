// Tabs along the top, like Craft: a fixed Home button, then one tab per open view.
// Opening something replaces the current tab, unless it was opened "in a new tab"
// (⌘/Ctrl-click, middle-click, or the + button). Open tabs are kept on this device.

import { useSyncExternalStore } from "react";
import type { Route } from "@dovli/core";
import { store } from "./store";

const KEY = "dovli.tabs.v1";
const MAX = 12;

export interface TabsState {
  tabs: Route[];
  /** Index of the tab on screen, or -1 when Home is showing. */
  active: number;
}

const same = (a: Route, b: Route) => JSON.stringify(a) === JSON.stringify(b);
const isHome = (r: Route) => r.name === "home";

let state: TabsState = { tabs: [], active: -1 };
let nextInNewTab = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.tabs));
  } catch {
    /* private window: tabs just aren't remembered */
  }
}

function set(next: TabsState) {
  state = next;
  save();
  emit();
}

/** Keep only tabs that still point at something (pages can be deleted on another device). */
function valid(r: Route): boolean {
  if (r.name !== "page") return !isHome(r);
  const p = store.get().pages[r.id];
  return !!p && !p.deletedAt;
}

/** Follow the app's route: show it in a tab. Called whenever the route changes. */
function follow(route: Route) {
  const { tabs, active } = state;
  if (isHome(route)) {
    nextInNewTab = false;
    if (active !== -1) set({ tabs, active: -1 });
    return;
  }
  const found = tabs.findIndex((t) => same(t, route));
  if (found >= 0) {
    nextInNewTab = false;
    if (found !== active) set({ tabs, active: found });
    return;
  }
  if (nextInNewTab || active < 0) {
    nextInNewTab = false;
    const list = [...tabs, route].slice(-MAX);
    set({ tabs: list, active: list.length - 1 });
    return;
  }
  const list = tabs.slice();
  list[active] = route;
  set({ tabs: list, active });
}

let started = false;
/** Start following the route. Safe to call more than once. */
export function startTabs() {
  if (started) return;
  started = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(saved)) state = { tabs: saved.filter(valid).slice(-MAX), active: -1 };
  } catch {
    /* ignore */
  }
  follow(store.get().route);
  let last = store.get().route;
  let lastPages = store.get().pages;
  store.subscribe(() => {
    const s = store.get();
    if (s.route !== last) {
      last = s.route;
      follow(s.route);
    }
    // A page in a tab went to the trash: close its tab.
    if (s.pages !== lastPages) {
      lastPages = s.pages;
      const keep = state.tabs.filter(valid);
      if (keep.length !== state.tabs.length) {
        const cur = state.tabs[state.active];
        const idx = cur ? keep.findIndex((t) => same(t, cur)) : -1;
        set({ tabs: keep, active: idx });
      }
    }
  });
}

export const tabs = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Open a view in a tab of its own. */
  openInNewTab(route: Route) {
    nextInNewTab = true;
    store.navigate(route);
    nextInNewTab = false;
  },
  /** The next navigation opens a new tab (used by "New page" and the + button). */
  nextInNewTab() {
    nextInNewTab = true;
  },
  activate(i: number) {
    const r = state.tabs[i];
    if (r) store.navigate(r);
  },
  close(i: number) {
    const list = state.tabs.filter((_, j) => j !== i);
    if (i !== state.active) {
      set({ tabs: list, active: state.active > i ? state.active - 1 : state.active });
      return;
    }
    const next = list[Math.min(i, list.length - 1)];
    set({ tabs: list, active: next ? Math.min(i, list.length - 1) : -1 });
    store.navigate(next ?? { name: "home" });
  },
  closeOthers(i: number) {
    const keep = state.tabs[i];
    if (!keep) return;
    set({ tabs: [keep], active: 0 });
    store.navigate(keep);
  },
};

export function useTabs<T>(select: (s: TabsState) => T): T {
  return useSyncExternalStore(tabs.subscribe, () => select(state), () => select(state));
}

/** True when a click should open in a new tab (⌘/Ctrl-click or middle-click). */
export const wantsNewTab = (e: { metaKey?: boolean; ctrlKey?: boolean; button?: number }) => !!(e.metaKey || e.ctrlKey || e.button === 1);
