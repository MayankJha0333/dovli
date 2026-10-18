// Preferences for this browser: theme, text size, motion. Saved in localStorage (they are tiny and
// must be read before the first paint, so the right theme shows with no flash).

import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  getTheme,
  isThemePreference,
  resolveTheme,
  type ThemeId,
  type ThemePreference,
} from "@dovli/theme";

import { SETTINGS_KEY, TEXT_SCALE, type TextSize } from "./themeBoot";

export { SETTINGS_KEY, TEXT_SCALE, type TextSize };

export interface Settings {
  theme: ThemePreference;
  textSize: TextSize;
  reduceMotion: boolean;
  /** Show the right-hand panel with the outline and backlinks on wide screens. */
  showPageInfo: boolean;
  spellcheck: boolean;
}


export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME,
  textSize: "default",
  reduceMotion: false,
  showPageInfo: true,
  spellcheck: true,
};


function read(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      theme: isThemePreference(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
      textSize: raw.textSize in TEXT_SCALE ? raw.textSize : "default",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let state: Settings = typeof window === "undefined" ? DEFAULT_SETTINGS : read();
const listeners = new Set<() => void>();

const deviceDark = () => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
};

/** Put the chosen theme, text size and motion setting on <html>. */
export function applySettings(s: Settings = state) {
  const root = document.documentElement;
  const id: ThemeId = resolveTheme(s.theme, deviceDark());
  const theme = getTheme(id);
  root.dataset.theme = id;
  root.dataset.scheme = theme.scheme;
  root.dataset.reduceMotion = String(s.reduceMotion);
  root.style.setProperty("--d-text-scale", TEXT_SCALE[s.textSize]);
  root.style.colorScheme = theme.scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.colors.bg);
}

export const settings = {
  get: () => state,
  set(patch: Partial<Settings>) {
    state = { ...state, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
    } catch {
      /* private mode: still applies for this visit */
    }
    applySettings(state);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

if (typeof window !== "undefined") {
  // Follow the device when the theme is "Match device".
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (state.theme === "system") {
      applySettings(state);
      listeners.forEach((l) => l());
    }
  });
  // Another tab changed a setting.
  window.addEventListener("storage", (e) => {
    if (e.key === SETTINGS_KEY) {
      state = read();
      applySettings(state);
      listeners.forEach((l) => l());
    }
  });
}

export function useSettings<T>(select: (s: Settings) => T): T {
  return useSyncExternalStore(settings.subscribe, () => select(state), () => select(DEFAULT_SETTINGS));
}

/** The theme on screen right now (resolves "Match device"). */
export function useActiveTheme(): ThemeId {
  const pref = useSettings((s) => s.theme);
  useSyncExternalStore(
    (l) => {
      const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
      mq?.addEventListener?.("change", l);
      return () => mq?.removeEventListener?.("change", l);
    },
    deviceDark,
    () => false,
  );
  return resolveTheme(pref, typeof window === "undefined" ? false : deviceDark());
}
