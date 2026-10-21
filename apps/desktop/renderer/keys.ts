import type { DesktopCommand } from "@/lib/desktop";

/** The desktop's keys: ⌘N / ⌘⇧N for a new page or whiteboard, and back / forward. */
export function commandForKey(e: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">, platform: string): DesktopCommand | null {
  const mod = platform === "darwin" ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (mod && !e.altKey && (e.code === "KeyN" || e.key.toLowerCase() === "n")) return e.shiftKey ? "new-board" : "new-page";
  if (platform === "darwin") {
    if (mod && !e.altKey && !e.shiftKey && e.key === "[") return "back";
    if (mod && !e.altKey && !e.shiftKey && e.key === "]") return "forward";
  } else if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    if (e.key === "ArrowLeft") return "back";
    if (e.key === "ArrowRight") return "forward";
  }
  return null;
}
