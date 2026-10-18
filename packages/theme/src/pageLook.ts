// A page's final look: its page style (if any) plus the changes made in the Style panel
// (colours, font, dividers, width). Used by the web app, the shared page and the phone app.

import { getStyle, styleVars, type PageStyle, type StyleVars } from "./pageStyles";

export type PageFontId = "system" | "serif" | "mono" | "round";
export type DividerStyleId = "line" | "dots" | "wave";

/** The Style panel's changes, as saved on the page (same shape as PageLook in @dovli/core). */
export interface LookInput {
  backdrop?: string;
  paper?: string;
  ink?: string;
  accent?: string;
  font?: PageFontId;
  divider?: DividerStyleId;
  wide?: boolean;
}


/**
 * Page fonts, as in Craft: System (SF Pro on Apple devices), Serif (New York where the browser
 * allows, else Source Serif 4), Mono and Round. The stacks live in @dovli/ui styles.css (--d-doc-*).
 * `scale` evens out how big each face looks next to the system font.
 */
export const PAGE_FONTS: Record<PageFontId, { label: string; sample: string; family: string; titleWeight: number; scale: number }> = {
  system: { label: "System", sample: "Aa", family: "var(--d-doc-sans)", titleWeight: 700, scale: 1 },
  serif: { label: "Serif", sample: "Ss", family: "var(--d-doc-serif)", titleWeight: 700, scale: 1.04 },
  mono: { label: "Mono", sample: "00", family: "var(--d-doc-mono)", titleWeight: 600, scale: 0.92 },
  round: { label: "Round", sample: "Rr", family: "var(--d-doc-rounded)", titleWeight: 700, scale: 1 },
};

export const DIVIDER_STYLES: { id: DividerStyleId; label: string }[] = [
  { id: "line", label: "Line" },
  { id: "dots", label: "Dots" },
  { id: "wave", label: "Wave" },
];

/** Where custom colours start when the page has no style yet. */
export const PLAIN_BASE: PageStyle = {
  id: "custom",
  name: "Custom",
  tags: "",
  backdrop: "#e9ebf1",
  paper: "#ffffff",
  ink: "#15171d",
  accent: "#5146d9",
  title: "sans",
};

/** True when a #rrggbb colour is dark enough to need light text. */
export function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.36;
}

export interface ResolvedLook {
  /** The style to dress the page in, or null for the plain look (the app theme). */
  style: PageStyle | null;
  /** CSS variables for the page: the style's, plus the chosen font. Empty for a plain page. */
  vars: StyleVars;
  /** True when colours were changed in the Style panel. */
  customColors: boolean;
  divider: DividerStyleId;
  wide: boolean;
  font: PageFontId | null;
}

export function resolveLook(styleId: string | null | undefined, look: LookInput | null | undefined): ResolvedLook {
  const l = look ?? {};
  const base = getStyle(styleId);
  const customColors = !!(l.backdrop || l.paper || l.ink || l.accent);
  let style: PageStyle | null = base;
  if (customColors) {
    const from = base ?? PLAIN_BASE;
    const paper = l.paper ?? from.paper;
    style = {
      ...from,
      backdrop: l.backdrop ?? from.backdrop,
      paper,
      ink: l.ink ?? from.ink,
      accent: l.accent ?? from.accent,
      dark: l.paper ? isDarkColor(paper) : from.dark,
    };
  }
  const vars: StyleVars = style ? styleVars(style) : {};
  const font = l.font && PAGE_FONTS[l.font] ? l.font : null;
  if (font) {
    const f = PAGE_FONTS[font];
    vars["--page-font"] = f.family;
    vars["--title-font"] = f.family;
    vars["--title-style"] = "normal";
    vars["--title-weight"] = String(f.titleWeight);
    vars["--page-scale"] = String(f.scale);
  }
  return { style, vars, customColors, divider: l.divider ?? "line", wide: !!l.wide, font };
}

/** The name to show for a page's look, like "Midnight" or "Plain". */
export function lookName(r: ResolvedLook): string {
  if (!r.style) return "Plain";
  return r.customColors ? (r.style.id === "custom" ? "Custom colours" : `${r.style.name}, customised`) : r.style.name;
}
