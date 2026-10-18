import type { ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { cn } from "./cn";
import { IconButton } from "./Button";

export const DialogRoot = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/**
 * A modal window. Traps keyboard focus, closes on Escape or a click outside, and gives itself an
 * accessible name from `title`. Use size="lg" for galleries and settings.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  hideTitle,
  size = "md",
  children,
  footer,
  className,
  bodyClassName,
  initialFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Keep the title for screen readers but do not show it. */
  hideTitle?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Called when the dialog opens, to move focus somewhere better than the first button. */
  initialFocus?: (e: Event) => void;
}) {
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[300] bg-overlay backdrop-blur-[3px] animate-fade-in" />
        <D.Content
          onOpenAutoFocus={(e) => {
            if (initialFocus) return initialFocus(e);
            // Keep focus on a field that asked for it (autoFocus); otherwise focus the dialog itself,
            // so screen readers start at the title instead of on the close button.
            const box = e.currentTarget as HTMLElement;
            const active = document.activeElement;
            if (active && active !== box && box.contains(active)) return;
            e.preventDefault();
            box.focus();
          }}
          tabIndex={-1}
          className={cn(
            "fixed left-1/2 top-1/2 z-[301] flex max-h-[min(860px,calc(100dvh-32px))] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl text-ink surface-raised animate-pop-in focus:outline-none",
            width,
            className,
          )}
        >
          <div className={cn("flex items-start gap-3 px-5 pb-2 pt-4", hideTitle && "sr-only")}>
            <div className="min-w-0 flex-1">
              <D.Title className="m-0 text-lg font-bold tracking-tight text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="m-0 mt-1 text-sm text-ink-3">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
              )}
            </div>
            <D.Close asChild>
              <IconButton icon="close" label="Close" size="sm" tooltip={false} className="-mr-1.5 mt-0.5" />
            </D.Close>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2", bodyClassName)}>{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
