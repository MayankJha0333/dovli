import { Icon, cn, type IconName } from "@dovli/ui";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import { ui } from "@/lib/ui";

/**
 * Saving and syncing happen on their own, so the sidebar says nothing while they work.
 * This note appears only when something needs you: a page couldn't be saved, sync has stopped,
 * or you're offline with changes waiting. Click it for the details in Settings.
 */
export function SyncNotice() {
  const save = useStore((s) => s.saveStatus);
  const sync = useSyncStatus();
  const account = useAuth((a) => a.account);

  let note: { icon: IconName; text: string; tone: "danger" | "warn" } | null = null;
  if (save === "error") note = { icon: "alert", text: "Couldn't save. Storage is full or blocked", tone: "danger" };
  else if (sync.state === "error") note = { icon: "alert", text: "Sync paused. Retrying", tone: "danger" };
  else if (sync.state === "offline" && sync.pending)
    note = { icon: "cloudOff", text: `Offline. ${sync.pending} change${sync.pending > 1 ? "s" : ""} will sync later`, tone: "warn" };

  return (
    <div aria-live="polite" className="empty:hidden">
      {note && (
        <button
          type="button"
          onClick={() => ui.set({ settings: account ? "sync" : "data" })}
          className={cn(
            "mb-1 flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium transition-[filter] hover:brightness-95",
            note.tone === "danger" ? "bg-danger-soft text-[color-mix(in_srgb,var(--d-danger)_78%,var(--d-ink))]" : "bg-[color-mix(in_srgb,var(--d-warn)_14%,transparent)] text-[color-mix(in_srgb,var(--d-warn)_70%,var(--d-ink))]",
          )}
        >
          <Icon name={note.icon} size={14} className="flex-none" />
          <span className="truncate">{note.text}</span>
        </button>
      )}
    </div>
  );
}
