# Dovli for Mac and Windows

The desktop app is the web app's workspace in its own window ([Electron](https://www.electronjs.org)),
built into the app so it opens and works with no internet, and syncs with Dovli's server whenever
it can reach it.

## How it fits together

```
apps/desktop
├── src/main/        the app itself (Electron's main process)
│   ├── main.ts          window, menus, sign-in, updates, permissions
│   ├── protocol.ts      app://dovli/: serves the built window, and forwards /api to Dovli's server
│   ├── googleSignIn.ts  Google sign-in through the system browser (127.0.0.1 + PKCE)
│   ├── windowState.ts   where the window was, and the theme's colours, between launches
│   ├── menu.ts · contextMenu.ts · updater.ts · pages.ts
├── src/preload/     window.dovliDesktop, the only door between the window and the app
├── renderer/        the window: the web app's Workspace (apps/web/src, as "@/…"), plus the
│                    sign-in screen, the title bar with its sync status, and the menu commands
├── resources/       icons and the Mac entitlements (scripts/icons.mjs makes the icons)
└── test/            unit tests (pnpm test)
```

- **Offline first.** The window is served from the app (`app://dovli/`), and pages live in its
  IndexedDB, as in a browser tab. Firebase keeps the sign-in on the computer, so the app opens
  straight to your pages without a network.
- **Sync** is the web app's own engine (`packages/sync`): every change is saved here first and
  noted in an outbox; it's sent when Dovli's server answers, and edits made on two devices are
  merged block by block (both versions are kept when the same paragraph changed on both). It runs
  on launch, a moment after each edit, when the connection comes back, when the window comes
  forward, after the computer wakes, and every 30 seconds. The title bar always shows where it
  stands: Synced, Syncing…, Offline · 2 changes waiting, Can't reach Dovli, Sync paused.
- **/api calls** go to `app://dovli/api/…`, which the app forwards to Dovli's server, so the web
  app's code works unchanged and there's no cross-site request to allow.
- **Google sign-in** can't show Google's page in an app window, so the app opens
  `dovli.in/desktop/sign-in` in the system browser, and gets back a one-time code on
  `127.0.0.1` that only it can redeem (see `apps/web/src/lib/server/desktopAuthCore.ts`). Email
  codes work right in the app.
- **Closing**: the window finishes writing to disk before it goes. On a Mac, closing the window
  keeps Dovli running (and syncing) in the Dock, as Mac apps do; ⌘Q quits.

## Running it

```bash
pnpm dev:web                              # Dovli's server on http://localhost:3000 (for sign-in and sync)
pnpm --filter @dovli/desktop dev          # the app, with the window's code reloading as you edit it
```

`DOVLI_SITE_URL` points the app at another server (the default is https://dovli.in), and
`DOVLI_PROFILE=name` keeps a separate set of data, so you can run two copies side by side to try
syncing between them. The window's settings (`NEXT_PUBLIC_FIREBASE_*`) come from
`apps/web/.env.local` unless set in the environment.

> In a VS Code or Cursor terminal, `ELECTRON_RUN_AS_NODE` is set for the editor's own tools and
> makes Electron start as plain Node. `pnpm dev` removes it; for `pnpm start` run
> `env -u ELECTRON_RUN_AS_NODE pnpm start`.

### Testing against the local Firebase emulators

Nothing reaches the real project this way:

```bash
pnpm emulators                            # Auth + Firestore emulators (demo-dovli)
# the web server, with the emulators' settings (see apps/web/.env.example) and SMTP unset,
# prints sign-in codes in its terminal
pnpm --filter @dovli/desktop dev          # with the same NEXT_PUBLIC_FIREBASE_* emulator settings
```

## Commands (in apps/desktop)

| Command | What it does |
|---|---|
| `pnpm dev` | The app from source, with live reload of the window |
| `pnpm build` | Builds the window and the app into `dist/` |
| `pnpm start` | Runs what `pnpm build` made |
| `pnpm test` / `pnpm typecheck` | Unit tests / type check |
| `pnpm pack:dir` | An unpacked app in `release/`, to try the packaged build |
| `pnpm dist:mac` / `pnpm dist:win` | Installers: a universal `.dmg` + `.zip` for Mac; an `.exe` for Windows (x64 and Arm) |
| `pnpm fonts` | Copies the Google Fonts into `renderer/fonts` (rerun if the theme's fonts change) |
| `node scripts/icons.mjs` | Remakes the icons from `apps/web/src/app/icon.svg` |

Both installers can be made on a Mac.

## Releasing

1. Raise `version` in `apps/desktop/package.json`.
2. Push a tag `desktop-v<version>`. [Desktop release](../../.github/workflows/desktop-release.yml)
   checks, builds both installers and uploads them to a **draft** GitHub release.
3. Publish the draft. Installed apps find it within a few hours (or with Check for Updates…) and
   offer to restart.

Before the first release, deploy the web app: the desktop sign-in needs `/desktop/sign-in` and
`/api/auth/desktop/*` on dovli.in. In Firestore, a TTL policy on `authDesktopCodes.expiresAt`
clears sign-in codes nobody used (they stop working after two minutes either way).

### Signing

Unsigned apps work, but macOS says it "can't check" Dovli for malware, and Windows SmartScreen says
"Windows protected your PC". Mac auto-updates also need a signed app. To sign, add these GitHub
Actions secrets; the workflow picks them up:

- **Mac** (Apple Developer Program, $99 a year): a *Developer ID Application* certificate as
  `MAC_CSC_LINK` (the .p12, base64) and `MAC_CSC_KEY_PASSWORD`; for notarizing, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
- **Windows**: a code-signing certificate as `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`. (Azure
  Trusted Signing is cheaper, about $10 a month, and electron-builder supports it through
  `win.azureSignOptions`.)
