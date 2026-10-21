import { timeAgo } from "@dovli/core";
import type { SyncStatus } from "@dovli/sync";
import type { IconName } from "@dovli/ui";

export interface Chip {
  icon: IconName;
  text: string;
  detail: string;
  tone: "quiet" | "busy" | "warn" | "danger";
}

/**
 * What the title bar says about saving and syncing, or nothing when there's nothing to sync.
 * `online`: whether the computer has a connection at all (the sync engine reports "offline" either
 * way, but "can't reach Dovli" is the truer thing to say when the internet works).
 */
export function syncChip(sync: SyncStatus, save: "saved" | "saving" | "error", online = true, now = Date.now()): Chip | null {
  const waiting = sync.pending ? `${sync.pending} change${sync.pending > 1 ? "s" : ""} waiting` : "";
  const last = sync.lastSyncedAt ? `Last synced ${timeAgo(sync.lastSyncedAt, now)}.` : "";
  if (save === "error") return { icon: "alert", text: "Couldn't save", tone: "danger", detail: "This computer's storage is full or blocked. Your latest changes aren't saved yet." };
  switch (sync.state) {
    case "offline":
      if (online)
        return {
          icon: "cloudOff",
          text: waiting ? `Can't reach Dovli · ${waiting}` : "Can't reach Dovli",
          tone: "warn",
          detail: `Your internet is on, but Dovli's server isn't answering. Keep working: changes are saved on this computer and sync as soon as it's back. ${last}`.trim(),
        };
      return {
        icon: "cloudOff",
        text: waiting ? `Offline · ${waiting}` : "Offline",
        tone: "warn",
        detail: `You can keep working. Changes are saved on this computer and sync when you're back online. ${last}`.trim(),
      };
    case "error":
      return { icon: "alert", text: waiting ? `Sync paused · ${waiting}` : "Sync paused", tone: "danger", detail: `${sync.error ?? "Sync hit a problem."} Dovli tries again shortly.` };
    case "syncing":
      return { icon: "sync", text: "Syncing…", tone: "busy", detail: waiting ? `Sending ${waiting.replace(" waiting", "")}.` : "Checking for changes from your other devices." };
    case "synced":
      return { icon: "cloudCheck", text: "Synced", tone: "quiet", detail: `Everything is on your other devices too. ${last}`.trim() };
    default:
      return null;
  }
}
