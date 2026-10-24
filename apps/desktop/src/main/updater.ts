import fs from "node:fs";
import path from "node:path";
import { app, autoUpdater as nativeUpdater, dialog, shell, type BrowserWindow, type MessageBoxOptions } from "electron";
import { autoUpdater, type UpdateDownloadedEvent } from "electron-updater";
import { bundleOf, canWrite, cantReplace, clearOldStages, macSigning, prepareUpdate, scheduleSwap, verifyApp } from "./macInstall";

// Updates come from the app's GitHub releases (electron-builder.yml → publish). Dovli checks 15
// seconds after opening and every 4 hours, downloads in the background, and once the update is
// really ready to install asks, once per version, whether to restart now. "Later" installs it the
// next time Dovli quits.
//
// How it installs:
// - Windows: electron-updater runs the new installer once Dovli has quit, then opens Dovli again.
// - Mac signed with a Developer ID: macOS's own updater (Squirrel.Mac) installs it.
// - Mac signed ad hoc (no Developer ID yet): Squirrel.Mac refuses any update it can't tie to the
//   same developer, so Dovli installs it itself (macInstall.ts). Before this, Dovli said the
//   update was ready as soon as the download finished, Squirrel.Mac then quietly turned it down,
//   and the same "ready" message came back on every launch.
//
// Background checks stay quiet when something goes wrong (offline, say); a check from the menu,
// and a restart the person asked for, always answer. Everything goes to updates.log in Dovli's
// logs folder (Mac: ~/Library/Logs/Dovli, Windows: %APPDATA%\Dovli\logs).

const EVERY = 4 * 60 * 60 * 1000;

type Mode = "nsis" | "squirrel" | "self";

interface Options {
  window: () => BrowserWindow | null;
  /** Finishes writing the open page to this device, before Dovli quits to install. */
  beforeInstall: () => Promise<void>;
  /** Where people can download Dovli by hand when an update can't install itself. */
  downloadUrl: string;
}

function fileLogger(file: string) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.statSync(file).size > 1_000_000) fs.truncateSync(file, 0);
  } catch {
    // No log yet.
  }
  const line =
    (level: string) =>
    (...parts: unknown[]) => {
      try {
        fs.appendFileSync(file, `${new Date().toISOString()} ${level} ${parts.map((p) => (p instanceof Error ? (p.stack ?? p.message) : String(p))).join(" ")}\n`);
      } catch {
        // Logging must never break updating.
      }
    };
  return { info: line("info"), warn: line("warn"), error: line("error"), debug: line("debug") };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function setupUpdates({ window, beforeInstall, downloadUrl }: Options) {
  const box = async (options: MessageBoxOptions) => {
    const w = window();
    return w ? dialog.showMessageBox(w, options) : dialog.showMessageBox(options);
  };
  const tell = (title: string, detail: string, type: "info" | "error" = "info") => void box({ type, message: title, detail, buttons: ["OK"] });
  /** An error the person should see, with a way to get the new version by hand. */
  const failed = async (title: string, detail: string) => {
    const { response } = await box({ type: "error", message: title, detail, buttons: ["Download from dovli.in", "OK"], defaultId: 0, cancelId: 1 });
    if (response === 0) void shell.openExternal(downloadUrl);
  };

  if (!app.isPackaged) {
    return { check: () => tell("Updates come with the installed app", "This copy of Dovli is running from source, so it doesn't update itself.") };
  }

  const logFile = path.join(app.getPath("logs"), "updates.log");
  const log = fileLogger(logFile);
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  // Windows: open Dovli again after an install the person started.
  autoUpdater.autoRunAppAfterInstall = true;

  const bundle = process.platform === "darwin" ? bundleOf(app.getPath("exe")) : null;
  /** Where the Mac installs it itself unpacks updates, one folder per version. */
  const stages = path.join(app.getPath("userData"), "update");

  const mode: Promise<Mode> = (async () => {
    if (process.platform !== "darwin") return "nsis";
    const signing = bundle ? await macSigning(bundle) : "unsigned";
    log.info(`Mac app at ${bundle} is signed: ${signing}`);
    if (signing === "developer-id") return "squirrel";
    void clearOldStages(stages, app.getVersion());
    return "self";
  })();
  const ready = mode.then((m) => {
    // Squirrel.Mac and the NSIS installer install on quit by themselves; Dovli's own Mac install
    // does it in will-quit, below. Left on in "self" mode, Squirrel.Mac would only fetch the
    // update to refuse it.
    autoUpdater.autoInstallOnAppQuit = m !== "self";
    return m;
  });

  let manual = false;
  /** Restart Now was picked and Dovli is on its way out. */
  let installing = false;
  /** The newest version that can be installed right now. */
  let readyVersion: string | null = null;
  /** The versions Dovli has already asked about; "Later" means don't ask again this run. */
  const asked = new Set<string>();
  /** The Mac's own install: the unpacked update, waiting to be swapped in. */
  let staged: { version: string; app: string; dir: string } | null = null;
  let swapScheduled = false;
  /** Versions whose own install was turned down or failed, so background checks don't repeat it. */
  const blocked = new Set<string>();

  const installNow = async () => {
    if (installing) return;
    installing = true;
    const m = await ready;
    try {
      await beforeInstall();
      if (m === "self") {
        if (!staged || !bundle || !fs.existsSync(staged.app)) throw new Error("The downloaded update has gone missing. Choose Check for Updates… to fetch it again.");
        await verifyApp(staged.app);
        log.info(`Installing ${staged.version} myself, then reopening`);
        scheduleSwap({ pid: process.pid, staged: staged.app, installed: bundle, stage: staged.dir, relaunch: true, log: logFile });
        swapScheduled = true;
        app.quit();
      } else {
        // Silent, then open again: the person already said yes, the installer needn't ask.
        autoUpdater.quitAndInstall(true, true);
      }
    } catch (e) {
      installing = false;
      log.error("Install failed", e);
      void failed("Couldn't install the update", `${message(e)}\n\nYour pages are safe. You can also download the new version from dovli.in.`);
    }
  };

  const offer = async (version: string, force = false) => {
    readyVersion = version;
    if (installing || (asked.has(version) && !force)) return;
    asked.add(version);
    const { response } = await box({
      type: "info",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
      message: `Dovli ${version} is ready`,
      detail: "Restart Dovli to finish updating, or it updates the next time you quit. Your pages are saved, and anything not synced yet syncs after the restart.",
    });
    if (response === 0) await installNow();
  };

  /** Unpacks under way, by version: a check while one runs waits for it rather than starting again. */
  const unpacking = new Map<string, Promise<void>>();
  /** Mac, own install: unpack and check the download, then offer it. */
  const stage = async (info: UpdateDownloadedEvent, wasManual: boolean): Promise<void> => {
    const running = unpacking.get(info.version);
    if (running) return running;
    const job = unpack(info, wasManual).finally(() => unpacking.delete(info.version));
    unpacking.set(info.version, job);
    return job;
  };
  const unpack = async (info: UpdateDownloadedEvent, wasManual: boolean) => {
    if (staged?.version === info.version && fs.existsSync(staged.app)) return offer(info.version, wasManual);
    if (blocked.has(info.version) && !wasManual) return;
    const reason = bundle ? cantReplace(bundle, await canWrite(bundle)) : "Dovli couldn't find where it's installed.";
    if (reason) {
      blocked.add(info.version);
      log.warn(`Can't install ${info.version} here: ${reason}`);
      const { response } = await box({ type: "info", message: `Dovli ${info.version} is out`, detail: reason, buttons: ["Download from dovli.in", "Later"], defaultId: 0, cancelId: 1 });
      if (response === 0) void shell.openExternal(downloadUrl);
      return;
    }
    const dir = path.join(stages, info.version);
    try {
      log.info(`Unpacking ${info.downloadedFile} into ${dir}`);
      const appPath = await prepareUpdate({ zip: info.downloadedFile, dir, bundleId: "app.dovli.desktop", version: info.version });
      staged = { version: info.version, app: appPath, dir };
      log.info(`Ready to install ${info.version}`);
    } catch (e) {
      blocked.add(info.version);
      log.error(`Couldn't prepare ${info.version}`, e);
      if (wasManual) void failed("Couldn't get the update ready", message(e));
      return;
    }
    await offer(info.version, wasManual);
  };

  autoUpdater.on("update-not-available", () => {
    if (manual) tell("You're up to date", `Dovli ${app.getVersion()} is the newest version.`);
    manual = false;
  });
  autoUpdater.on("update-available", (info) => {
    if (manual) tell(`Dovli ${info.version} is on its way`, "It's downloading now. Dovli will ask you to restart when it's ready.");
    manual = false;
  });
  autoUpdater.on("error", (e) => {
    log.error("Updater error", e);
    if (installing) {
      installing = false;
      void failed("Couldn't install the update", `${message(e)}\n\nYour pages are safe. You can also download the new version from dovli.in.`);
    } else if (manual) {
      tell("Couldn't check for updates", e?.message ? `Check your internet connection and try again. (${e.message})` : "Check your internet connection and try again.", "error");
    }
    manual = false;
  });

  // electron-updater says "downloaded" as soon as it has the file. On Windows that's ready. On a
  // Mac it's only the start: Squirrel.Mac (or Dovli's own install) still has to take it.
  let wasManual = false;
  let squirrelVersion: string | null = null;
  autoUpdater.on("update-downloaded", (info) => {
    void ready.then((m) => {
      if (m === "nsis") return offer(info.version, wasManual);
      if (m === "squirrel") {
        squirrelVersion = info.version;
        return;
      }
      return stage(info, wasManual);
    });
  });
  // Squirrel.Mac has fetched and checked the update: now it can really install.
  nativeUpdater.on("update-downloaded", () => {
    if (squirrelVersion) void offer(squirrelVersion);
  });

  // Mac, own install: "Later" (or never answering) installs it when Dovli quits, as the other
  // updaters do. The windows have closed and saved by now.
  app.on("will-quit", () => {
    if (swapScheduled || !staged || !bundle || !fs.existsSync(staged.app)) return;
    log.info(`Installing ${staged.version} on quit`);
    try {
      scheduleSwap({ pid: process.pid, staged: staged.app, installed: bundle, stage: staged.dir, relaunch: false, log: logFile });
      swapScheduled = true;
    } catch (e) {
      log.error("Couldn't start the install on quit", e);
    }
  });

  const check = async (fromMenu = false) => {
    await ready;
    // An update already waiting: offer it again, and still look for a newer one quietly.
    if (fromMenu && readyVersion) {
      void offer(readyVersion, true);
      fromMenu = false;
    }
    manual = fromMenu;
    wasManual = fromMenu;
    autoUpdater.checkForUpdates().catch(() => {});
  };
  setTimeout(() => void check(), 15_000);
  setInterval(() => void check(), EVERY);
  return { check: () => void check(true) };
}
