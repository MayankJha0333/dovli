import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, Menu, app, autoUpdater, clipboard, ipcMain, nativeTheme, net, powerMonitor, protocol, screen, session, shell } from "electron";
import { SYSTEM_DARK_THEME, SYSTEM_LIGHT_THEME, getTheme } from "@dovli/theme";
import type { DesktopCommand } from "@/lib/desktop";
import { CONFIG_ARG, IPC, type BridgeConfig, type GoogleSignInReply } from "../shared/ipc";
import { contextActions, contextMenuTemplate } from "./contextMenu";
import { startGoogleSignIn, type GoogleSignIn } from "./googleSignIn";
import { menuTemplate } from "./menu";
import { APP_ORIGIN, APP_SCHEME, createAppProtocol } from "./protocol";
import { setupUpdates } from "./updater";
import { DEFAULT_SIZE, MIN_SIZE, parseState, visibleBounds, windowStateStore } from "./windowState";

// Dovli for Mac and Windows. The window shows the web app's workspace, built into the app
// (dist/renderer) and served from app://dovli/, so it opens and works with no internet. Pages live
// in the window's own storage (IndexedDB), and the web app's sync engine sends them to Dovli's
// server whenever it can reach it. See README.md.

/** Dovli's server: sync, sign-in and AI go here. DOVLI_SITE_URL points a test build elsewhere. */
const SITE = (process.env.DOVLI_SITE_URL || "https://dovli.in").replace(/\/$/, "");
/** Development: the Vite dev server instead of the built files (pnpm dev). */
const DEV_URL = app.isPackaged ? undefined : process.env.DOVLI_RENDERER_URL;
/** Tests run several copies side by side, each with its own data (DOVLI_PROFILE=name). */
if (process.env.DOVLI_PROFILE) app.setPath("userData", path.join(app.getPath("appData"), `Dovli-${process.env.DOVLI_PROFILE.replace(/[^\w-]/g, "")}`));

const mac = process.platform === "darwin";
const windows = process.platform === "win32";
/** The title bar's height, matching renderer/desktop.css. */
const BAR = { mac: 40, win: 36 };

protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) app.exit(0);
if (windows) app.setAppUserModelId("app.dovli.desktop");

let win: BrowserWindow | null = null;
/** Quitting for real (not just closing the window on a Mac). */
let quitting = false;
let googleSignIn: GoogleSignIn | null = null;

const isAppUrl = (url: string) => url.startsWith(`${APP_ORIGIN}/`) || (!!DEV_URL && url.startsWith(DEV_URL));
const isWebLink = (url: string) => /^(https?|mailto):/i.test(url);
const openExternal = (url: string) => void (isWebLink(url) && shell.openExternal(url));
const send = (command: DesktopCommand) => win?.webContents.send(IPC.command, command);

/** Asks the page to finish writing to this device (it saves a moment after each edit). 3 s at most. */
function savePage(w: BrowserWindow): Promise<void> {
  if (w.isDestroyed()) return Promise.resolve();
  const contents = w.webContents;
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      ipcMain.removeListener(IPC.beforeCloseDone, onDone);
      resolve();
    };
    const onDone = (ev: Electron.IpcMainEvent) => ev.sender === contents && done();
    const timer = setTimeout(done, 3000);
    ipcMain.on(IPC.beforeCloseDone, onDone);
    contents.send(IPC.beforeClose);
  });
}

function createWindow(state: ReturnType<typeof windowStateStore>) {
  const saved = state.get();
  const bounds = visibleBounds(saved.bounds, screen.getAllDisplays().map((d) => d.workArea));
  // Before the page has said which theme it uses: the one "Auto" would pick.
  const system = getTheme(nativeTheme.shouldUseDarkColors ? SYSTEM_DARK_THEME : SYSTEM_LIGHT_THEME).colors;
  const theme = saved.theme ?? { bg: system.bg, ink: system.ink, dark: nativeTheme.shouldUseDarkColors };
  const config: BridgeConfig = { platform: process.platform as BridgeConfig["platform"], version: app.getVersion(), siteUrl: SITE };

  const w = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...bounds,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    show: false,
    title: "Dovli",
    backgroundColor: theme.bg,
    ...(mac ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 16, y: 13 } } : {}),
    ...(windows ? { titleBarStyle: "hidden" as const, titleBarOverlay: { color: theme.bg, symbolColor: theme.ink, height: BAR.win } } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: true,
      // Keep syncing while the window is hidden or behind others.
      backgroundThrottling: false,
      additionalArguments: [CONFIG_ARG + encodeURIComponent(JSON.stringify(config))],
    },
  });
  if (saved.maximized) w.maximize();
  if (saved.fullscreen && mac) w.setFullScreen(true);
  w.once("ready-to-show", () => w.show());

  const remember = () => {
    if (w.isDestroyed() || w.isMinimized()) return;
    const patch = { maximized: w.isMaximized(), fullscreen: w.isFullScreen() };
    state.set(patch.maximized || patch.fullscreen ? patch : { ...patch, bounds: w.getBounds() });
  };
  for (const e of ["resize", "move", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen"] as const) w.on(e as "resize", remember);

  const contents = w.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (e, url) => {
    if (isAppUrl(url)) return;
    e.preventDefault();
    openExternal(url);
  });
  contents.on("will-attach-webview", (e) => e.preventDefault());
  contents.on("context-menu", (_, params) => {
    const items = contextMenuTemplate(params, process.platform, contextActions(contents, openExternal, (t) => clipboard.writeText(t), { x: params.x, y: params.y }));
    if (items.length) Menu.buildFromTemplate(items).popup({ window: w });
  });

  // Closing: let the page finish writing to this device first (it saves a moment after each edit).
  // On a Mac the app keeps running, and syncing, with its window hidden, as Mac apps do.
  let closing = false;
  w.on("close", (e) => {
    if (closing) return;
    e.preventDefault();
    if (mac && !quitting) {
      if (w.isFullScreen()) {
        w.once("leave-full-screen", () => w.hide());
        w.setFullScreen(false);
      } else w.hide();
      return;
    }
    closing = true;
    remember();
    state.flush();
    void savePage(w).then(() => {
      if (!w.isDestroyed()) w.destroy();
    });
  });
  w.on("closed", () => {
    if (win === w) win = null;
    if (quitting) app.quit();
  });

  void w.loadURL(DEV_URL ?? `${APP_ORIGIN}/`);
  return w;
}

function show() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

async function redeem(code: string, verifier: string): Promise<string> {
  let res: Response;
  try {
    res = await net.fetch(`${SITE}/api/auth/desktop/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, verifier }) });
  } catch {
    throw new Error("Couldn't reach Dovli. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !data.token) throw new Error(data.error ?? "Sign-in didn't work. Please try again.");
  return data.token;
}

app.on("second-instance", show);
app.on("before-quit", () => {
  quitting = true;
});
// An update about to install (src/main/updater.ts) closes the windows before it quits, so on a Mac
// they must close for real rather than hide.
autoUpdater.on("before-quit-for-update", () => {
  quitting = true;
});

void app.whenReady().then(() => {
  const state = windowStateStore(app.getPath("userData"));
  const root = path.join(__dirname, "../renderer");
  const handle = createAppProtocol({
    root,
    site: SITE,
    fetch: (url, init) => net.fetch(url, { ...init, bypassCustomProtocolHandlers: true }),
    async readFile(file) {
      try {
        if (!(await fs.promises.stat(file)).isFile()) return null;
      } catch {
        return null;
      }
      return net.fetch(pathToFileURL(file).toString());
    },
  });
  protocol.handle(APP_SCHEME, handle);

  // The page may use the clipboard, the microphone (dictation), notifications and full screen;
  // nothing else, and only Dovli's own page.
  const allowed = new Set(["clipboard-read", "clipboard-sanitized-write", "media", "notifications", "fullscreen"]);
  const fromApp = (url?: string) => !!url && (isAppUrl(url) || url === APP_ORIGIN);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) => cb(allowed.has(permission) && fromApp(details.requestingUrl)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && fromApp(origin));

  const updates = setupUpdates({
    window: () => win,
    beforeInstall: () => (win ? savePage(win) : Promise.resolve()),
    downloadUrl: `${SITE}/download`,
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate(process.platform, {
        command: (c) => {
          show();
          send(c);
        },
        checkForUpdates: () => updates.check(),
        openWebsite: (p) => void shell.openExternal(`${SITE}${p}`),
      }),
    ),
  );
  if (mac) app.setAboutPanelOptions({ applicationName: "Dovli", applicationVersion: app.getVersion(), copyright: `© ${new Date().getFullYear()} Dovli`, website: SITE });

  ipcMain.handle(IPC.googleSignIn, async (e): Promise<GoogleSignInReply> => {
    if (!win || e.sender !== win.webContents) return { token: null };
    googleSignIn?.cancel();
    const attempt = startGoogleSignIn({ site: SITE, openExternal: (url) => shell.openExternal(url), redeem, focusApp: show });
    googleSignIn = attempt;
    try {
      return { token: await attempt.result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Sign-in didn't work. Please try again." };
    } finally {
      if (googleSignIn === attempt) googleSignIn = null;
    }
  });
  ipcMain.on(IPC.googleSignInCancel, () => googleSignIn?.cancel());
  ipcMain.on(IPC.setTheme, (e, raw) => {
    const theme = parseState({ theme: raw }).theme;
    if (!theme || !win || e.sender !== win.webContents) return;
    state.set({ theme });
    win.setBackgroundColor(theme.bg);
    if (windows) win.setTitleBarOverlay({ color: theme.bg, symbolColor: theme.ink, height: BAR.win });
  });

  // Back from sleep: the network is usually back too, so check for changes straight away.
  powerMonitor.on("resume", () => send("sync-now"));

  win = createWindow(state);
  app.on("activate", () => {
    if (win) show();
    else win = createWindow(state);
  });
  app.on("will-quit", () => state.flush());
});

app.on("window-all-closed", () => {
  if (!mac || quitting) app.quit();
});

