import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

export function TopBar({ onMenu, children, crumbs }: { onMenu: () => void; children?: ReactNode; crumbs?: ReactNode }) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn topbar__menu" aria-label="Open sidebar" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <div className="crumbs">{crumbs}</div>
      <div className="topbar__actions">{children}</div>
    </header>
  );
}

export function ToolButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" className="tool-btn" onClick={onClick} aria-label={label} data-tip={label}>
      <Icon name={icon} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Page view                                                           */
/* ------------------------------------------------------------------ */
