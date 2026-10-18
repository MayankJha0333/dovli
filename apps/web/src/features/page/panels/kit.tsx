// Building blocks for the page panels (Format, Style, Info), in the spirit of Craft's panels:
// a titled card with labelled sections, big rounded tiles, and rows of icon buttons.

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, cn, type IconName } from "@dovli/ui";

/** Keeps the cursor and selection in the page while a panel button is pressed. */
export const keepSelection = { onMouseDown: (e: React.MouseEvent) => e.preventDefault() };

export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-3 pt-0.5">
      <h2 className="m-0 font-display text-lg font-bold tracking-tight text-ink">{children}</h2>
      {aside}
    </div>
  );
}

/** A labelled part of a panel. Collapsible sections remember nothing: they start open. */
export function Section({ title, children, collapsible = false, defaultOpen = true, className }: { title: string; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("border-t border-line py-3 first-of-type:border-t-0 first-of-type:pt-1", className)}>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="-mx-1 mb-1 flex h-7 w-[calc(100%+0.5rem)] items-center justify-between rounded-sm px-1 text-left hover:bg-hover"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{title}</span>
          <Icon name={open ? "chevronDown" : "chevron"} size={13} className="text-ink-3" />
        </button>
      ) : (
        <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{title}</h3>
      )}
      {open && children}
    </section>
  );
}

/** A big rounded button, like Craft's Title / Subtitle / Heading. */
export function Tile({ active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md px-2.5 text-base text-ink transition-[background-color,box-shadow,color] duration-150",
        "bg-well hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40",
        // Chosen: the accent outline and tint show it; the label stays in the text colour so it reads well.
        active && "bg-accent-soft font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--d-accent)] hover:bg-accent-soft",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A joined row of icon buttons (marks, lists, alignment). */
export function IconRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex h-10 overflow-hidden rounded-md bg-well [&>*+*]:border-l [&>*+*]:border-line", className)}>{children}</div>;
}

export function IconRowButton({ icon, label, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "grid min-w-0 flex-1 place-items-center text-ink-2 transition-colors hover:bg-hover hover:text-ink focus-visible:bg-hover focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35",
        active && "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent",
      )}
      {...rest}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

/** A row in a list of actions, like "Move to…" or "Delete". */
export function ActionRow({ icon, children, danger, hint, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; danger?: boolean; hint?: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md bg-well px-3 text-left text-base text-ink transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        danger && "bg-danger-soft font-semibold text-[color-mix(in_srgb,var(--d-danger)_78%,var(--d-ink))] hover:bg-danger-soft hover:brightness-95",
      )}
      {...rest}
    >
      <Icon name={icon} size={16} className={danger ? "text-danger" : "text-ink-3"} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </button>
  );
}

/** A label on the left, a value on the right. */
export function Prop({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2.5 text-base">
      <Icon name={icon} size={15} className="text-ink-3" />
      <span className="text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 truncate text-ink">{children}</span>
    </div>
  );
}
