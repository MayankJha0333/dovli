// The phone app's theme: the same four app themes as the web app, read straight from @dovli/theme.
// Soft Studio is the default; "Match device" follows the phone's light or dark mode.

import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { DEFAULT_THEME, getTheme, isThemePreference, resolveTheme, type AppTheme, type ThemePreference } from "@dovli/theme";
import { kv } from "./kv";

const KEY = "dovli.theme.v1";

let pref: ThemePreference = (() => {
  const saved = kv.get<string>(KEY, DEFAULT_THEME);
  return isThemePreference(saved) ? saved : DEFAULT_THEME;
})();
const listeners = new Set<() => void>();

export const themeStore = {
  get: () => pref,
  set(next: ThemePreference) {
    pref = next;
    kv.set(KEY, next);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.get);
}

/** The theme on screen now. Every screen reads colours, radii and fonts from this. */
export function useTheme(): AppTheme {
  const p = useThemePreference();
  const scheme = useColorScheme();
  return getTheme(resolveTheme(p, scheme === "dark"));
}

/**
 * Glass colours on the web use rgba over a blurred background. On the phone the main surfaces are
 * drawn solid (stacked on the theme background) so text is always readable; floating controls use
 * real Liquid Glass where the system offers it.
 */
export function solid(color: string, under: string): string {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const [r, g, b, a = "1"] = m[1].split(",").map((x) => x.trim());
  const alpha = Number(a);
  const hex = under.replace("#", "");
  const ur = parseInt(hex.slice(0, 2), 16);
  const ug = parseInt(hex.slice(2, 4), 16);
  const ub = parseInt(hex.slice(4, 6), 16);
  const mix = (c: string, u: number) => Math.round(Number(c) * alpha + u * (1 - alpha));
  return `rgb(${mix(r, ur)}, ${mix(g, ug)}, ${mix(b, ub)})`;
}
