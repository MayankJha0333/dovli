import type { ReactNode } from "react";
import { Switch as S, ToggleGroup as TG, RadioGroup as RG } from "radix-ui";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

/** An on/off switch. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="relative inline-flex h-5 w-9 flex-none items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-accent disabled:opacity-50"
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  );
}

/** A row of buttons where exactly one is chosen, like Small / Default / Large. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: IconName }[];
  label: string;
  className?: string;
}) {
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      className={cn("inline-flex rounded-md bg-well p-0.5 shadow-sm", className)}
    >
      {options.map((o) => (
        <TG.Item
          key={o.value}
          value={o.value}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-ink-3 transition-colors hover:text-ink data-[state=on]:bg-panel data-[state=on]:text-ink data-[state=on]:shadow-sm"
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </TG.Item>
      ))}
    </TG.Root>
  );
}

/** Large radio cards with a preview, used for the theme picker. */
export function RadioCards<T extends string>({
  value,
  onValueChange,
  label,
  children,
  className,
}: {
  value: T;
  onValueChange: (v: T) => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RG.Root value={value} onValueChange={(v) => onValueChange(v as T)} aria-label={label} className={className}>
      {children}
    </RG.Root>
  );
}

export function RadioCard({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RG.Item
      value={value}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg p-1.5 text-left outline-none transition-shadow focus-visible:shadow-[0_0_0_2px_var(--d-accent)] data-[state=checked]:shadow-[0_0_0_2px_var(--d-accent)]",
        className,
      )}
    >
      {children}
      <RG.Indicator className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-accent text-accent-ink shadow-sm">
        <Icon name="check" size={12} />
      </RG.Indicator>
    </RG.Item>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-accent", className)} />
  );
}

/** A small rounded tag, like "Edited 2 min ago". */
export function Pill({ children, className, tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "accent" | "danger" | "ok" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium tabular-nums",
        tone === "default" && "bg-well text-ink-3",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "ok" && "bg-well text-ok",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && (
        <span className="grid size-11 place-items-center rounded-md bg-well text-ink-3">
          <Icon name={icon} size={20} />
        </span>
      )}
      <p className="m-0 text-md font-semibold text-ink">{title}</p>
      {children && <div className="m-0 max-w-[46ch] text-sm text-ink-3">{children}</div>}
      {action}
    </div>
  );
}

/** A heading for a group of things, styled by the theme (sentence case, small caps or mono). */
export function SectionLabel({ children, className, action }: { children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn("flex h-7 items-center justify-between gap-2 px-2.5", className)}>
      <span className="label-text">{children}</span>
      {action}
    </div>
  );
}
