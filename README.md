# Dovli

A calm place to write, plan and sketch: block pages, nested pages, `[[links]]` and backlinks,
#tags, templates, page styles, link previews, flowcharts and whiteboards. It works offline,
syncs between web and phone, and has optional AI writing help.

**Live at [dovli.in](https://dovli.in).**

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
- **Page header** (`features/page/PageHeader.tsx`, `PageIcon.tsx`): the cover is a banner
  across the whole top of the page, under the floating top bar (which gets a background once
  you scroll). The icon sits half over the cover's bottom edge. Emoji show on their own; marks
  (¶ § ✦) sit in a soft tile. A page with only the default mark shows no icon: "Add icon" and
  "Add cover" appear when you hover above the title. The icon picker has Emoji and Marks, a box
  for any emoji you paste, and Remove icon.
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

### Sign-in (Firebase): Google and email codes

How it works:

- **Google**: Firebase Authentication, in a pop-up (or a full-page redirect where pop-ups
  can't open). Code: `apps/web/src/lib/auth.ts`.
- **Email code**: Firebase has no "email me a 6-digit code", so Dovli's server does it
  (`apps/web/src/lib/server/emailCodeCore.ts`, with tests next to it). It keeps only a sealed
  hash of each code in Firestore. A code works for 10 minutes, once, with 5 wrong tries. A new
  one can be sent after 60 seconds, at most 5 an hour per address and 30 an hour per network.
  The right code gets a one-time Firebase token, and the app signs in with it.
- **One email, one account**: Google and email codes for the same address reach the same account.
- The phone app signs in with email codes through the same server.
- **Sign-in gate**: with the Firebase web config set, the web app needs an account. People
  without one land on `/login` (or `/signup`, which also asks for a name); share links (`/s/…`)
  stay public. After signing in, the browser swaps its fresh Firebase token for a 14-day
  httpOnly session cookie (`/api/auth/session`). `src/proxy.ts` sends anyone without a live
  cookie to `/login`, and the app's page checks the cookie's signature on the server before it
  shows anything. Signing out removes the cookie. Code: `apps/web/src/lib/authGate.ts`.

Setup:

1. In the [Firebase console](https://console.firebase.google.com), open your project.
2. **Authentication → Sign-in method**: turn on **Google**.
3. **Authentication → Settings → Authorised domains**: add your site's domain
   (`localhost` is there already).
4. **Firestore Database**: create a database (production mode). It holds the sign-in code
   records. Then publish the rules in `firestore.rules` (`pnpm deploy:rules`), which keep the
   app itself out. Optional: add a TTL policy on the field `deleteAt` for the collections
   `authEmailCodes` and `authRateLimits`, so old records clean themselves up.
5. **Project settings → General → Your apps → Web app**: copy the config into
   `apps/web/.env.local` as `NEXT_PUBLIC_FIREBASE_*` (see `.env.example`).
6. **Project settings → Service accounts → Generate new private key**: put the JSON in
   `FIREBASE_SERVICE_ACCOUNT` (one line, or base64). Server only. Keep it secret.
7. Set `AUTH_CODE_SECRET` to a long random string (`openssl rand -base64 48`).
8. Email: set `SMTP_URL` (or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`) and
   `EMAIL_FROM`. Any SMTP service works: Gmail with an app password, Resend, SendGrid,
   Amazon SES, Brevo. Without SMTP in development, codes are printed in the terminal
   running `pnpm dev`.
9. For the phone, copy `apps/mobile/.env.example` to `apps/mobile/.env`: the same web-app
   config, plus `EXPO_PUBLIC_API_URL` (the web app's address).

Trying it locally without a real project: run `pnpm emulators` (needs Java) and set the
three emulator lines at the end of `apps/web/.env.example`.

### What's in Firestore

Only Dovli's server reads and writes it (the rules in `firestore.rules` keep browsers and
phones out); the rules for every change are in `apps/web/src/lib/server/cloudCore.ts`, with
tests next to it.

| Path | What it holds |
|---|---|
| `users/{uid}` | One per person: `email`, `name`, `photoURL`, `signInMethods`, `plan` (`free`), `status` (`active`), `createdAt`, `lastSignInAt`, `lastSeenAt`, `personalWorkspaceId`, `deviceCount`. `plan` and `status` are set once, so you can change them in the console. |
| `users/{uid}/devices/{deviceId}` | Every browser or phone they use: `ownerId`, `platform` (`web`, `ios`, `android`), `name` (like "Chrome on macOS"), `appVersion`, `installed`, `firstSeenAt`, `lastSeenAt`. Devices are personal, so they stay under the person. |
| `workspaces/{workspaceId}` | A space of pages: `name`, `kind` (`personal` or `team`), `ownerId`, `memberIds`, `roles` (each member's `owner`, `editor` or `viewer`), `pageCount`, `boardCount`, `trashCount`, `syncRev` (the sync counter). Everyone gets a personal one, `personal-{uid}`, on their first visit. |
| `workspaces/{workspaceId}/pages/{pageId}` | Every page and board in it: `title`, `kind` (`doc` or `board`), `parentId`, `mark`, `favorite`, `inTrash`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `size`, `rev`, and the full content as JSON text in `data`. Pages deleted for good stay as small markers (`purged: true`) so other devices hear about it. |
| `authEmailCodes`, `authRateLimits`, `aiUsage` | Sign-in code hashes, send limits, monthly AI use. |

**Who can do what**: owners do everything, editors read and change pages, viewers only read.
The server checks the role on every read and save. To list every page of every person, use
the console's Query builder with the collection group `pages` (or `devices`).

**Moving older data**: pages saved before workspaces (at `users/{uid}/pages`) move into the
person's personal workspace on their next visit, keeping their change numbers, so devices don't
download everything again.

**Sync between devices**: every change is saved on the device first (it works offline), then
sent to the workspace's `pages` through `/api/sync/push`; other devices fetch changes through
`/api/sync/pull` when they open, every 30 seconds, and when you switch back to them. Edits
made on two devices offline are merged. The web app and the phone app use the same engine
(`packages/sync`). A page over about 900 KB stays on the device and Settings says so.

**Sharing a page** (like Craft): the Share button opens one window with two tabs.
- *Share*: invite people by email as **Can view** or **Can edit**. Someone with an account gets
  it right away under "Shared with me"; a new email gets it once they sign up with that address.
  Both get an email with a link (`/p/{workspace}/{page}`). Change or remove access any time.
  The *invitation link* (`/s/{link}`) lets anyone open the page: view needs no account, edit
  does. "Make a new link" stops the old one. Rules and tests: `lib/server/shareCore.ts`.
- *Export*: PDF, Word (.docx), Markdown (.md), Image (.png) and Web page (.html).

In Firestore, a shared page keeps `shared` (uid → role), `sharedIds`, `invited` and `linkId`;
links are in `shareLinks/{id}`, each person's list in `users/{uid}/shared`, and invites for new
emails in `pendingInvites/{emailKey}`.

**Not yet**: pictures and attached files stay on the device they were added on (Firebase
Storage needs the paid Blaze plan), and share links (built on Supabase) are off.

### AI writing help (Anthropic)

Add `ANTHROPIC_API_KEY` to `apps/web/.env.local`. Optional: `AI_MODEL` and
`AI_MONTHLY_TOKENS` (the monthly allowance per person, shown as a usage meter).
With Firebase set up, AI needs sign-in, and each person's monthly use is counted in Firestore.

### Link previews

Optional `NEXT_PUBLIC_UNFURL_ENDPOINT` for your own preview server. Without it, previews use
microlink.io.

## Good to know

- **Where pages are saved**: in the browser's IndexedDB on the web, and in SQLite on the phone,
  the moment you type. (Syncing them through your account comes with the move to Firestore.)
- **Privacy**: pages are never used to train AI. Dovli never sees a password: you sign in with
  Google or a one-time email code.
- **Backups**: the web app keeps automatic backups on the device (Settings → Sync & backups),
  and you can export everything as a ZIP of Markdown files at any time.
