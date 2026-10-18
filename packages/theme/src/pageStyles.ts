// Page styles: a backdrop behind the page, plus paper, ink, accent and title font.
// All artwork is drawn with CSS gradients and tiny inline SVGs, so styles cost no downloads.

export type TitleFont = "serif" | "italic" | "sans" | "mono" | "display";

export interface PageStyle {
  id: string;
  name: string;
  /** Words people might search for. */
  tags: string;
  backdrop: string;
  paper: string;
  ink: string;
  accent: string;
  title: TitleFont;
  /** True when the paper is dark, so the editor switches to its dark theme. */
  dark?: boolean;
}

const svg = (body: string, w: number, h: number, extra = "") =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' ${extra}>${body}</svg>`,
  )}")`;

/** A simple five-petal flower, used by Marigold. */
function flower(cx: number, cy: number, r: number, petal: string, heart: string) {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    const x = cx + Math.sin(a) * r;
    const y = cy - Math.cos(a) * r;
    out += `<ellipse cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' rx='${(r * 0.55).toFixed(1)}' ry='${(r * 0.9).toFixed(1)}' transform='rotate(${i * 72} ${x.toFixed(1)} ${y.toFixed(1)})' fill='${petal}'/>`;
  }
  return out + `<circle cx='${cx}' cy='${cy}' r='${(r * 0.45).toFixed(1)}' fill='${heart}'/>`;
}

const stars = svg(
  `<g fill='#fff'><circle cx='12' cy='18' r='1.1' opacity='.8'/><circle cx='70' cy='40' r='.8' opacity='.55'/><circle cx='112' cy='12' r='1.3' opacity='.9'/><circle cx='34' cy='96' r='.9' opacity='.5'/><circle cx='98' cy='90' r='1' opacity='.7'/><circle cx='130' cy='124' r='.7' opacity='.5'/><circle cx='56' cy='132' r='1.2' opacity='.8'/><path d='M88 58l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z' opacity='.85'/></g>`,
  140,
  140,
);

const rain = svg(
  `<g stroke='#fff' stroke-opacity='.3' stroke-width='1.3' stroke-linecap='round'><path d='M12 4 8 16M42 18l-4 12M26 38l-4 12M56 44l-4 12'/></g>`,
  60,
  60,
);

const petals = svg(
  flower(30, 30, 9, "#ffe08a", "#d9560f") + flower(78, 74, 7, "#ffc94d", "#c4460a") + flower(84, 20, 4, "#fff1c2", "#e06a12"),
  100,
  100,
  "opacity='0.75'",
);

const leaves = svg(
  `<g fill='#8fa67f' opacity='.55'><ellipse cx='20' cy='24' rx='6' ry='15' transform='rotate(-35 20 24)'/><ellipse cx='64' cy='18' rx='5' ry='12' transform='rotate(28 64 18)'/><ellipse cx='48' cy='66' rx='7' ry='17' transform='rotate(-12 48 66)'/><ellipse cx='88' cy='70' rx='5' ry='13' transform='rotate(40 88 70)'/></g><g stroke='#6f8a60' stroke-width='1' opacity='.45' fill='none'><path d='M20 39C21 30 20 16 20 9M48 83c1-8 0-26 0-34'/></g>`,
  100,
  100,
);

const hills = svg(
  `<path d='M0 70C60 40 110 60 170 52s120-40 230-10v78H0z' fill='#5c5aa3' opacity='.55'/><path d='M0 92c80-30 150-8 220-18s120-20 180 0v46H0z' fill='#3f3d82' opacity='.8'/>`,
  400,
  120,
  "preserveAspectRatio='none'",
);

const speckles = svg(
  `<g><circle cx='14' cy='20' r='3' fill='#d9744a'/><circle cx='62' cy='12' r='2' fill='#5b8f7b'/><rect x='38' y='44' width='7' height='5' rx='1.5' transform='rotate(24 41 46)' fill='#e3b23c'/><circle cx='86' cy='58' r='3.5' fill='#3e6aa8'/><rect x='12' y='76' width='6' height='4' rx='1.2' transform='rotate(-30 15 78)' fill='#5b8f7b'/><circle cx='54' cy='88' r='2.4' fill='#d9744a'/><circle cx='92' cy='96' r='1.6' fill='#8a7f74'/><circle cx='30' cy='56' r='1.4' fill='#8a7f74'/></g>`,
  100,
  100,
  "opacity='0.75'",
);

const ripples = svg(
  `<g fill='none' stroke='#fff' stroke-opacity='.18'><circle cx='60' cy='60' r='14'/><circle cx='60' cy='60' r='28'/><circle cx='60' cy='60' r='42'/><circle cx='0' cy='0' r='22'/><circle cx='120' cy='120' r='22'/></g>`,
  120,
  120,
);

const grain = svg(
  `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>`,
  160,
  160,
);

export const PAGE_STYLES: PageStyle[] = [
  {
    id: "paper",
    name: "Paper & Ink",
    tags: "minimal neutral grey grain classic",
    backdrop: `${grain}, linear-gradient(180deg, #ecebe7, #e2e0da)`,
    paper: "#fbfaf7",
    ink: "#1b1b1a",
    accent: "#2b2b2a",
    title: "serif",
  },
  {
    id: "cobalt",
    name: "Cobalt Night",
    tags: "blue stars sky night dark",
    backdrop: `${stars}, radial-gradient(circle at 78% 18%, rgba(140, 160, 255, 0.45), transparent 42%), linear-gradient(165deg, #2a3a8f, #141c52 60%, #0b1036)`,
    paper: "#f7f4ec",
    ink: "#18203f",
    accent: "#2f4fd8",
    title: "serif",
  },
  {
    id: "monsoon",
    name: "Monsoon",
    tags: "green teal rain calm water",
    backdrop: `${rain}, linear-gradient(165deg, #2f5d62, #5e8b7e 58%, #a7c4bc)`,
    paper: "#f3f7f5",
    ink: "#16302b",
    accent: "#2f7466",
    title: "sans",
  },
  {
    id: "marigold",
    name: "Marigold",
    tags: "orange yellow flowers warm festive",
    backdrop: `${petals}, linear-gradient(160deg, #f7b733, #ec7a1c)`,
    paper: "#fff8ec",
    ink: "#3a2208",
    accent: "#c45700",
    title: "serif",
  },
  {
    id: "sage",
    name: "Sage Garden",
    tags: "green leaves nature soft plant",
    backdrop: `${leaves}, linear-gradient(170deg, #d7e2cf, #bccbb0)`,
    paper: "#f8f9f3",
    ink: "#25301f",
    accent: "#4d6b37",
    title: "italic",
  },
  {
    id: "blueprint",
    name: "Blueprint",
    tags: "grid blue technical engineering plan",
    backdrop:
      "linear-gradient(rgba(255,255,255,.22) 1px, transparent 1px) 0 0 / 120px 120px, linear-gradient(90deg, rgba(255,255,255,.22) 1px, transparent 1px) 0 0 / 120px 120px, linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px) 0 0 / 24px 24px, #1f4e8c",
    paper: "#ffffff",
    ink: "#12233d",
    accent: "#1f5fbf",
    title: "mono",
  },
  {
    id: "dusk",
    name: "Dusk",
    tags: "pink purple sunset evening hills",
    backdrop: `${hills} bottom / 100% 40% no-repeat, radial-gradient(circle at 70% 34%, #ffe3b0 0 7%, transparent 7.5%), radial-gradient(circle at 70% 34%, rgba(255, 196, 150, 0.7), transparent 38%), linear-gradient(180deg, #f6b19c, #c67fb5 55%, #6a64b0)`,
    paper: "#fff7f3",
    ink: "#2d1b2e",
    accent: "#b2477a",
    title: "serif",
  },
  {
    id: "sunrise",
    name: "Morning Sky",
    tags: "blue light sky clouds fresh",
    backdrop:
      "radial-gradient(ellipse 22% 9% at 24% 28%, rgba(255,255,255,.9), transparent 70%), radial-gradient(ellipse 30% 10% at 30% 31%, rgba(255,255,255,.7), transparent 70%), radial-gradient(ellipse 26% 8% at 78% 64%, rgba(255,255,255,.85), transparent 70%), linear-gradient(180deg, #a9d3f2, #dcebf5 60%, #f7ead9)",
    paper: "#ffffff",
    ink: "#1b2a37",
    accent: "#2a78b8",
    title: "sans",
  },
  {
    id: "inkwash",
    name: "Ink Wash",
    tags: "grey black watercolor calm monochrome",
    backdrop:
      "radial-gradient(ellipse at 18% 22%, rgba(40,40,40,.28), transparent 38%), radial-gradient(ellipse at 82% 70%, rgba(40,40,40,.22), transparent 42%), radial-gradient(ellipse at 60% 20%, rgba(90,90,90,.16), transparent 30%), #ecebe8",
    paper: "#fdfdfb",
    ink: "#141414",
    accent: "#3c3c3c",
    title: "italic",
  },
  {
    id: "linen",
    name: "Linen",
    tags: "beige brown warm fabric book",
    backdrop:
      "repeating-linear-gradient(0deg, rgba(120,90,50,.07) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgba(120,90,50,.06) 0 1px, transparent 1px 5px), linear-gradient(170deg, #e9dfcd, #d9cab0)",
    paper: "#fbf7ef",
    ink: "#3a2e21",
    accent: "#8a5a2b",
    title: "serif",
  },
  {
    id: "halftone",
    name: "Halftone",
    tags: "yellow pink dots bold playful print",
    backdrop:
      "radial-gradient(circle at 80% 22%, #ff5d8f 0 13%, transparent 13.5%), radial-gradient(#ef3f73 1.7px, transparent 2px) 0 0 / 12px 12px, #ffd84d",
    paper: "#fffdf4",
    ink: "#1d1d1d",
    accent: "#df2e66",
    title: "display",
  },
  {
    id: "terrazzo",
    name: "Terrazzo",
    tags: "speckle stone colourful warm cream",
    backdrop: `${speckles}, #efe7dc`,
    paper: "#fffdf9",
    ink: "#2a2622",
    accent: "#c2603a",
    title: "serif",
  },
  {
    id: "lagoon",
    name: "Lagoon",
    tags: "turquoise teal water sea blue calm",
    backdrop: `${ripples}, radial-gradient(ellipse at 30% 20%, #5fd3c9, transparent 55%), linear-gradient(170deg, #1aa6a6, #0b5d6b)`,
    paper: "#f4fbfb",
    ink: "#0e2e33",
    accent: "#0c8a8a",
    title: "sans",
  },
  {
    id: "graphite",
    name: "Graphite",
    tags: "dark grey charcoal code focus mono",
    backdrop:
      "repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 2px, transparent 2px 10px), linear-gradient(180deg, #2a2b30, #1a1b1f)",
    paper: "#1f2025",
    ink: "#e9e9ec",
    accent: "#f2b33d",
    title: "mono",
    dark: true,
  },
  {
    id: "midnight",
    name: "Midnight",
    tags: "dark black aurora night focus",
    backdrop:
      "radial-gradient(ellipse at 20% 10%, rgba(64, 210, 170, 0.35), transparent 45%), radial-gradient(ellipse at 85% 30%, rgba(140, 90, 230, 0.35), transparent 45%), linear-gradient(180deg, #0b0d14, #05060a)",
    paper: "#16171d",
    ink: "#eceef4",
    accent: "#6fe0c0",
    title: "sans",
    dark: true,
  },
];

export function getStyle(id: string | undefined | null): PageStyle | null {
  if (!id) return null;
  return PAGE_STYLES.find((s) => s.id === id) ?? null;
}

const SERIF = '"Newsreader", "Iowan Old Style", Georgia, serif';

/** Title fonts. Sans and mono follow the app theme's own faces. */
const FONTS: Record<TitleFont, { family: string; style: string; weight: number }> = {
  serif: { family: SERIF, style: "normal", weight: 500 },
  italic: { family: SERIF, style: "italic", weight: 500 },
  sans: { family: "var(--d-font-sans)", style: "normal", weight: 700 },
  mono: { family: "var(--d-font-mono)", style: "normal", weight: 500 },
  display: { family: "var(--d-font-display)", style: "normal", weight: 800 },
};

/** CSS custom properties that dress a page (or a preview of one) in a style, as a plain object for React's style prop. */
export type StyleVars = Record<string, string>;

export function styleVars(s: PageStyle): StyleVars {
  const f = FONTS[s.title];
  return {
    "--s-backdrop": s.backdrop,
    "--s-paper": s.paper,
    "--s-ink": s.ink,
    "--s-accent": s.accent,
    "--title-font": f.family,
    "--title-style": f.style,
    "--title-weight": String(f.weight),
    colorScheme: s.dark ? "dark" : "light",
  };
}
