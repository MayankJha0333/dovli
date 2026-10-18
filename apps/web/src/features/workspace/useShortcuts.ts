import { useEffect } from "react";
import { store } from "@/lib/store";
import { settings } from "@/lib/settings";
import { ui } from "@/lib/ui";
import { newPage } from "@/features/pages/actions";

/** App-wide keyboard shortcuts. Page-level ones (find, style) live in the page view. */
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "⌘K", label: "Search and run commands" },
  { keys: "⌘⌥N", label: "New page" },
  { keys: "⌘F", label: "Find and replace in the page" },
  { keys: "⌘,", label: "Settings" },
  { keys: "⌘\\", label: "Show or hide the sidebar" },
  { keys: "⌘⇧I", label: "Open a page's Info panel" },
  { keys: "⌘⇧Y", label: "Open a page's Style panel" },
  { keys: "/", label: "Add a block (in a page)" },
  { keys: "[[", label: "Link to another page (in a page)" },
  { keys: "⌘ + click", label: "Open a #tag" },
];

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "k" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        ui.set({ palette: !ui.get().palette });
      } else if (k === "," && !e.shiftKey) {
        e.preventDefault();
        ui.set({ settings: "appearance" });
      } else if (e.key === "\\" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (window.matchMedia("(max-width: 860px)").matches) ui.set({ nav: !ui.get().nav });
        else settings.set({ sidebarHidden: !settings.get().sidebarHidden });
      } else if ((k === "n" || e.code === "KeyN") && e.altKey) {
        e.preventDefault();
        newPage("doc", store.get().route.name === "page" && e.shiftKey ? (store.get().route as any).id : null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
