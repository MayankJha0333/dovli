# Dovli

A calm place to write, plan and sketch: block pages, nested pages, `[[links]]` and backlinks,
#tags, templates, page styles, link previews, flowcharts and whiteboards. It works offline,
syncs between web and phone, and has optional AI writing help.

This repo is a **monorepo**: one repo with several apps and the code they share,
managed by **pnpm** (installs packages) and **Turborepo** (runs tasks across all of them).

```
Dovli/
├─ apps/
│  ├─ web/                  Next.js web app                        → @dovli/web
│  │  └─ src/
│  │     ├─ app/            routes: the app, shared pages (/s/[id]), API routes (AI, account, files)
│  │     ├─ components/     TopBar
│  │     ├─ features/       one folder per feature: workspace, sidebar, home, page, palette (⌘K),
│  │     │                  settings, auth, share, shared, ai, tags, trash, templates,
│  │     │                  page-styles, pages, whiteboard
│  │     ├─ lib/            store (IndexedDB), settings + themes, sync, sign-in, import/export,
│  │     │                  backups, AI, files, editor bridge
│  │     └─ styles/         globals.css (Tailwind entry + print styles)
│  └─ mobile/               Expo (React Native) phone app           → @dovli/mobile
│     └─ src/
│        ├─ app/            screens (Expo Router): index, page/[id], settings
│        ├─ components/     Glass (Liquid Glass on iOS 26, solid elsewhere), ui (themed basics)
│        ├─ dom/            PageEditorDom: the web editor running inside the app
│        ├─ features/       home/, page/, settings/
│        └─ lib/            store, theme, sync, Supabase, on-device storage (SQLite)
├─ packages/
│  ├─ core/                 page types, page tree, search, tags, links, three-way merge, templates
│  ├─ theme/                the four app themes, page styles, covers, spacing and touch sizes
│  ├─ ui/                   web UI kit (Radix + Tailwind): buttons, menus, dialogs, icons, toasts
│  ├─ editor/               the BlockNote editor, shared by web and phone
│  ├─ sync/                 cloud sync engine (Supabase), shared by web and phone
│  └─ config/               shared TypeScript settings
├─ supabase/migrations/     database tables, privacy rules and functions
├─ package.json             root scripts
├─ pnpm-workspace.yaml      which folders are part of the repo, plus pnpm settings
└─ turbo.json               how tasks run across apps and packages
```

## First-time setup

You need Node.js 20.19 or newer.

```bash
corepack enable        # turns on the pnpm version pinned in package.json
pnpm install           # installs everything for every app and package
```

That's enough to run everything on your own device. Sync, sign-in and AI are switched on
by adding keys (see [Turning on cloud features](#turning-on-cloud-features)).

## Everyday commands (run from the repo root)

| Command | What it does |
|---|---|
| `pnpm dev:web` | Web app at http://localhost:3000 |
| `pnpm dev:mobile` | Phone app. Press `i` for the iOS Simulator or `a` for Android |
| `pnpm typecheck` | Type-checks every app and package |
| `pnpm test` | Unit tests (page tools, merging, sync) |
| `pnpm build` | Production build of the web app |

To run a command in one app only: `pnpm --filter @dovli/web <command>`.

The phone app's editor is the web editor running inside the app (an Expo "DOM component").
If Expo Go can't open it, make a development build once with
`pnpm --filter @dovli/mobile exec expo run:ios` (or `run:android`). For over-the-air update
bundles use `pnpm --filter @dovli/mobile export`: it bundles the editor as one file, because
Expo's split bundles break DOM components when exported.

## Themes and styling

There are four app themes, chosen in **Settings → Appearance** (web) or **Settings** (phone):

| Theme | Look | Fonts |
|---|---|---|
| **Soft Studio** (default) | Bright and friendly, soft rounded cards | Figtree, Bricolage Grotesque |
| **Frost** | Light frosted glass over soft colour | Onest |
| **Night Desk** | Dark and focused: near-black desk, hairline-edged panels, lime accent, mono labels, dense rows | Geist, Geist Mono |
| **Mica** | Calm dark violet, light glowing between the panels, glass only on pop-ups | Manrope |

**Match device** uses Soft Studio by day and Night Desk when the device is in dark mode.

How it fits together:

- Each theme is one object in `packages/theme/src/appThemes.ts`: colours, fonts, corner
  radii, shadows, chips (the rounded groups that hold the tabs and the top bar's buttons),
  blur and layout (gaps, row height, label style). Add a theme by adding an object there;
  nothing else needs to change. Components never check which theme is on.
- Fills like `bg-well` and `bg-hover` are see-through in the dark themes, so they show on
  every surface (panel, sidebar, menu) without per-surface colours.
- `themeStylesheet()` (in `packages/theme/src/css.ts`) turns every theme into CSS variables
  (`--d-*`) under `:root[data-theme="…"]`. A tiny script in the page head sets `data-theme`
  before the first paint, so there is no flash of the wrong theme.
- Tailwind CSS v4 reads those variables (`packages/ui/src/styles.css`, `@theme inline`).
  Use the theme's names in class lists: `bg-panel`, `text-ink-2`, `border-line`,
  `rounded-lg`, `shadow-pop`, `h-row`, and the surface helpers `surface-panel`,
  `surface-raised`, `surface-chip`. Tailwind's default colours are switched off, so a stray
  `bg-gray-100` won't build: every colour comes from the theme.
- Components live once, in `@dovli/ui` (built on Radix). Combine classes with `cn()`.
- The editor's "/" and "[[" menus are our own component (`packages/editor/src/SlashMenu.tsx`)
  built from these classes; BlockNote still opens, places, filters and drives them.
- Excalidraw (whiteboards and flowcharts) picks up the theme through CSS variables in
  `packages/editor/src/editor.css`. Its font worker is copied to `public/excalidraw/` by
  `apps/web/next.config.ts`, and `patches/@excalidraw__excalidraw@0.18.1.patch` lets the app
  tell Excalidraw where it is (without it, the worker fails with a `file:///ROOT/…` error).
- The phone app reads the same theme objects (`apps/mobile/src/lib/theme.ts`), and its editor
  uses the same CSS variables as the web.

## The layout

Modelled on Craft's:

- **Sidebar** (a floating card; ⌘\ hides and shows it) has two sides, switched by the dots at
  the bottom. The workspace side has New page, Search, All pages, Templates, Favourites, the page
  tree, Tags and Trash. The page side shows the open page with four tabs: Contents (headings,
  with the one you're reading marked), To-dos (tick them from here), Attachments and Links.
  Opening a page from All pages, search or a link shows the page side; opening it from the
  page tree keeps the tree. The logic is in `features/sidebar/follow.ts`.
- **Tabs** above the page: Home, one tab per open page, and + for a new page in a new tab.
  ⌘/Ctrl-click or middle-click opens a page in a new tab; middle-click on a tab closes it.
  Open tabs are kept on this device (`lib/tabs.ts`). Hidden on phones.
- **All pages** (Home): every page as a small picture of itself, shown as cards, a grid or a
  list, sorted by last edited, date created or title, with a filter box.
- **Assistant** (bottom right of a page): summarise, the four reviews, or rewrite the selected
  text.

## The page panels

The top right of every page has **Share** and three panels, in the spirit of Craft:

- **Aa (Format)**: text styles (Title, Subtitle, Heading, Strong, Body, Caption), turn blocks
  into a page or a card, bold / italic / strike / code, lists, indent, alignment, the Focus and
  Box decorations, text colour and font. It works on the selected text, or else on the line with
  the cursor. The actions live in `packages/editor/src/format.ts`.
- **Style**: page style, custom backdrop / paper / text / accent colours, cover, divider style,
  page font (System, Serif, Mono, Round) and wide page. Saved on the page as `look`
  (`packages/theme/src/pageLook.ts` turns it into CSS variables).
- **Info** (⌘⇧I): dates, location, stats, outline, links, tags, AI summary and document review;
  the Actions tab has Present, find, favourite, move, duplicate, export, backups and delete.

## Turning on cloud features

Everything works without these. Each one switches a feature on.

### Sync, sign-in, share links (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration: paste `supabase/migrations/20261018000000_dovli_init.sql` into the SQL
   editor, or run `supabase db push` with the Supabase CLI. It creates the tables, the
   private file storage, and the rules that keep each person's pages private.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
4. For the phone, copy `apps/mobile/.env.example` to `apps/mobile/.env` with the same URL
   and anon key.
5. In Supabase → Authentication:
   - **URL configuration**: add your web address (and `http://localhost:3000`) as redirect URLs.
   - **Providers**: email is on by default (sign-in with a 6-digit code). Add Google and
     Apple if you want those buttons to work.
   - **Multi-factor**: turn on TOTP for two-step login.

### AI writing help (Anthropic)

Add `ANTHROPIC_API_KEY` to `apps/web/.env.local`. Optional: `AI_MODEL` and
`AI_MONTHLY_TOKENS` (the monthly allowance per person, shown as a usage meter).
AI needs sign-in, so it also needs Supabase.

### Link previews

Optional `NEXT_PUBLIC_UNFURL_ENDPOINT` for your own preview server. Without it, previews use
microlink.io.

## Good to know

- **Where pages are saved**: in the browser's IndexedDB on the web, and in SQLite on the phone,
  the moment you type. When signed in, changes sync in the background; edits made offline on
  two devices are merged, and if both changed the same paragraph you get both versions.
- **Privacy**: pages are never used to train AI. Files are in a private storage bucket, and
  database rules only let you read your own pages (or a page someone shared with a link).
- **Backups**: the web app keeps automatic backups on the device (Settings → Sync & backups),
  and you can export everything as a ZIP of Markdown files at any time.
- In the browser console you may see "Failed to use workers for subsetting" from the whiteboard.
  It is harmless: Excalidraw falls back to the main thread.
