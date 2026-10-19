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

/** A fine, uneven scatter of stars (Starlight): two tiles of different sizes, so no grid shows. */
function starDust(count: number, size: number, seed: number) {
  let x = seed;
  const rand = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  let out = "";
  for (let i = 0; i < count; i++) {
    const r = 0.35 + rand() ** 2.2 * 1.05;
    out += `<circle cx='${(rand() * size).toFixed(1)}' cy='${(rand() * size).toFixed(1)}' r='${r.toFixed(2)}' opacity='${(0.25 + rand() * 0.6).toFixed(2)}'/>`;
  }
  return svg(`<g fill='#fff'>${out}</g>`, size, size);
}
const dust = `${starDust(46, 263, 7)}, ${starDust(28, 181, 4219)}`;

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

const blossoms = svg(
  flower(24, 26, 7, "#ffd1e0", "#f28fb1") +
    flower(74, 68, 5.5, "#ffe3ec", "#ee7ca3") +
    flower(82, 18, 3.5, "#fff0f5", "#f5a3bf") +
    `<g fill='#ffc2d6' opacity='.8'><ellipse cx='52' cy='40' rx='2.6' ry='4.2' transform='rotate(35 52 40)'/><ellipse cx='16' cy='78' rx='2.2' ry='3.6' transform='rotate(-25 16 78)'/><ellipse cx='92' cy='92' rx='2' ry='3.2' transform='rotate(60 92 92)'/></g>`,
  100,
  100,
  "opacity='0.9'",
);

const dunes = svg(
  `<path d='M0 60C70 30 130 44 200 56s130 2 200-24v108H0z' fill='#eab47a'/><path d='M0 86C90 58 160 70 240 84s110 0 160-14v70H0z' fill='#d98c52'/><path d='M0 112c100-22 170-10 250 0s110 4 150-6v34H0z' fill='#b8643a'/>`,
  400,
  140,
  "preserveAspectRatio='none'",
);

/** A row of pines: tall and short, two shades for depth. */
function pineRow(base: number, fill: string, opacity: number, seed: number) {
  let out = "";
  let x = -10 + (seed % 17);
  let i = seed;
  while (x < 410) {
    const h = 44 + ((i * 37) % 38);
    const w = h * 0.42;
    out += `<path d='M${x} ${base}L${(x + w / 2).toFixed(1)} ${base - h}L${(x + w).toFixed(1)} ${base}z'/>`;
    x += w * 0.72 + ((i * 13) % 9);
    i++;
  }
  return `<g fill='${fill}' opacity='${opacity}'>${out}</g>`;
}
const pines = svg(pineRow(120, "#4f7d63", 0.45, 3) + pineRow(120, "#2d5442", 0.85, 11) + `<rect y='118' width='400' height='2' fill='#2d5442'/>`, 400, 120, "preserveAspectRatio='none'");

const synthSun = svg(
  `<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffd36b'/><stop offset='1' stop-color='#ff4fa3'/></linearGradient></defs><circle cx='200' cy='150' r='70' fill='url(#s)'/><g fill='#2a1150'><rect x='120' y='166' width='160' height='4'/><rect x='120' y='180' width='160' height='6'/><rect x='120' y='196' width='160' height='9'/></g><rect y='210' width='400' height='90' fill='#2a1150'/><g stroke='#ff4fa3' stroke-opacity='.6' stroke-width='1.2' fill='none'><path d='M0 220H400M0 234H400M0 254H400M0 284H400'/><path d='M200 210L200 300M200 210L130 300M200 210L50 300M200 210L-40 300M200 210L270 300M200 210L350 300M200 210L440 300'/></g>`,
  400,
  300,
  "preserveAspectRatio='xMidYMax slice'",
);

const beans = svg(
  [
    [18, 22, 30],
    [64, 16, -20],
    [42, 56, 70],
    [86, 58, 15],
    [20, 88, -40],
    [70, 94, 50],
  ]
    .map(
      ([x, y, r]) =>
        `<g transform='rotate(${r} ${x} ${y})'><ellipse cx='${x}' cy='${y}' rx='6.5' ry='9.5' fill='#5a3420' opacity='.42'/><path d='M${x} ${y - 8}c-3 4 3 12 0 16' stroke='#e9d2bb' stroke-opacity='.55' stroke-width='1.3' fill='none'/></g>`,
    )
    .join(""),
  100,
  110,
);

/** Folded paper in the mark's colours: a fixed low-poly mesh. */
const folds = (() => {
  const pts: Record<string, [number, number]> = {
    a: [0, 0], b: [140, 0], c: [260, 0], d: [400, 0],
    e: [0, 130], f: [110, 160], g: [230, 120], h: [330, 170], i: [400, 140],
    j: [0, 280], k: [150, 300], l: [270, 260], m: [400, 300],
    n: [0, 400], o: [120, 400], q: [260, 400], r: [400, 400],
  };
  const tris = "abf afe bcg bgf cdh chg dih efj fkj fgk glk ghl him hml jkn kon kqo klq lmq mrq".split(" ");
  const fills = ["#a9c8ff", "#c3b5ff", "#f1c3f2", "#b8d6ff", "#d8cdff", "#f6d6f4", "#9dbcff", "#b4a4ff", "#e7b8f0", "#cfe0ff"];
  const body = tris
    .map((t, k) => `<path d='M${t.split("").map((c) => pts[c].join(" ")).join("L")}z' fill='${fills[k % fills.length]}'/>`)
    .join("");
  return svg(`${body}<g fill='none' stroke='#fff' stroke-opacity='.55' stroke-width='1.2'>${tris.map((t) => `<path d='M${t.split("").map((c) => pts[c].join(" ")).join("L")}z'/>`).join("")}</g>`, 400, 400, "preserveAspectRatio='none'");
})();

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
    id: "starlight",
    name: "Starlight",
    tags: "purple violet stars night calm craft study notes",
    backdrop: `${dust}, radial-gradient(ellipse at 18% 0%, rgba(176, 160, 255, 0.5), transparent 52%), radial-gradient(ellipse at 90% 85%, rgba(205, 180, 255, 0.4), transparent 50%), linear-gradient(172deg, #262a6e 0%, #4c45a8 48%, #8378d2 100%)`,
    paper: "#ffffff",
    ink: "#1d1d22",
    accent: "#5146d9",
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
    id: "blossom",
    name: "Cherry Blossom",
    tags: "pink flowers sakura spring soft japan",
    backdrop: `${blossoms}, linear-gradient(170deg, #fde4ec, #f7c6d6 60%, #eab0c6)`,
    paper: "#fffafb",
    ink: "#3b1d2a",
    accent: "#c8406f",
    title: "italic",
  },
  {
    id: "dunes",
    name: "Desert Dunes",
    tags: "sand orange warm desert sun travel",
    backdrop: `${dunes} bottom / 100% 46% no-repeat, radial-gradient(circle at 26% 30%, #fff1c9 0 6%, transparent 6.5%), radial-gradient(circle at 26% 30%, rgba(255, 214, 150, 0.6), transparent 36%), linear-gradient(180deg, #f9d9a8, #f3b27a 60%, #e48f5c)`,
    paper: "#fffaf2",
    ink: "#3a2414",
    accent: "#b4532a",
    title: "serif",
  },
  {
    id: "evergreen",
    name: "Evergreen",
    tags: "green forest pine trees nature mist calm",
    backdrop: `${pines} bottom / 100% 40% no-repeat, radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.65), transparent 60%), linear-gradient(180deg, #e3ece4, #bfd3c4 60%, #93b39f)`,
    paper: "#f8fbf7",
    ink: "#17291f",
    accent: "#2f6b4b",
    title: "serif",
  },
  {
    id: "notebook",
    name: "Notebook",
    tags: "yellow lined paper school notes study legal pad",
    backdrop:
      "linear-gradient(90deg, transparent 0 56px, rgba(214, 72, 72, 0.5) 56px 58px, transparent 58px), repeating-linear-gradient(180deg, transparent 0 27px, rgba(70, 120, 190, 0.3) 27px 28px), #fdf3c8",
    paper: "#fffdf3",
    ink: "#1f2430",
    accent: "#c23b3b",
    title: "sans",
  },
  {
    id: "cafe",
    name: "Café",
    tags: "coffee brown warm beans cozy latte",
    backdrop: `${beans}, linear-gradient(170deg, #caa27c, #9c6b47)`,
    paper: "#fffaf3",
    ink: "#2e1d12",
    accent: "#8b4a24",
    title: "serif",
  },
  {
    id: "origami",
    name: "Origami",
    tags: "folded paper triangles pastel blue purple pink geometric",
    backdrop: `${folds} center / cover no-repeat, #e9ecff`,
    paper: "#ffffff",
    ink: "#1d1b3a",
    accent: "#6a4fe0",
    title: "display",
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
  {
    id: "synthwave",
    name: "Synthwave",
    tags: "dark neon retro pink purple sun grid 80s",
    backdrop: `${synthSun} center bottom / cover no-repeat, linear-gradient(180deg, #120a2e, #3a1466 62%, #2a1150)`,
    paper: "#1c1433",
    ink: "#f3eefc",
    accent: "#ff5fae",
    title: "display",
    dark: true,
  },
];

export function getStyle(id: string | undefined | null): PageStyle | null {
  if (!id) return null;
  return PAGE_STYLES.find((s) => s.id === id) ?? null;
}

const SERIF = "var(--d-doc-serif)";

/** Title fonts. Sans and mono follow the app theme's own faces. */
const FONTS: Record<TitleFont, { family: string; style: string; weight: number }> = {
  serif: { family: SERIF, style: "normal", weight: 700 },
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
