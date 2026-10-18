import type { ReactNode } from "react";
import { IconButton, cn } from "@dovli/ui";
import { ui } from "@/lib/ui";

/**
 * The bar at the top of every view: breadcrumbs on the left, actions on the right.
 * Chip themes (Soft Studio, Frost) float both groups as rounded glass chips; flat themes
 * (Night Desk, Mica) draw a plain bar with a hairline. The tokens decide; this markup is the same.
 */
export function TopBar({ crumbs, children, className, bareActions }: { crumbs?: ReactNode; children?: ReactNode; className?: string; bareActions?: boolean }) {
  return (
    <header
      data-print="hide"
      className={cn(
        "relative z-20 flex h-14 flex-none items-center gap-2 px-3 [border-bottom:var(--d-topbar-border)] max-[860px]:pt-[env(safe-area-inset-top)]",
        className,
      )}
    >
      <IconButton icon="menu" label="Open sidebar" className="min-[861px]:hidden" onClick={() => ui.set({ nav: true })} />
      <nav aria-label="Breadcrumb" className="flex h-9 min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap px-1.5 surface-chip">
        {crumbs}
      </nav>
      {bareActions ? (
        <div className="ml-auto flex flex-none items-center">{children}</div>
      ) : (
        <div className="ml-auto flex h-9 flex-none items-center gap-0.5 px-1 surface-chip empty:hidden">{children}</div>
      )}
    </header>
  );
}

export function Crumb({ children, onClick, current }: { children: ReactNode; onClick?: () => void; current?: boolean }) {
  if (current)
    return (
      <span aria-current="page" className="flex min-w-0 items-center gap-1.5 truncate px-1.5 text-sm font-semibold text-ink">
        {children}
      </span>
    );
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-1.5 truncate rounded-sm px-1.5 py-1 text-sm text-ink-3 hover:bg-hover hover:text-ink max-[640px]:hidden">
      {children}
    </button>
  );
}

export function CrumbSep() {
  return (
    <span aria-hidden="true" className="text-ink-4 max-[640px]:hidden">
      /
    </span>
  );
}
