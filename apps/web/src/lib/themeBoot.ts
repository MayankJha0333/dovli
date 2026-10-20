// The tiny script that picks the saved theme before the first paint (no flash of the wrong theme).
// No React here: the root layout (a server component) imports it.

import { DEFAULT_THEME, DEFAULT_THEME_PREFERENCE, SYSTEM_DARK_THEME, SYSTEM_LIGHT_THEME } from "@dovli/theme";

export type TextSize = "small" | "default" | "large" | "larger";

export const SETTINGS_KEY = "dovli.settings.v1";

export const TEXT_SCALE: Record<TextSize, string> = { small: "93.75%", default: "100%", large: "112.5%", larger: "125%" };

/**
 * The tiny script that runs before the page paints. It must stay plain JavaScript in a string,
 * and must agree with applySettings() in settings.ts.
 */
export function themeBootScript(themes: Record<string, { scheme: string; bg: string }>) {
  return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}");var t=${JSON.stringify(themes)};var p=s.theme||${JSON.stringify(DEFAULT_THEME_PREFERENCE)};var d=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var id=p==="system"?(d?${JSON.stringify(SYSTEM_DARK_THEME)}:${JSON.stringify(SYSTEM_LIGHT_THEME)}):(t[p]?p:${JSON.stringify(DEFAULT_THEME)});var r=document.documentElement;r.dataset.theme=id;r.dataset.scheme=t[id].scheme;r.style.colorScheme=t[id].scheme;var sc=${JSON.stringify(TEXT_SCALE)};if(sc[s.textSize])r.style.setProperty("--d-text-scale",sc[s.textSize]);if(s.reduceMotion)r.dataset.reduceMotion="true";}catch(e){}})();`;
}
