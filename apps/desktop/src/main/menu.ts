import type { MenuItemConstructorOptions } from "electron";
import type { DesktopCommand } from "@/lib/desktop";

// The menu bar. App commands go to the window (renderer/commands.ts), which also handles their
// keys itself, so on macOS the menu only shows the shortcut (registerAccelerator: false) and a
// key press never runs a command twice. Windows has no visible menu bar (the title bar is the app's
// own); its menu still offers the standard edit, view and window items and their keys.

export interface MenuActions {
  command(c: DesktopCommand): void;
  checkForUpdates(): void;
  openWebsite(path: string): void;
}

export function menuTemplate(platform: NodeJS.Platform, actions: MenuActions): MenuItemConstructorOptions[] {
  const mac = platform === "darwin";
  /** A command whose keys the window handles: shown in the menu, not grabbed by it. */
  const cmd = (label: string, command: DesktopCommand, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    click: () => actions.command(command),
    ...(accelerator && mac ? { accelerator, registerAccelerator: false } : {}),
  });

  const app: MenuItemConstructorOptions = {
    label: "Dovli",
    submenu: [
      { role: "about" },
      { label: "Check for Updates…", click: actions.checkForUpdates },
      { type: "separator" },
      cmd("Settings…", "settings", "Cmd+,"),
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ],
  };

  const file: MenuItemConstructorOptions = {
    label: "File",
    submenu: [
      cmd("New Page", "new-page", "CmdOrCtrl+N"),
      cmd("New Whiteboard", "new-board", "CmdOrCtrl+Shift+N"),
      { type: "separator" },
      cmd("Search…", "search", "CmdOrCtrl+K"),
      cmd("Sync Now", "sync-now"),
      { type: "separator" },
      ...(mac ? [{ role: "close" } as const] : [cmd("Settings…", "settings"), { type: "separator" } as const, { role: "quit" } as const]),
    ],
  };

  const edit: MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
      ...(mac
        ? ([
            { type: "separator" },
            { label: "Speech", submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }] },
          ] as MenuItemConstructorOptions[])
        : []),
    ],
  };

  const view: MenuItemConstructorOptions = {
    label: "View",
    submenu: [
      cmd("Show or Hide Sidebar", "toggle-sidebar", "Cmd+\\"),
      cmd("Assistant", "assistant", "Cmd+J"),
      { type: "separator" },
      cmd("Back", "back", "Cmd+["),
      cmd("Forward", "forward", "Cmd+]"),
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
      { type: "separator" },
      { role: "reload" },
      { role: "toggleDevTools" },
    ],
  };

  const window: MenuItemConstructorOptions = {
    label: "Window",
    submenu: mac ? [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] : [{ role: "minimize" }, { role: "close" }],
  };

  const help: MenuItemConstructorOptions = {
    role: "help",
    submenu: [
      { label: "Dovli Website", click: () => actions.openWebsite("/") },
      { label: "Privacy Policy", click: () => actions.openWebsite("/privacy") },
      ...(mac ? [] : [{ type: "separator" } as const, { label: "Check for Updates…", click: actions.checkForUpdates }, { role: "about" } as const]),
    ],
  };

  return [...(mac ? [app] : []), file, edit, view, window, help];
}
