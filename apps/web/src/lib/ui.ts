// Which overlay is open (command palette, settings, share…). Kept outside React components so any
// part of the app, including the editor bridge, can open one.

import { useSyncExternalStore } from "react";
import type { AISelection } from "@dovli/editor";

export type SettingsSection = "appearance" | "account" | "sync" | "data" | "ai" | "privacy" | "shortcuts";

export interface UIState {
  palette: boolean;
  settings: SettingsSection | null;
  signIn: boolean;
  share: string | null;
  ai: (AISelection & { mode?: "edit" | "summary" | "review"; focus?: string; title?: string }) | null;
  picker: { title: string; exclude: string; resolve: (id: string | null) => void } | null;
  styleFor: string | null;
  /** The sidebar drawer on small screens. */
  nav: boolean;
  /** The page being presented full screen, if any. */
  presenting: string | null;
  /** What the sidebar shows: the workspace, or the open page (contents, to-dos, attachments, links). */
  sidebarMode: "space" | "page";
}

let state: UIState = { palette: false, settings: null, signIn: false, share: null, ai: null, picker: null, styleFor: null, nav: false, presenting: null, sidebarMode: "space" };
const listeners = new Set<() => void>();

// A page made with "New page" should put the cursor in its title, ready to type.
let titleFocusFor: string | null = null;
export const requestTitleFocus = (pageId: string) => {
  titleFocusFor = pageId;
};
/** True once for the page that asked for title focus. */
export const takeTitleFocus = (pageId: string) => {
  if (titleFocusFor !== pageId) return false;
  titleFocusFor = null;
  return true;
};

export const ui = {
  get: () => state,
  set(patch: Partial<UIState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Ask the person to pick a page. Resolves to its id, or null if they close the picker. */
  pickPage(title: string, exclude = ""): Promise<string | null> {
    return new Promise((resolve) => ui.set({ picker: { title, exclude, resolve } }));
  },
};

/** The editor of the page on screen, for actions that start outside it (summaries from the page menu, Find). */
let activeEditor: any = null;
let activeEditorPage: string | null = null;
const editorListeners = new Set<() => void>();
export const setActiveEditor = (e: any, pageId: string | null = null) => {
  activeEditor = e;
  activeEditorPage = e ? pageId : null;
  editorListeners.forEach((l) => l());
};
export const getActiveEditor = () => activeEditor;
/** The open page's editor and which page it belongs to; re-renders when the page on screen changes. */
export function useActiveEditor<T = any>(): { editor: T | null; pageId: string | null } {
  const editor = useSyncExternalStore(
    (l) => {
      editorListeners.add(l);
      return () => editorListeners.delete(l);
    },
    () => activeEditor,
    () => null,
  );
  return { editor, pageId: editor ? activeEditorPage : null };
}

export function useUI<T>(select: (s: UIState) => T): T {
  return useSyncExternalStore(ui.subscribe, () => select(state), () => select(state));
}

// Opening a page from the sidebar's page list keeps the list in view; opening it from anywhere
// else (Home, search, a link) switches the sidebar to the page's contents, like Craft.
let keepSpace = false;
export const keepSpaceSidebar = () => {
  keepSpace = true;
};
export const takeKeepSpace = () => {
  const k = keepSpace;
  keepSpace = false;
  return k;
};
