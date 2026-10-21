import { Icon, Tooltip, TooltipProvider, cn } from "@dovli/ui";
import { useStore } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import { ui } from "@/lib/ui";
import { syncChip } from "./syncChip";

// The window's title bar: a strip that drags the window, and where things stand with syncing, so
// it's always clear whether this computer's changes have reached your other devices.

function SyncChip() {
  const sync = useSyncStatus();
  const save = useStore((s) => s.saveStatus);
  const chip = syncChip(sync, save, navigator.onLine);
  if (!chip) return null;
  return (
    <Tooltip label={<span className="block max-w-[260px] whitespace-normal">{chip.detail}</span>} side="bottom">
      <button
        type="button"
        onClick={() => ui.set({ settings: "sync" })}
        aria-label={`${chip.text}. ${chip.detail} Open sync settings.`}
        className={cn(
          "dt-no-drag flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
          chip.tone === "quiet" && "text-ink-3 hover:bg-hover hover:text-ink-2",
          chip.tone === "busy" && "text-ink-2 hover:bg-hover",
          chip.tone === "warn" && "bg-[color-mix(in_srgb,var(--d-warn)_14%,transparent)] text-[color-mix(in_srgb,var(--d-warn)_70%,var(--d-ink))]",
          chip.tone === "danger" && "bg-danger-soft text-[color-mix(in_srgb,var(--d-danger)_78%,var(--d-ink))]",
        )}
      >
        <Icon name={chip.icon} size={14} className={cn("flex-none", chip.tone === "busy" && "animate-spin [animation-duration:1.4s]")} />
        <span className="whitespace-nowrap">{chip.text}</span>
      </button>
    </Tooltip>
  );
}

export function TitleBar({ showSync }: { showSync: boolean }) {
  return (
    <TooltipProvider>
      <div
        data-print="hide"
        className="dt-titlebar dt-drag fixed inset-x-0 top-0 z-[300] flex h-[var(--dt-bar)] items-center justify-end pl-[var(--dt-bar-left)] pr-[var(--dt-bar-right)]"
      >
        {showSync && <SyncChip />}
      </div>
    </TooltipProvider>
  );
}
