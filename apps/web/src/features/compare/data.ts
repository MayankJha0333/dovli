// The comparison pages (/vs/notion, /vs/craft, /vs/evernote and /compare). These pages exist so
// that when someone searches "Notion alternative" or "Evernote vs …", Dovli is one of the answers.
//
// Keep them honest: say where the other app is better, and only claim what Dovli does today.
// Facts about the other apps were checked in October 2026 (their sites and help pages). Plans and
// prices change, so recheck them, and update CHECKED, when you edit this file.

export const CHECKED = "October 2026";

export type Row = { label: string; dovli: string; them: string };
export type Faq = { q: string; a: string };

export type Rival = {
  slug: "notion" | "craft" | "evernote";
  name: string;
  /** The <title>: the words people search, then the brand. */
  title: string;
  description: string;
  /** The H1's second line. */
  promise: string;
  /** The short answer, first on the page: the part Google may quote. */
  pickDovli: string;
  pickThem: string;
  rows: Row[];
  theyWin: string[];
  dovliWins: string[];
  /** How to bring your pages over, step by step. */
  move: string[];
  faqs: Faq[];
};

export const rivals: Rival[] = [
  {
    slug: "notion",
    name: "Notion",
    title: "Dovli vs Notion: a free, calmer Notion alternative",
    description:
      "Dovli vs Notion, side by side. A free Notion alternative for notes, docs and whiteboards, on the web and Android, that works offline. Import your Notion pages in one step.",
    promise: "A calmer Notion alternative for your own notes",
    pickDovli: "Pick Dovli if you want a quiet place for your own notes, docs and sketches, free, offline-first, with whiteboards inside your pages.",
    pickThem: "Pick Notion if your team runs projects on databases, wikis and shared workflows.",
    rows: [
      { label: "Price to start", dovli: "Free", them: "Free plan for individuals. Teams and Notion AI need a paid plan" },
      { label: "Made for", dovli: "Personal notes, docs and planning", them: "Team workspaces, wikis and projects" },
      { label: "Whiteboards", dovli: "Built into your pages, with flowcharts you can edit", them: "No built-in whiteboard. Uses add-on apps" },
      { label: "Offline", dovli: "Every page saves on your device first, then syncs", them: "Pages you download, in the desktop and mobile apps" },
      { label: "Databases", dovli: "Simple tables", them: "Full databases with views, filters and formulas" },
      { label: "AI", dovli: "Assistant in every page, plus your own AI apps over MCP", them: "Notion AI and agents" },
      { label: "Where it runs", dovli: "Web and Android", them: "Web, Mac, Windows, iPhone and Android" },
      { label: "Moving your notes", dovli: "Imports a Notion export, pictures and files included", them: "Exports to Markdown, HTML and PDF" },
    ],
    theyWin: [
      "Databases: views, relations and formulas that Dovli doesn't try to match.",
      "Teams: permissions, wikis and a big template marketplace.",
      "Apps for every platform, including Mac, Windows and iPhone.",
    ],
    dovliWins: [
      "Calm by design: a page opens as a page, not a dashboard of settings.",
      "Whiteboards and flowcharts live inside your notes, no extra app.",
      "Offline-first on the web and Android: everything saves on your device first.",
      "Bring your own AI: connect Claude Desktop, Claude Code or Codex through MCP.",
    ],
    move: [
      "In Notion, open Settings and choose Export all workspace content, as Markdown & CSV or HTML.",
      "In Dovli, open Settings, then Import & export, and drop the .zip file in.",
      "Your page tree, pictures and files come along. Check a few pages, then keep writing.",
    ],
    faqs: [
      { q: "Is Dovli a free alternative to Notion?", a: "Yes. Dovli is free on the web and on Android. You get pages, to-dos, tables, whiteboards, templates and sharing without paying." },
      { q: "Can I move my Notion pages to Dovli?", a: "Yes. Export your Notion workspace as Markdown & CSV or HTML, then drop the .zip into Dovli's Settings, under Import & export. Your page tree, pictures and files come along." },
      { q: "Does Dovli have databases like Notion?", a: "Dovli has simple tables, not full Notion-style databases with views and formulas. If your work depends on databases, Notion is the better fit." },
      { q: "Does Dovli work offline?", a: "Yes. Pages save on your device first and sync when you are back online, on the web and in the Android app." },
    ],
  },
  {
    slug: "craft",
    name: "Craft",
    title: "Dovli vs Craft: a free Craft alternative for web and Android",
    description:
      "Dovli vs Craft, side by side. A free Craft alternative with beautiful pages, whiteboards and templates, on the web and Android. Import your Craft docs as Markdown.",
    promise: "A free Craft alternative for the web and Android",
    pickDovli: "Pick Dovli if you love Craft's style of beautiful documents, but want it free and at home on the web and Android.",
    pickThem: "Pick Craft if you live on a Mac, iPhone and iPad and want its polished native apps.",
    rows: [
      { label: "Price to start", dovli: "Free", them: "Free plan with a block limit. Plus for unlimited docs" },
      { label: "Made for", dovli: "Notes, docs and planning on the web and Android", them: "Beautiful documents, first on Apple devices" },
      { label: "Whiteboards", dovli: "Built into your pages, with flowcharts you can edit", them: "Yes" },
      { label: "Offline", dovli: "Every page saves on your device first, then syncs", them: "Yes, in its apps" },
      { label: "AI", dovli: "Assistant in every page, plus your own AI apps over MCP", them: "AI assistant, plus MCP" },
      { label: "Where it runs", dovli: "Web and Android", them: "Mac, iPhone, iPad, Windows, web and Android" },
      { label: "Moving your notes", dovli: "Imports Craft Markdown and TextBundle exports", them: "Exports to Markdown, TextBundle, PDF and Word" },
    ],
    theyWin: [
      "Native apps on Mac, iPhone, iPad and Vision Pro, with years of polish.",
      "Tasks, calendar and daily notes in one place.",
      "Family and team plans with shared spaces.",
    ],
    dovliWins: [
      "Free, with no block limit on your notes.",
      "Made for the web and Android first, not as an afterthought.",
      "Page styles: give each page its own look, and export it to Word or PDF.",
      "Bring your own AI: connect Claude Desktop, Claude Code or Codex through MCP.",
    ],
    move: [
      "In Craft, export a document or a folder as Markdown or TextBundle.",
      "In Dovli, open Settings, then Import & export, and drop the files or the .zip in.",
      "Folders become pages, so your structure stays. Pictures come along.",
    ],
    faqs: [
      { q: "Is there a free alternative to Craft?", a: "Dovli is a free alternative to Craft for notes, docs and whiteboards. It runs on the web and Android, with page styles, templates and an AI assistant." },
      { q: "Can I import my Craft documents into Dovli?", a: "Yes. Export from Craft as Markdown or TextBundle, then drop the files or the .zip into Dovli's Settings, under Import & export. Folders become pages, and pictures come along." },
      { q: "Does Dovli work on Windows?", a: "Yes, in the browser: open dovli.in in Chrome, Edge or Firefox on any computer. There is also an Android app on Google Play." },
    ],
  },
  {
    slug: "evernote",
    name: "Evernote",
    title: "Dovli vs Evernote: a free Evernote alternative with no note limit",
    description:
      "Dovli vs Evernote, side by side. A free Evernote alternative with no 50-note limit, offline notes, whiteboards and templates. Import your .enex notebooks in one step.",
    promise: "A free Evernote alternative with no note limit",
    pickDovli: "Pick Dovli if Evernote's free plan feels too small: Dovli is free, with no note or notebook limit, and works offline.",
    pickThem: "Pick Evernote if you rely on its web clipper, document scanning and years of saved notes in one search.",
    rows: [
      { label: "Price to start", dovli: "Free, no note limit", them: "Free plan: 50 notes, 1 notebook, 1 device" },
      { label: "Made for", dovli: "Writing, planning and sketching", them: "Saving and finding everything" },
      { label: "Whiteboards", dovli: "Built into your pages, with flowcharts you can edit", them: "No built-in whiteboard" },
      { label: "Offline", dovli: "Every page saves on your device first, then syncs", them: "Offline notebooks need a paid plan" },
      { label: "Web clipper", dovli: "Chrome extension coming soon", them: "Yes, mature and fast" },
      { label: "AI", dovli: "Assistant in every page, plus your own AI apps over MCP", them: "AI features on paid plans" },
      { label: "Where it runs", dovli: "Web and Android", them: "Web, Mac, Windows, iPhone and Android" },
      { label: "Moving your notes", dovli: "Imports .enex exports, pictures and links included", them: "Exports notes and notebooks as .enex" },
    ],
    theyWin: [
      "A mature web clipper and document scanning.",
      "Strong search across years of notes, including text in pictures.",
      "Apps for every platform, including Mac, Windows and iPhone.",
    ],
    dovliWins: [
      "Free with no note or notebook limit.",
      "Pages that hold other pages, so a project or a course stays together.",
      "Whiteboards and flowcharts inside your notes.",
      "Bring your own AI: connect Claude Desktop, Claude Code or Codex through MCP.",
    ],
    move: [
      "In Evernote, select a notebook (or some notes), choose Export, and pick ENEX (.enex).",
      "In Dovli, open Settings, then Import & export, and drop one or more .enex files in.",
      "Each notebook becomes a page holding its notes. Pictures come along, and links between notes still work.",
    ],
    faqs: [
      { q: "What is a free alternative to Evernote?", a: "Dovli is a free Evernote alternative with no note or notebook limit. It works on the web and Android, offline too, and imports your Evernote notebooks." },
      { q: "How do I move my notes from Evernote to Dovli?", a: "Export each notebook from Evernote as an .enex file, then drop the files into Dovli's Settings, under Import & export. Each notebook becomes a page with its notes, pictures included." },
      { q: "Does Dovli have a web clipper like Evernote?", a: "Dovli for Chrome, a browser extension to save what you read on the web, is coming soon." },
    ],
  },
];

export const rivalBySlug = (slug: string) => rivals.find((r) => r.slug === slug);

/** The overview at /compare: all four apps in one table. Values are short, so the table fits a phone. */
export const overview: { label: string; dovli: string; notion: string; craft: string; evernote: string }[] = [
  { label: "Price to start", dovli: "Free", notion: "Free for individuals", craft: "Free, block limit", evernote: "Free, 50 notes" },
  { label: "Best for", dovli: "Calm personal notes", notion: "Team workspaces", craft: "Apple-first docs", evernote: "Saving everything" },
  { label: "Whiteboards", dovli: "Built in", notion: "Add-on apps", craft: "Built in", evernote: "No" },
  { label: "Offline", dovli: "Yes, on every page", notion: "Downloaded pages", craft: "Yes", evernote: "Paid plans" },
  { label: "Android", dovli: "Yes", notion: "Yes", craft: "Yes", evernote: "Yes" },
];

export const overviewFaqs: Faq[] = [
  { q: "Which is better, Notion, Craft or Evernote?", a: "It depends on the job. Notion is best for team databases and wikis, Craft for beautiful documents on Apple devices, and Evernote for saving and finding everything. Dovli is a free, calm place for your own notes, docs and whiteboards on the web and Android." },
  { q: "What is the best free note-taking app?", a: "If you want docs, to-dos and whiteboards in one place with no note limit, Dovli is free on the web and Android and imports from Notion, Evernote and Craft." },
  { q: "Can I switch from Notion, Craft or Evernote to Dovli?", a: "Yes. Dovli imports a Notion export, Craft Markdown or TextBundle files, and Evernote .enex files. Open Settings, then Import & export, and drop the files in." },
];
