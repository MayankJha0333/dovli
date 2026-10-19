// Find and replace, the way Craft does it on the Mac: ⌘F opens a Find tab in the page side of the
// sidebar (Craft's "leftsidebar.findAndReplace"), not a bar over the text. This is its state, kept
// outside React so the page's ⌘F / ⌘G keys, the Info panel and the page menu can all reach it.

import { useSyncExternalStore } from "react";
import { clearMatches } from "@dovli/editor";
import { settings } from "./settings";
import { ui } from "./ui";

export type FindScope = "page" | "tree";

export interface FindState {
  open: boolean;
  query: string;
  replacement: string;
  showReplace: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  ignoreAccents: boolean;
  /** Only the open page, or the open page and every page inside it (Craft's "in document"). */
  scope: FindScope;
  /** Bumped to put the cursor back in the search box (⌘F while Find is already open). */
  focusTick: number;
  /** ⌘G / ⌘⇧G: a request for the next or previous match, handled by the Find tab. */
  step: { n: number; dir: 1 | -1 };
  /** Find showed a sidebar that was hidden, so closing Find hides it again. */
  showedSidebar: boolean;
}

let state: FindState = {
  open: false,
  query: "",
  replacement: "",
  showReplace: false,
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  ignoreAccents: true,
  scope: "page",
  focusTick: 0,
  step: { n: 0, dir: 1 },
  showedSidebar: false,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<FindState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const narrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches;

export const find = {
  get: () => state,
  set,
  /** Open Find in the sidebar (showing the sidebar if needed) and put the cursor in the search box. */
  show(query?: string) {
    const hidden = settings.get().sidebarHidden && !narrow();
    if (hidden) settings.set({ sidebarHidden: false });
    ui.set({ sidebarMode: "page", ...(narrow() ? { nav: true } : {}) });
    set({
      open: true,
      focusTick: state.focusTick + 1,
      showedSidebar: state.open ? state.showedSidebar : hidden,
      ...(query !== undefined ? { query } : {}),
    });
  },
  close() {
    if (!state.open) return;
    if (state.showedSidebar) settings.set({ sidebarHidden: true });
    clearMatches();
    set({ open: false, showedSidebar: false });
  },
  step(dir: 1 | -1) {
    set({ step: { n: state.step.n + 1, dir } });
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useFind<T>(select: (s: FindState) => T): T {
  return useSyncExternalStore(find.subscribe, () => select(state), () => select(state));
}
