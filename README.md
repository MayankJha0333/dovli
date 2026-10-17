# Dovli

A calm place to write, plan and sketch: block pages, nested pages, templates, page styles,
link previews, flowcharts and whiteboards.

This repo is a **monorepo**: one repo with several apps and the code they share,
managed by **pnpm** (installs packages) and **Turborepo** (runs tasks across all of them).

```
Dovli/
├─ apps/
│  ├─ web/                 Next.js web app            → @dovli/web
│  │  ├─ public/fonts/     fonts the whiteboard loads
│  │  └─ src/
│  │     ├─ app/           routes (layout.tsx, page.tsx)
│  │     ├─ components/    small shared UI: Icon, TopBar, Toasts
│  │     ├─ features/      one folder per feature
│  │     │  ├─ workspace/  the app shell (sidebar + current view)
│  │     │  ├─ sidebar/    page tree and search
│  │     │  ├─ home/       Home screen and page cards
│  │     │  ├─ page/       page view: title, icon, delete, editor
│  │     │  ├─ page-styles/ the style gallery
│  │     │  ├─ templates/  template gallery
│  │     │  ├─ pages/      actions used by several features
│  │     │  └─ whiteboard/ Excalidraw board pages
│  │     ├─ lib/           store (saving + routing), editor bridge
│  │     └─ styles/        globals.css
│  └─ mobile/              Expo (React Native) phone app → @dovli/mobile
│     └─ src/
│        ├─ app/           screens (Expo Router): index, page/[id]
│        ├─ components/    Glass (real Liquid Glass on iOS 26, solid fallback elsewhere)
│        ├─ features/      home/, page/
│        └─ lib/           store
├─ packages/
│  ├─ core/                page types, page-tree helpers, templates, sample pages, link previews
│  ├─ theme/               page styles + design tokens (colors, spacing, radius, type)
│  ├─ editor/              the BlockNote editor (web only; the phone app will show it in a web view)
│  └─ config/              shared TypeScript settings
├─ package.json            root scripts
├─ pnpm-workspace.yaml     which folders are part of the repo, plus pnpm settings
└─ turbo.json              how tasks run across apps and packages
```

## First-time setup

You need Node.js 20.19 or newer.

```bash
corepack enable        # turns on the pnpm version pinned in package.json
pnpm install           # installs everything for every app and package
```

## Everyday commands (run from the repo root)

| Command | What it does |
|---|---|
| `pnpm dev:web` | Web app at http://localhost:3000 |
| `pnpm dev:mobile` | Phone app. Press `i` for the iOS Simulator, `a` for Android, or scan the QR code with Expo Go |
| `pnpm typecheck` | Type-checks every app and package |
| `pnpm build` | Production build of everything that builds (the web app today) |

To run a command in one app only: `pnpm --filter @dovli/web <command>`.

## How the shared packages work

- The packages ship **TypeScript source**, not built files. Next.js compiles them
  (see `transpilePackages` in `apps/web/next.config.ts`). Metro, the phone app's bundler,
  does the same automatically.
- `@dovli/core` and `@dovli/theme` have no React DOM or browser code, so both apps can use them.
- `@dovli/editor` owns no data. The web app plugs its store in once, in
  `apps/web/src/lib/editorBridge.ts`.
- Import shared code by package name: `import { displayTitle } from "@dovli/core"`.
- To add a package, make `packages/<name>/package.json` named `@dovli/<name>`, then add
  `"@dovli/<name>": "workspace:*"` to the app that uses it and run `pnpm install`.

## Settings

Copy `apps/web/.env.example` to `apps/web/.env.local` to use your own link-preview server
(`NEXT_PUBLIC_UNFURL_ENDPOINT`). Without it, previews use microlink.io.

## Good to know

- Web pages are saved in the browser (localStorage). Pages saved under the old name (Quire)
  are picked up automatically.
- The phone app keeps pages in memory for now, starting from the same sample pages.
  Syncing web and phone (Supabase) is the next step.
- In the browser console you may see "Failed to use workers for subsetting" from the whiteboard.
  It is harmless: Excalidraw falls back to the main thread.
