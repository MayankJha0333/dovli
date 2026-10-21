// Dovli for Mac and Windows, drawn with the app's own tokens so it follows the theme: the window
// with its title bar (traffic lights on a Mac, the three buttons on Windows) and the sync status
// in it, the sidebar, and a page. Decorative: the text around it says what it shows.

import { COVER_PRESETS } from "@dovli/theme";
import { DovliMark, Icon, cn } from "@dovli/ui";

const dawn = COVER_PRESETS.find((c) => c.id === "dawn")!.css;

const pages = ["Launch plan", "Weekly review", "Reading notes", "Trip to Kyoto"];
const todos: [string, boolean][] = [
  ["Write the welcome email", true],
  ["Record a one-minute demo", true],
  ["Invite the first 200 people", false],
];

export function DesktopPicture({ os = "mac", sync = "synced", compact, className }: { os?: "mac" | "windows"; sync?: "synced" | "offline"; compact?: boolean; className?: string }) {
  const offline = sync === "offline";
  return (
    <div aria-hidden="true" className={cn("flex flex-col overflow-hidden rounded-[14px] bg-bg shadow-pop ring-1 ring-line", className)}>
      {/* Title bar: window buttons, and where syncing stands. */}
      <div className={cn("flex items-center gap-2 bg-bg", compact ? "h-7 px-2.5" : "h-9 px-3.5")}>
        {os === "mac" && (
          <span className="flex gap-1.5">
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <span key={c} className={cn("rounded-full", compact ? "size-2" : "size-2.5")} style={{ background: c }} />
            ))}
          </span>
        )}
        <span
          className={cn(
            "ml-auto flex items-center gap-1 rounded-full font-medium",
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[11px]",
            offline ? "bg-[color-mix(in_srgb,var(--d-warn)_16%,transparent)] text-[color-mix(in_srgb,var(--d-warn)_70%,var(--d-ink))]" : "text-ink-3",
          )}
        >
          <Icon name={offline ? "cloudOff" : "cloudCheck"} size={compact ? 9 : 12} />
          {offline ? "Offline · 2 changes waiting" : "Synced"}
        </span>
        {os === "windows" && (
          <span className={cn("-mr-3.5 flex text-ink-3", compact ? "-mr-2.5" : "")}>
            {["—", "▢", "✕"].map((g) => (
              <span key={g} className={cn("grid place-items-center", compact ? "h-7 w-7 text-[9px]" : "h-9 w-10 text-[11px]")}>
                {g}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className={cn("flex", compact ? "min-h-[150px] flex-1 gap-1.5 px-1.5 pb-1.5" : "h-[300px] gap-2 px-2 pb-2 sm:h-[340px]")}>
        {/* Sidebar */}
        <div className={cn("flex flex-none flex-col rounded-[10px] bg-panel shadow-sm", compact ? "w-[30%] gap-1 p-2" : "w-[28%] gap-1.5 p-3")}>
          <span className="flex items-center gap-1.5">
            <DovliMark size={compact ? 10 : 14} />
            <span className={cn("font-display font-bold text-ink", compact ? "text-[9px]" : "text-[12px]")}>Dovli</span>
          </span>
          <span className={cn("mt-1 flex flex-col", compact ? "gap-0.5" : "gap-1")}>
            {pages.map((p, i) => (
              <span
                key={p}
                className={cn("truncate rounded-[6px] text-ink-2", compact ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-1 text-[11px]", i === 0 && "bg-active font-semibold text-ink")}
              >
                {p}
              </span>
            ))}
          </span>
        </div>

        {/* The page */}
        <div className={cn("min-w-0 flex-1 overflow-hidden rounded-[10px] bg-panel shadow-sm", compact ? "p-2" : "p-4")}>
          <span className={cn("block rounded-[8px]", compact ? "h-6" : "h-14")} style={{ background: dawn }} />
          <span className={cn("relative ml-3 grid place-items-center rounded-[8px] font-serif text-accent shadow-[0_0_0_2px_var(--d-panel)] [background:linear-gradient(var(--d-accent-soft),var(--d-accent-soft)),var(--d-panel)]", compact ? "-mt-3 size-6 text-[11px]" : "-mt-5 size-10 text-[18px]")}>
            ✦
          </span>
          <span className={cn("mt-1.5 block font-serif font-bold leading-tight text-ink", compact ? "text-[12px]" : "text-[22px]")}>Launch plan</span>
          {!compact && <span className="mt-1 block text-[12px] text-ink-3">Edited just now · saved on this computer</span>}
          <span className={cn("flex flex-col", compact ? "mt-1.5 gap-1" : "mt-3 gap-2")}>
            {todos.map(([t, done]) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={cn("flex-none rounded-[3px]", compact ? "size-2" : "size-3.5", done ? "bg-accent" : "shadow-[inset_0_0_0_1px_var(--d-line-strong)]")} />
                <span className={cn("truncate", compact ? "text-[8px]" : "text-[13px]", done ? "text-ink-3 line-through" : "text-ink")}>{t}</span>
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The Windows logo's four panes (drawn, not the trademark artwork). */
export function WindowsIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className={className}>
      <path fill="currentColor" d="M1 2.6 6.7 1.8v5.6H1zm6.6-.9L15 .7v6.7H7.6zM1 8.3h5.7v5.6L1 13.1zm6.6 0H15V15l-7.4-1z" />
    </svg>
  );
}
