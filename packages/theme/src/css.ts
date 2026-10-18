// Turns app themes into CSS variables for the web app.
// The web app puts themeStylesheet() in a <style> tag, sets <html data-theme="…">, and Tailwind maps
// its colour, font, radius and shadow utilities onto these variables (see apps/web globals.css).

import { APP_THEMES, DEFAULT_THEME, getTheme, type AppTheme } from "./appThemes";

const px = (n: number) => `${n}px`;
const glass = (blur: number) => (blur > 0 ? `blur(${blur}px) saturate(1.5)` : "none");

/** Every token as a CSS custom property, named --d-*. */
export function themeVariables(t: AppTheme): Record<string, string> {
  const c = t.colors;
  const glow = (i: number) => t.colors.glows[i];
  const vars: Record<string, string> = {
    "color-scheme": t.scheme,
    "--d-bg": c.bg,
    "--d-sidebar": c.sidebar,
    "--d-panel": c.panel,
    "--d-sheet": c.sheet,
    "--d-raised": c.raised,
    "--d-well": c.well,
    "--d-hover": c.hover,
    "--d-active-bg": c.activeBg,
    "--d-active-ink": c.activeInk,
    "--d-line": c.line,
    "--d-line-strong": c.lineStrong,
    "--d-ink": c.ink,
    "--d-ink-2": c.ink2,
    "--d-ink-3": c.ink3,
    "--d-ink-4": c.ink4,
    "--d-accent": c.accent,
    "--d-accent-hover": c.accentHover,
    "--d-accent-ink": c.accentInk,
    "--d-accent-soft": c.accentSoft,
    "--d-primary": c.primary,
    "--d-primary-hover": c.primaryHover,
    "--d-primary-ink": c.primaryInk,
    "--d-brand": c.brand,
    "--d-brand-ink": c.brandInk,
    "--d-danger": c.danger,
    "--d-danger-soft": c.dangerSoft,
    "--d-ok": c.ok,
    "--d-warn": c.warn,
    "--d-selection": c.selection,
    "--d-overlay": c.overlay,
    "--d-sketch": c.sketch,
    "--d-glow-1": glow(0)?.color ?? "transparent",
    "--d-glow-1-o": String(glow(0)?.opacity ?? 0),
    "--d-glow-2": glow(1)?.color ?? "transparent",
    "--d-glow-2-o": String(glow(1)?.opacity ?? 0),
    "--d-glow-3": glow(2)?.color ?? "transparent",
    "--d-glow-3-o": String(glow(2)?.opacity ?? 0),
    "--d-font-sans": t.fonts.sans,
    "--d-font-display": t.fonts.display,
    "--d-font-mono": t.fonts.mono,
    "--d-display-weight": String(t.fonts.displayWeight),
    "--d-display-tracking": t.fonts.displayTracking,
    "--d-radius-sm": px(t.radius.sm),
    "--d-radius-md": px(t.radius.md),
    "--d-radius-lg": px(t.radius.lg),
    "--d-radius-xl": px(t.radius.xl),
    "--d-radius-shell": px(t.radius.shell),
    "--d-radius-sheet": px(t.radius.sheet),
    "--d-shadow-sm": t.shadow.sm,
    "--d-shadow-card": t.shadow.card,
    "--d-shadow-pop": t.shadow.pop,
    "--d-shadow-sheet": t.shadow.sheet,
    "--d-shadow-active": t.shadow.active,
    "--d-shadow-shell": t.shadow.shell,
    "--d-row": px(t.layout.rowHeight),
    "--d-blur-sidebar": px(t.blur.sidebar),
    "--d-blur-panel": px(t.blur.panel),
    "--d-blur-raised": px(t.blur.raised),
    "--d-blur-chrome": px(t.blur.chrome),
    /* Full backdrop filters per surface. "none" for solid surfaces, so nothing behind them is tinted. */
    "--d-filter-sidebar": glass(t.blur.sidebar),
    "--d-filter-panel": glass(t.blur.panel),
    "--d-filter-raised": glass(t.blur.raised),
    "--d-filter-chrome": glass(t.blur.chrome),
    "--d-shell-gap": px(t.layout.gap),
    "--d-divider": t.layout.divider ? `1px solid ${c.line}` : "0 solid transparent",
    "--d-label-font": t.layout.label === "mono" ? "var(--d-font-mono)" : "var(--d-font-sans)",
    "--d-label-transform": t.layout.label === "sentence" ? "none" : "uppercase",
    "--d-label-tracking": t.layout.label === "sentence" ? "0" : "0.07em",
    "--d-label-size": t.layout.label === "sentence" ? "0.78rem" : "0.68rem",
    /* Chips: the rounded groups holding the tabs and the top bar's buttons. */
    "--d-chip-bg": t.chip.bg,
    "--d-chip-shadow": t.chip.shadow,
    "--d-chip-radius": px(t.chip.radius),
  };
  return vars;
}

function block(selector: string, vars: Record<string, string>) {
  return `${selector}{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}

/** All themes as one stylesheet. The default theme also applies when no data-theme is set. */
export function themeStylesheet(): string {
  const def = getTheme(DEFAULT_THEME);
  const parts = [block(":root", themeVariables(def))];
  for (const t of APP_THEMES) parts.push(block(`:root[data-theme="${t.id}"]`, themeVariables(t)));
  return parts.join("\n");
}
