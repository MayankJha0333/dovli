// What search engines and AI answer engines read about Dovli: the site's address, the words we
// want to be found for, and the structured data (JSON-LD, the schema.org facts Google reads to
// show rich results). Every page that describes Dovli to a search engine takes its facts from here,
// so they never drift apart.

import { PLAY_STORE_URL } from "@/features/landing/playStore";

/** Dovli's home address. APP_URL wins (a test copy of Dovli sets its own); otherwise dovli.in. */
export const SITE = (process.env.APP_URL || "https://dovli.in").replace(/\/$/, "");

/** The search words, in the order people type them, for the home page's title and description. */
export const HOME_TITLE = "Dovli — Notes, Docs, Tasks & Whiteboards"; 
export const HOME_DESCRIPTION =
  "Dovli is your workspace for notes, docs, tasks, and ideas. Capture your thoughts, organize your knowledge, and turn ideas into action with a beautifully connected workspace. Available on web and Android, with seamless imports from Notion, Evernote, and Craft.";

/**
 * When each public page last changed in a way a reader would notice (YYYY-MM-DD). Bump the date in
 * the same change: the sitemap gives it to search engines, and the legal pages show it.
 */
export const UPDATED = {
  home: "2026-10-21",
  compare: "2026-10-21",
  signup: "2026-10-21",
  privacy: "2026-10-20",
  deleteAccount: "2026-10-20",
} as const;

/** "2026-10-20" as "20 October 2026". */
export const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const SHARE_IMAGE = { url: "/landing/og.jpg", width: 1200, height: 630, alt: "Dovli: a calm place to write, plan and sketch." };

/** Things that are true of Dovli today, used in structured data. Keep in step with the landing page. */
export const FEATURES = [
  "Block editor with to-dos, tables, callouts and toggles",
  "Pages inside pages",
  "Whiteboards and editable flowcharts inside your notes",
  "Templates",
  "Works offline, syncs when back online",
  "Share pages to read or edit",
  "AI assistant in every page",
  "MCP server for Claude Desktop, Claude Code, Codex and other AI apps",
  "Import from Notion, Evernote, Craft, Confluence, OneNote, Obsidian, Word and Markdown",
  "Export to Word, PDF and Markdown",
];

const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;

const organization = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "Dovli",
  url: `${SITE}/`,
  logo: `${SITE}/apple-icon.png`,
  email: "support@dovli.in",
  founder: { "@type": "Person", name: "Mayank Jha" },
  sameAs: [PLAY_STORE_URL],
};

const website = {
  "@type": "WebSite",
  "@id": SITE_ID,
  name: "Dovli",
  url: `${SITE}/`,
  publisher: { "@id": ORG_ID },
  inLanguage: "en",
};

const free = { "@type": "Offer", price: "0", priceCurrency: "USD" };

/** The home page's structured data: who makes Dovli, the site, the web app and the Android app. */
export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      website,
      {
        "@type": "WebApplication",
        "@id": `${SITE}/#webapp`,
        name: "Dovli",
        url: `${SITE}/`,
        description: HOME_DESCRIPTION,
        applicationCategory: "ProductivityApplication",
        applicationSubCategory: "Note-taking",
        operatingSystem: "Web browser",
        browserRequirements: "Requires JavaScript. Works in current Chrome, Safari, Edge and Firefox.",
        image: `${SITE}${SHARE_IMAGE.url}`,
        offers: free,
        featureList: FEATURES,
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "MobileApplication",
        "@id": `${SITE}/#android`,
        name: "Dovli",
        url: PLAY_STORE_URL,
        installUrl: PLAY_STORE_URL,
        description: "Dovli for Android: your notes, docs and whiteboards on your phone, offline too, synced with the web.",
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Android",
        offers: free,
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

/** Home → … → this page, as Google shows it above a result instead of the bare address. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${SITE}${t.path}` })),
  };
}

/** Questions and answers, as plain text (search engines don't want markup here). */
export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/**
 * A <script type="application/ld+json"> body. `<` is escaped so text inside can never close the
 * script tag early (Next's own advice: https://nextjs.org/docs/app/guides/json-ld).
 */
export function ldJson(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
