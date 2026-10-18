// App themes: the look of Dovli's own interface (sidebar, menus, buttons, the page around your text).
// Page styles (pageStyles.ts) dress a single page; app themes dress the whole app.
//
// Every theme fills the same set of tokens, so components never check which theme is on.
// The web app turns these into CSS variables (css.ts); the phone app reads them directly.

export type ThemeId = "soft-studio" | "frost" | "night-desk" | "mica";

/** What people pick in Settings. "system" follows the device: Soft Studio by day, Night Desk at night. */
export type ThemePreference = ThemeId | "system";

export const DEFAULT_THEME: ThemeId = "soft-studio";
export const SYSTEM_LIGHT_THEME: ThemeId = "soft-studio";
export const SYSTEM_DARK_THEME: ThemeId = "night-desk";

export interface ThemeColors {
  /** The app background behind everything. */
  bg: string;
  /** Soft blurred colour blobs painted on the background (glass themes). Empty for none. */
  glows: { color: string; opacity: number }[];
  /** Sidebar surface. */
  sidebar: string;
  /** The main panel that holds the current view. */
  panel: string;
  /** The page's paper. Usually the same as the panel. */
  sheet: string;
  /** Menus, dialogs, popovers and other things that float. */
  raised: string;
  /** Quiet fills: inputs, chips, table headers. */
  well: string;
  hover: string;
  activeBg: string;
  activeInk: string;
  line: string;
  lineStrong: string;
  /** Text, from strongest to faintest. ink4 still passes 4.5:1 on the panel for small text. */
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  accent: string;
  accentHover: string;
  /** Text on top of the accent colour. */
  accentInk: string;
  accentSoft: string;
  /** The main call-to-action button ("New page"). */
  primary: string;
  primaryHover: string;
  primaryInk: string;
  /** The small logo tile. */
  brand: string;
  brandInk: string;
  danger: string;
  dangerSoft: string;
  ok: string;
  warn: string;
  selection: string;
  /** The dim layer behind dialogs. */
  overlay: string;
  /** Fills inside board sketches and diagrams. */
  sketch: string;
}

export interface AppTheme {
  id: ThemeId;
  name: string;
  /** One line for the theme picker. */
  description: string;
  scheme: "light" | "dark";
  colors: ThemeColors;
  fonts: {
    sans: string;
    display: string;
    mono: string;
    /** Weight and letter spacing for big titles. */
    displayWeight: number;
    displayTracking: string;
  };
  /** Pixel radii. */
  radius: { sm: number; md: number; lg: number; xl: number; shell: number; sheet: number };
  /** shell: the sidebar and main panel when they float as cards. */
  shadow: { sm: string; card: string; pop: string; sheet: string; active: string; shell: string };
  /** Background blur in px for each surface. 0 means solid. */
  blur: { sidebar: number; panel: number; raised: number; chrome: number };
  layout: {
    /** Space around and between the sidebar and the main panel. 0 = edge to edge. */
    gap: number;
    /** A hairline between sidebar and panel, used by flat themes. */
    divider: boolean;
    /** Section labels like "Pages": sentence case, or small caps in the mono font. */
    label: "sentence" | "upper" | "mono";
    /** The main panel's top bar sits on glass chips (true) or on a plain bar (false). */
    chips: boolean;
    /** Height of a row in the sidebar and menus, in px. Denser themes use shorter rows. */
    rowHeight: number;
  };
}

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO_STACK = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const softStudio: AppTheme = {
  id: "soft-studio",
  name: "Soft Studio",
  description: "Bright and friendly, with soft rounded cards",
  scheme: "light",
  colors: {
    bg: "#EDEFF4",
    glows: [],
    sidebar: "#FFFFFF",
    panel: "#FFFFFF",
    sheet: "#FFFFFF",
    raised: "#FFFFFF",
    well: "#F4F5F9",
    hover: "#F2F3F7",
    activeBg: "#ECEBFC",
    activeInk: "#5146D9",
    line: "#E7E9EF",
    lineStrong: "#D6D9E1",
    ink: "#15171D",
    ink2: "#464B58",
    ink3: "#606675",
    ink4: "#6E7382",
    accent: "#5146D9",
    accentHover: "#4338C7",
    accentInk: "#FFFFFF",
    accentSoft: "#ECEBFC",
    primary: "#5146D9",
    primaryHover: "#4338C7",
    primaryInk: "#FFFFFF",
    brand: "#5146D9",
    brandInk: "#FFFFFF",
    danger: "#D0364A",
    dangerSoft: "#FCEBEE",
    ok: "#1F9D6B",
    warn: "#C2610F",
    selection: "rgba(81, 70, 217, 0.18)",
    overlay: "rgba(21, 23, 29, 0.32)",
    sketch: "#E3E1FB",
  },
  fonts: {
    sans: `"Figtree", ${FONT_STACK}`,
    display: `"Bricolage Grotesque", "Figtree", ${FONT_STACK}`,
    mono: `"Geist Mono", ${MONO_STACK}`,
    displayWeight: 700,
    displayTracking: "-0.03em",
  },
  radius: { sm: 8, md: 12, lg: 18, xl: 22, shell: 20, sheet: 28 },
  shadow: {
    sm: "0 0 0 1px rgba(21,23,29,0.05), 0 1px 2px rgba(21,23,29,0.05)",
    card: "0 0 0 1px rgba(21,23,29,0.05), 0 2px 6px rgba(21,23,29,0.04), 0 12px 28px rgba(21,23,29,0.07)",
    pop: "0 0 0 1px rgba(21,23,29,0.06), 0 8px 20px rgba(21,23,29,0.08), 0 24px 56px rgba(21,23,29,0.14)",
    sheet: "0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 60px rgba(10,14,40,0.28)",
    active: "none",
    shell: "0 1px 2px rgba(21,23,29,0.05), 0 0 0 1px rgba(21,23,29,0.04)",
  },
  blur: { sidebar: 0, panel: 0, raised: 0, chrome: 12 },
  layout: { gap: 12, divider: false, label: "sentence", chips: true, rowHeight: 38 },
};

export const frost: AppTheme = {
  id: "frost",
  name: "Frost",
  description: "Light frosted glass over soft colour",
  scheme: "light",
  colors: {
    bg: "#EDF0F7",
    glows: [
      { color: "#9DB7FF", opacity: 0.85 },
      { color: "#FFC2DA", opacity: 0.8 },
      { color: "#AEEFD9", opacity: 0.8 },
    ],
    sidebar: "rgba(255, 255, 255, 0.46)",
    panel: "rgba(255, 255, 255, 0.62)",
    sheet: "transparent",
    raised: "rgba(255, 255, 255, 0.86)",
    well: "rgba(20, 23, 38, 0.05)",
    hover: "rgba(255, 255, 255, 0.6)",
    activeBg: "rgba(255, 255, 255, 0.88)",
    activeInk: "#141726",
    line: "rgba(20, 23, 38, 0.08)",
    lineStrong: "rgba(20, 23, 38, 0.15)",
    ink: "#141726",
    ink2: "#3F4458",
    ink3: "#535970",
    ink4: "#5F6479",
    accent: "#3D5BF5",
    accentHover: "#2F4BE0",
    accentInk: "#FFFFFF",
    accentSoft: "rgba(61, 91, 245, 0.10)",
    primary: "#141726",
    primaryHover: "#272B40",
    primaryInk: "#FFFFFF",
    brand: "#141726",
    brandInk: "#FFFFFF",
    danger: "#C9324D",
    dangerSoft: "rgba(201, 50, 77, 0.10)",
    ok: "#138A72",
    warn: "#B6560F",
    selection: "rgba(61, 91, 245, 0.18)",
    overlay: "rgba(40, 46, 80, 0.22)",
    sketch: "rgba(61, 91, 245, 0.14)",
  },
  fonts: {
    sans: `"Onest", ${FONT_STACK}`,
    display: `"Onest", ${FONT_STACK}`,
    mono: `"Geist Mono", ${MONO_STACK}`,
    displayWeight: 800,
    displayTracking: "-0.035em",
  },
  radius: { sm: 9, md: 12, lg: 20, xl: 24, shell: 24, sheet: 30 },
  shadow: {
    sm: "0 2px 8px rgba(50,60,110,0.08), inset 0 0 0 1px rgba(255,255,255,0.9)",
    card: "0 6px 18px rgba(50,60,110,0.08), inset 0 0 0 1px rgba(255,255,255,1)",
    pop: "0 24px 60px rgba(50,60,110,0.18), inset 0 0 0 1px rgba(255,255,255,0.9)",
    sheet: "0 30px 70px rgba(50,60,110,0.16), inset 0 0 0 1px rgba(255,255,255,0.9)",
    active: "0 2px 8px rgba(50,60,110,0.08), inset 0 0 0 1px rgba(255,255,255,1)",
    shell: "0 18px 44px rgba(50,60,110,0.12), inset 0 0 0 1px rgba(255,255,255,0.75)",
  },
  blur: { sidebar: 24, panel: 28, raised: 24, chrome: 20 },
  layout: { gap: 16, divider: false, label: "sentence", chips: true, rowHeight: 36 },
};

export const nightDesk: AppTheme = {
  id: "night-desk",
  name: "Night Desk",
  description: "Dark and focused, made for long sessions",
  scheme: "dark",
  colors: {
    bg: "#0E0F12",
    glows: [],
    sidebar: "#131418",
    panel: "#0E0F12",
    sheet: "#0E0F12",
    raised: "#17191D",
    well: "#16181C",
    hover: "#1C1E23",
    activeBg: "#1E2026",
    activeInk: "#FFFFFF",
    line: "#1F2126",
    lineStrong: "#2C2E35",
    ink: "#EDEEF0",
    ink2: "#B0B3BA",
    ink3: "#9296A0",
    ink4: "#8A8E97",
    accent: "#C8F25A",
    accentHover: "#D6F77E",
    accentInk: "#0E0F12",
    accentSoft: "rgba(200, 242, 90, 0.12)",
    primary: "#C8F25A",
    primaryHover: "#D6F77E",
    primaryInk: "#0E0F12",
    brand: "#C8F25A",
    brandInk: "#0E0F12",
    danger: "#FF7A7A",
    dangerSoft: "rgba(255, 122, 122, 0.12)",
    ok: "#6FE0C0",
    warn: "#F2B33D",
    selection: "rgba(200, 242, 90, 0.22)",
    overlay: "rgba(0, 0, 0, 0.55)",
    sketch: "rgba(200, 242, 90, 0.14)",
  },
  fonts: {
    sans: `"Geist", ${FONT_STACK}`,
    display: `"Geist", ${FONT_STACK}`,
    mono: `"Geist Mono", ${MONO_STACK}`,
    displayWeight: 600,
    displayTracking: "-0.035em",
  },
  radius: { sm: 5, md: 7, lg: 10, xl: 12, shell: 0, sheet: 14 },
  shadow: {
    sm: "0 0 0 1px #24262C",
    card: "0 0 0 1px #24262C",
    pop: "0 0 0 1px #2C2E35, 0 16px 40px rgba(0,0,0,0.5)",
    sheet: "0 0 0 1px #24262C, 0 30px 80px rgba(0,0,0,0.45)",
    active: "none",
    shell: "none",
  },
  blur: { sidebar: 0, panel: 0, raised: 0, chrome: 0 },
  layout: { gap: 0, divider: true, label: "mono", chips: false, rowHeight: 30 },
};

export const mica: AppTheme = {
  id: "mica",
  name: "Mica",
  description: "Calm dark violet, with glass only on pop-ups",
  scheme: "dark",
  colors: {
    bg: "#120F1E",
    glows: [
      { color: "#B3A6FF", opacity: 0.45 },
      { color: "#2C8C9E", opacity: 0.35 },
    ],
    sidebar: "rgba(22, 19, 34, 0.80)",
    panel: "rgba(18, 16, 28, 0.90)",
    sheet: "transparent",
    raised: "rgba(40, 35, 60, 0.72)",
    well: "rgba(255, 255, 255, 0.05)",
    hover: "rgba(255, 255, 255, 0.06)",
    activeBg: "rgba(255, 255, 255, 0.08)",
    activeInk: "#FFFFFF",
    line: "rgba(255, 255, 255, 0.07)",
    lineStrong: "rgba(255, 255, 255, 0.13)",
    ink: "#F1EFF7",
    ink2: "#C6C1D6",
    ink3: "#A9A3BC",
    ink4: "#9C96B0",
    accent: "#B3A6FF",
    accentHover: "#C4BAFF",
    accentInk: "#120F1E",
    accentSoft: "rgba(179, 166, 255, 0.14)",
    primary: "#B3A6FF",
    primaryHover: "#C4BAFF",
    primaryInk: "#120F1E",
    brand: "#B3A6FF",
    brandInk: "#120F1E",
    danger: "#FF8A8A",
    dangerSoft: "rgba(255, 138, 138, 0.12)",
    ok: "#7FD8E6",
    warn: "#F4B38A",
    selection: "rgba(179, 166, 255, 0.28)",
    overlay: "rgba(6, 5, 12, 0.5)",
    sketch: "rgba(179, 166, 255, 0.16)",
  },
  fonts: {
    sans: `"Manrope", ${FONT_STACK}`,
    display: `"Manrope", ${FONT_STACK}`,
    mono: `"Geist Mono", ${MONO_STACK}`,
    displayWeight: 800,
    displayTracking: "-0.03em",
  },
  radius: { sm: 7, md: 8, lg: 14, xl: 18, shell: 0, sheet: 18 },
  shadow: {
    sm: "inset 0 0 0 1px rgba(255,255,255,0.08)",
    card: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.25)",
    pop: "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.5)",
    sheet: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.45)",
    active: "inset 2px 0 0 #B3A6FF",
    shell: "none",
  },
  blur: { sidebar: 0, panel: 0, raised: 18, chrome: 0 },
  layout: { gap: 0, divider: true, label: "upper", chips: false, rowHeight: 34 },
};

export const APP_THEMES: AppTheme[] = [softStudio, frost, nightDesk, mica];

export function getTheme(id: string | null | undefined): AppTheme {
  return APP_THEMES.find((t) => t.id === id) ?? softStudio;
}

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === "system" || APP_THEMES.some((t) => t.id === v);
}

/** The theme to show for a preference, given whether the device is in dark mode. */
export function resolveTheme(pref: ThemePreference | null | undefined, deviceDark: boolean): ThemeId {
  if (pref === "system") return deviceDark ? SYSTEM_DARK_THEME : SYSTEM_LIGHT_THEME;
  return isThemePreference(pref) ? pref : DEFAULT_THEME;
}

/** Google Fonts used by the themes and page styles, in one stylesheet. Files load only when used. */
export const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Figtree:wght@400;500;600;700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Onest:wght@400;500;600;700;800&display=swap";
