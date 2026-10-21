import { app, dialog, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

// Updates from the app's GitHub releases (electron-builder.yml → publish). Checked a little after
// launch and every few hours, downloaded in the background, then the person picks when to restart.
// Background checks stay quiet when something goes wrong (offline, say); a check from the menu
// always answers.

const EVERY = 4 * 60 * 60 * 1000;

export function setupUpdates(window: () => BrowserWindow | null, beforeInstall: () => void) {
  let manual = false;
  const tell = (message: string, detail: string, type: "info" | "error" = "info") => {
    const w = window();
    const options = { type, message, detail, buttons: ["OK"] };
    void (w ? dialog.showMessageBox(w, options) : dialog.showMessageBox(options));
  };

  if (!app.isPackaged) {
    return { check: () => tell("Updates come with the installed app", "This copy of Dovli is running from source, so it doesn't update itself.") };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on("update-not-available", () => {
    if (manual) tell("You're up to date", `Dovli ${app.getVersion()} is the newest version.`);
    manual = false;
  });
  autoUpdater.on("update-available", (info) => {
    if (manual) tell(`Dovli ${info.version} is on its way`, "It's downloading now. Dovli will ask you to restart when it's ready.");
    manual = false;
  });
  autoUpdater.on("error", (e) => {
    if (manual) tell("Couldn't check for updates", e?.message ? `Check your internet connection and try again. (${e.message})` : "Check your internet connection and try again.", "error");
    manual = false;
  });
  autoUpdater.on("update-downloaded", async (info) => {
    const w = window();
    const options = {
      type: "info" as const,
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
      message: `Dovli ${info.version} is ready`,
      detail: "Restart Dovli to finish updating. Your pages are saved, and anything not synced yet syncs after the restart.",
    };
    const { response } = await (w ? dialog.showMessageBox(w, options) : dialog.showMessageBox(options));
    if (response === 0) {
      beforeInstall();
      autoUpdater.quitAndInstall();
    }
  });

  const check = (fromMenu = false) => {
    manual = fromMenu;
    autoUpdater.checkForUpdates().catch(() => {});
  };
  setTimeout(check, 15_000);
  setInterval(check, EVERY);
  return { check: () => check(true) };
}
