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

[Desktop](../../.github/workflows/desktop.yml) does it in GitHub Actions:

- **Every pull request and merge to main** that touches the app (or the web code and packages it's
  built from) runs the checks and builds both installers. They stay on the run for a week, under
  *Summary → Artifacts*, so a change can be tried as the real app before it's released.
- **A release**: *Actions → Desktop → Run workflow* on main, and pick **patch**, **minor** or
  **major**. The version comes from the last release (`scripts/version.ts`: the newest `v1.2.3`
  tag, bumped; the first release is `package.json`'s version, and raising `package.json` by hand
  wins). It makes a draft release `v<version>` with notes from the merged pull requests, builds
  and uploads both installers and the update files into it, then publishes it.
- **Once it's published**, installed apps find it on their next check (15 seconds after opening,
  then every 4 hours, or *Check for Updates…*), download it in the background and offer to
  restart (or install it the next time Dovli quits). dovli.in/download offers the new installers
  within half an hour.

Untick *Publish* to keep the release a draft, try its installers, then publish it on GitHub. A run
that fails part-way leaves its draft; running the same bump again reuses it.

Release tags must stay `v<version>`: that's where the apps look for updates and the website looks
for installers (`apps/web/src/lib/desktopRelease.ts`, by the file names in `electron-builder.yml`).

Before the first release, deploy the web app: the desktop sign-in needs `/desktop/sign-in` and
`/api/auth/desktop/*` on dovli.in. In Firestore, a TTL policy on `authDesktopCodes.expiresAt`
clears sign-in codes nobody used (they stop working after two minutes either way).

### Signing

Unsigned apps work, but macOS says it "can't check" Dovli for malware (people allow it once, in
*System Settings → Privacy & Security → Open Anyway*), and Windows SmartScreen says "Windows
protected your PC". Without a certificate the workflow signs the Mac app *ad hoc*, which is what
lets it open on Apple silicon at all. Both update themselves either way (`src/main/updater.ts`):

- **Windows** runs the new installer after Dovli quits, then opens Dovli again.
- **Mac with a Developer ID**: macOS's own updater (Squirrel.Mac) installs it.
- **Mac signed ad hoc**: macOS's updater refuses an update it can't tie to the same developer, so
  Dovli installs it itself (`src/main/macInstall.ts`): it unzips the download (already checked
  against the release's sha512), checks it's Dovli at the new version with an intact signature,
  and once Dovli quits a small script swaps it into place and reopens it. Dovli must be in a folder
  the person can write to (Applications is); run from the disk image or from Downloads, it offers
  the download instead. macOS asks for the microphone again after each ad hoc update, since its
  permission is tied to the exact build.
- Mac apps from **1.0.1 or older** have the earlier updater, which said the update was ready but
  couldn't install it on an ad hoc build: download the new version by hand once.

What happened is in `updates.log` (Mac: `~/Library/Logs/Dovli`, Windows: `%APPDATA%\Dovli\logs`). To sign, add these GitHub Actions secrets; the
workflow picks them up:

- **Mac** (Apple Developer Program, $99 a year): a *Developer ID Application* certificate as
  `MAC_CSC_LINK` (the .p12, base64) and `MAC_CSC_KEY_PASSWORD`; for notarizing, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
- **Windows**: a code-signing certificate as `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`. (Azure
  Trusted Signing is cheaper, about $10 a month, and electron-builder supports it through
  `win.azureSignOptions`.)
