import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/** A keyboard key, like ⌘K. */
export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-xs border border-line bg-well px-1 font-mono text-2xs font-medium text-ink-2",
        className,
      )}
      {...rest}
    />
  );
}

/** "⌘" on Apple devices, "Ctrl" elsewhere. */
export const modKey = () => {
  try {
    return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl+";
  } catch {
    return "⌘";
  }
};
