// Design tokens for Dovli's "Liquid Glass" look (E2 on the design canvas).
// Plain numbers and strings, so the same values work in CSS on the web and in React Native styles.

export const color = {
  /** The page itself stays solid so text is always easy to read. */
  paper: "#FFFFFF",
  paperSubtle: "#F3F4F8",
  ink: "#121420",
  inkSoft: "#2B2E3D",
  inkMuted: "#5D6173",
  inkFaint: "#7A7E8F",
  line: "#E6E7EE",
  accent: "#6C5CE7",
  /** The colourful cover that sits behind the floating glass controls. */
  cover: "#1C2A6B",
  coverGlow: "#FFB36B",
  /** Light glass, for controls that float over the page. */
  glassLight: "rgba(255,255,255,0.72)",
  glassLightEdge: "rgba(255,255,255,0.95)",
  /** Clear glass, for controls that float over the cover. */
  glassClear: "rgba(255,255,255,0.18)",
  glassClearEdge: "rgba(255,255,255,0.6)",
  onGlassClear: "#FFFFFF",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, sheet: 30, pill: 999 } as const;

export const font = {
  family: "Plus Jakarta Sans",
  size: { caption: 12.5, body: 16, bodyLarge: 17, h2: 21, h1: 46, h1Phone: 30 },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700", heavy: "800" },
} as const;

/** Smallest size for anything you tap. */
export const touchTarget = 44;

export const tokens = { color, space, radius, font, touchTarget } as const;
export type Tokens = typeof tokens;
