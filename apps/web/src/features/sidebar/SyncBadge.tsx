import { timeAgo } from "@dovli/core";
import { Icon, cn, type IconName } from "@dovli/ui";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import { ui } from "@/lib/ui";

/** Where your pages are saved right now, in plain words. Click it for the details. */
export function SyncBadge() {
  const save = useStore((s) => s.saveStatus);
  const sync = useSyncStatus();
  const account = useAuth((a) => a.account);

  let icon: IconName = "device";
  let text = "Saved on this device";
  let tone = "text-ink-3";
  if (save === "error") {
    icon = "alert";
    text = "Couldn't save. Storage is full or blocked";
    tone = "text-danger";
  } else if (save === "saving") {
    text = "Saving";
  } else if (sync.state === "synced") {
    icon = "cloudCheck";
    text = sync.lastSyncedAt ? `Synced ${timeAgo(sync.lastSyncedAt)}` : "Synced";
  } else if (sync.state === "syncing") {
    icon = "sync";
    text = sync.pending ? `Syncing ${sync.pending} change${sync.pending > 1 ? "s" : ""}` : "Syncing";
  } else if (sync.state === "offline") {
    icon = "cloudOff";
    text = sync.pending ? `Offline. ${sync.pending} change${sync.pending > 1 ? "s" : ""} will sync later` : "Offline. Saved on this device";
    tone = "text-warn";
  } else if (sync.state === "error") {
    icon = "alert";
    text = "Sync paused. Retrying";
    tone = "text-danger";
  } else if (sync.state === "signed-out") {
    text = "Saved on this device. Sign in to sync";
  }

  return (
    <button
      type="button"
      onClick={() => ui.set({ settings: account ? "sync" : "account" })}
      className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-hover", tone)}
      aria-live="polite"
    >
      <Icon name={icon} size={14} className={cn("flex-none", sync.state === "syncing" && "animate-spin [animation-duration:2s]")} />
      <span className="truncate">{text}</span>
    </button>
  );
}
