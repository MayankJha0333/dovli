import type { ReactElement, ReactNode } from "react";
import { Tooltip as T } from "radix-ui";
import { Kbd } from "./Kbd";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={350} skipDelayDuration={200}>
      {children}
    </T.Provider>
  );
}

/** A small label that appears on hover or keyboard focus. The child must accept a ref. */
export function Tooltip({
  label,
  shortcut,
  side = "bottom",
  children,
}: {
  label: ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
}) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[400] flex select-none items-center gap-2 rounded-sm bg-ink px-2 py-1 text-xs font-medium text-bg shadow-pop animate-fade-in"
        >
          {label}
          {shortcut && <Kbd className="border-0 bg-bg/20 text-inherit">{shortcut}</Kbd>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
