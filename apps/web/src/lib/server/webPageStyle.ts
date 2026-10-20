// Choosing a page style for "Notes from a link", from the web page itself: first what it's about (a
// recipe gets Café, code gets Graphite, travel gets Desert Dunes…), then, when that's unclear, the
// site's own brand colour. No AI, so it works for both notes and full articles and costs nothing.

import { DEFAULT_PAGE_STYLE, PAGE_STYLES } from "@dovli/theme";

export interface StyleSignals {
  host: string;
  path: string;
  title: string;
  /** The page's description, keywords and section, as the site gives them. */
  about: string;
  /** schema.org and Open Graph types: "Recipe", "NewsArticle", "article"… */
  types: string[];
  headings: string;
  body: string;
  codeBlocks: number;
  /** The site's brand colour (<meta name="theme-color">). */
  themeColor: string;
}

interface Topic {
  style: string;
  words: string[];
  hosts?: RegExp;
  types?: RegExp;
}

// In order: when two topics score the same, the first wins.
const TOPICS: Topic[] = [
  {
    style: "graphite",
    words: ["javascript", "typescript", "python", "java", "rust", "golang", "programming", "developer", "api", "function", "npm", "react", "css", "html", "sql", "git", "docker", "kubernetes", "compiler", "framework", "library", "component", "variable", "code", "coding", "algorithm", "backend", "frontend", "database"],
    hosts: /(^|\.)(github\.com|gitlab\.com|stackoverflow\.com|stackexchange\.com|developer\.mozilla\.org|dev\.to|npmjs\.com|pypi\.org|readthedocs\.io|hashnode\.dev|geeksforgeeks\.org|freecodecamp\.org|w3schools\.com)$|^(docs|developer|developers)\./,
    types: /^(TechArticle|SoftwareSourceCode|SoftwareApplication|APIReference)$/i,
  },
  {
    style: "cafe",
    words: ["recipe", "ingredient", "cooking", "cook", "bake", "baking", "bread", "dough", "flour", "yeast", "coffee", "espresso", "tea", "food", "dish", "cuisine", "kitchen", "restaurant", "chef", "meal", "dessert", "sourdough", "oven"],
    types: /^Recipe$/i,
  },
  {
    style: "cobalt",
    words: ["space", "astronomy", "nasa", "planet", "galaxy", "telescope", "star", "orbit", "rocket", "cosmos", "universe", "asteroid", "spacecraft", "moon", "mars"],
  },
  {
    style: "linen",
    words: ["history", "historical", "century", "ancient", "empire", "literature", "novel", "book", "author", "biography", "medieval", "civilization", "research", "study", "paper", "journal", "thesis"],
    hosts: /(^|\.)(arxiv\.org|jstor\.org|doi\.org|ncbi\.nlm\.nih\.gov|nature\.com|sciencedirect\.com|springer\.com|britannica\.com|goodreads\.com)$/,
    types: /^(ScholarlyArticle|Book|Report|Thesis)$/i,
  },
  {
    style: "inkwash",
    words: ["philosophy", "philosopher", "poetry", "poem", "zen", "stoic", "stoicism", "calligraphy", "ethics", "meaning", "buddhism"],
  },
  {
    style: "dunes",
    words: ["travel", "trip", "itinerary", "destination", "visa", "hotel", "flight", "tourism", "tourist", "desert", "backpacking", "sightseeing", "journey", "airport"],
    types: /^(TouristDestination|TouristAttraction|TouristTrip|Hotel|LodgingBusiness)$/i,
  },
  {
    style: "lagoon",
    words: ["ocean", "sea", "marine", "beach", "island", "coral", "diving", "surfing", "reef", "whale", "sailing"],
  },
  {
    style: "sage",
    words: ["garden", "gardening", "plant", "houseplant", "soil", "seed", "botany", "compost", "succulent", "herb", "pruning"],
  },
  {
    style: "evergreen",
    words: ["forest", "hiking", "trail", "climate", "environment", "wildlife", "mountain", "camping", "ecology", "conservation", "nature", "tree", "biodiversity"],
  },
  {
    style: "monsoon",
    words: ["health", "wellness", "meditation", "mindfulness", "sleep", "anxiety", "stress", "mental", "yoga", "therapy", "breathing", "nutrition"],
    types: /^(MedicalWebPage|MedicalCondition)$/i,
  },
  {
    style: "starlight",
    words: ["habit", "motivation", "mindset", "productivity", "focus", "self-improvement", "discipline", "goal", "routine", "journaling"],
  },
  {
    style: "sunrise",
    words: ["business", "startup", "marketing", "finance", "investing", "investment", "money", "career", "management", "economy", "sales", "stock", "revenue", "entrepreneur", "founder"],
  },
  {
    style: "midnight",
    words: ["artificial intelligence", "ai", "machine learning", "llm", "neural", "crypto", "blockchain", "cybersecurity", "smartphone", "gadget", "robot"],
  },
  {
    style: "synthwave",
    words: ["game", "gaming", "gamer", "music", "album", "song", "movie", "film", "anime", "retro", "playstation", "xbox", "nintendo", "concert", "esports"],
    types: /^(VideoGame|MusicAlbum|MusicRecording|Movie|TVSeries)$/i,
  },
  {
    style: "halftone",
    words: ["comic", "comics", "meme", "humor", "humour", "funny", "cartoon", "manga"],
  },
  {
    style: "origami",
    words: ["design", "designer", "typography", "illustration", "ux", "ui", "art", "artist", "drawing", "craft", "diy", "creative", "photography"],
  },
  {
    style: "terrazzo",
    words: ["interior", "decor", "furniture", "architecture", "apartment", "renovation", "home"],
  },
  {
    style: "blossom",
    words: ["japan", "japanese", "tokyo", "kyoto", "sakura", "spring", "flower", "bloom"],
  },
  {
    style: "marigold",
    words: ["festival", "diwali", "holi", "celebration", "wedding", "puja", "tradition", "festive"],
  },
  {
    style: "dusk",
    words: ["relationship", "love", "dating", "lifestyle", "fashion", "beauty", "parenting", "romance"],
  },
  {
    style: "notebook",
    words: ["learn", "learning", "lesson", "course", "exam", "student", "school", "tutorial", "education", "homework", "notes", "guide", "beginner"],
    hosts: /(^|\.)(wikipedia\.org|wikibooks\.org|khanacademy\.org|coursera\.org|edx\.org|byjus\.com)$/,
    types: /^(Course|LearningResource|Quiz)$/i,
  },
  {
    style: "paper",
    words: ["news", "breaking", "report", "election", "government", "minister", "police", "court"],
    types: /^(NewsArticle|ReportageNewsArticle|AnalysisNewsArticle|LiveBlogPosting)$/i,
  },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = new Map(TOPICS.flatMap((t) => t.words).map((w) => [w, new RegExp(`\\b${escape(w)}(?:s|es)?\\b`, "gi")]));
const hits = (text: string, word: string, cap: number) => Math.min(cap, text.match(patterns.get(word)!)?.length ?? 0);

/** How strongly the page is about each topic. Exported for tests. */
export function topicScores(s: StyleSignals): Map<string, number> {
  const head = `${s.title} ${s.about} ${s.path.replace(/[-_/]+/g, " ")}`;
  const scores = new Map<string, number>();
  for (const t of TOPICS) {
    let score = 0;
    // The title and description say what the page is about; the text only backs it up.
    for (const w of t.words) score += 3 * hits(head, w, 1) + 2 * hits(s.headings, w, 1) + hits(s.body, w, 3);
    if (t.hosts?.test(s.host)) score += 6;
    if (t.types && s.types.some((x) => t.types!.test(x))) score += 8;
    if (t.style === "graphite") score += Math.min(8, s.codeBlocks * 2);
    scores.set(t.style, Math.max(scores.get(t.style) ?? 0, score));
  }
  return scores;
}

/* ---------- The site's colour ---------- */

function hsl(color: string): [number, number, number] | null {
  const c = color.trim().toLowerCase();
  let rgb: number[] | null = null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const fn = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c);
  if (fn) rgb = fn.slice(1, 4).map(Number);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => Math.min(255, v) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [hue, sat, l];
}

/** The light style whose accent is closest in hue to the site's brand colour, or null for a grey or missing one. */
export function styleFromColor(color: string): string | null {
  const site = hsl(color);
  if (!site || site[1] < 0.3 || site[2] < 0.12 || site[2] > 0.92) return null;
  let best: string | null = null;
  let bestGap = 40; // degrees: further than this, no style really matches
  for (const s of PAGE_STYLES) {
    const a = hsl(s.accent);
    if (s.dark || !a || a[1] < 0.3) continue;
    const gap = Math.min(Math.abs(a[0] - site[0]), 360 - Math.abs(a[0] - site[0]));
    if (gap < bestGap) [best, bestGap] = [s.id, gap];
  }
  return best;
}

/** The page style for a page made from this web page. */
export function pickStyle(s: StyleSignals): string {
  let best = "";
  let top = 0;
  for (const [style, score] of topicScores(s)) if (score > top) [best, top] = [style, score];
  if (top >= 6) return best;
  return styleFromColor(s.themeColor) ?? DEFAULT_PAGE_STYLE;
}
