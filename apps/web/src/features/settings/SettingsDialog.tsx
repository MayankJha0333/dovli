import { Dialog, Icon, cn, type IconName } from "@dovli/ui";
import { ui, useUI, type SettingsSection } from "@/lib/ui";
import { Account, AI, Appearance, Data, Privacy, Shortcuts, SyncBackups } from "./sections";
import { AIApps } from "./AIApps";

const SECTIONS: { id: SettingsSection; label: string; icon: IconName }[] = [
  { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "account", label: "Account", icon: "user" },
  { id: "sync", label: "Sync & backups", icon: "cloud" },
  { id: "data", label: "Import & export", icon: "importIcon" },
  { id: "ai", label: "AI", icon: "sparkles" },
  { id: "apps", label: "AI apps", icon: "plug" },
  { id: "privacy", label: "Privacy & data", icon: "shield" },
  { id: "shortcuts", label: "Shortcuts", icon: "keyboard" },
];

export function SettingsDialog() {
  const section = useUI((s) => s.settings);
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  return (
    <Dialog open={!!section} onOpenChange={(o) => !o && ui.set({ settings: null })} title="Settings" size="xl" bodyClassName="p-0" className="h-[min(720px,calc(100dvh-32px))]">
      <div className="grid h-full min-h-0 grid-cols-[208px_minmax(0,1fr)] max-[720px]:grid-cols-1 max-[720px]:grid-rows-[auto_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex flex-col gap-px border-r border-line px-2.5 pb-4 pt-1 max-[720px]:flex-row max-[720px]:overflow-x-auto max-[720px]:border-b max-[720px]:border-r-0 max-[720px]:pb-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={s.id === current.id ? "page" : undefined}
              onClick={() => ui.set({ settings: s.id })}
              className={cn(
                "flex h-row flex-none items-center gap-2.5 rounded-md px-2.5 text-left text-base text-ink-2 hover:bg-hover hover:text-ink",
                s.id === current.id && "bg-active font-semibold text-active-ink shadow-active hover:bg-active hover:text-active-ink",
              )}
            >
              <Icon name={s.icon} size={15} />
              <span className="whitespace-nowrap">{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="min-h-0 overflow-y-auto px-6 pb-8 pt-2 max-[720px]:px-4">
          <h2 className="m-0 mb-5 text-xl font-bold tracking-tight text-ink">{current.label}</h2>
          {current.id === "appearance" && <Appearance />}
          {current.id === "account" && <Account />}
          {current.id === "sync" && <SyncBackups />}
          {current.id === "data" && <Data />}
          {current.id === "ai" && <AI />}
          {current.id === "apps" && <AIApps />}
          {current.id === "privacy" && <Privacy />}
          {current.id === "shortcuts" && <Shortcuts />}
        </div>
      </div>
    </Dialog>
  );
}
