import { useEffect } from "react";
import { newPage } from "@/features/pages/actions";
import { assistant } from "@/lib/assistant";
import { desktop, type DesktopCommand } from "@/lib/desktop";
import { settings } from "@/lib/settings";
import { store } from "@/lib/store";
import { sync } from "@/lib/sync";
import { ui } from "@/lib/ui";
import { commandForKey } from "./keys";

// The menu bar's commands, and the desktop's own keys for them. The web app already handles
// ⌘K, ⌘J, ⌘, and ⌘\ itself (features/workspace/useShortcuts.ts); these add what a desktop app has.

export function runCommand(command: DesktopCommand) {
  switch (command) {
    case "new-page":
      return void newPage("doc");
    case "new-board":
      return void newPage("board");
    case "search":
      return ui.set({ palette: true });
    case "settings":
      return ui.set({ settings: "appearance" });
    case "toggle-sidebar":
      return settings.set({ sidebarHidden: !settings.get().sidebarHidden });
    case "assistant":
      return assistant.toggle();
    case "sync-now":
      return sync.now();
    case "back":
      return history.back();
    case "forward":
      return history.forward();
  }
}

/** While the workspace is open: menu commands, keys, and saving everything before the window closes. */
export function useDesktopCommands() {
  useEffect(() => {
    if (!desktop) return;
    const off = desktop.onCommand(runCommand);
    desktop.onBeforeClose(() => store.flush());
    const onKey = (e: KeyboardEvent) => {
      // The editor got there first (its own use of the key).
      if (e.defaultPrevented) return;
      const command = commandForKey(e, desktop!.platform);
      if (!command) return;
      e.preventDefault();
      runCommand(command);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      off();
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
