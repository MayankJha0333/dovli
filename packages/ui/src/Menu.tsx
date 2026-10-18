import type { ComponentProps, ReactNode } from "react";
import { DropdownMenu as M, Popover as P } from "radix-ui";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";
import { Kbd } from "./Kbd";

// Drop-down menus and popovers. Built on Radix, so arrow keys, Escape, focus return and screen
// readers all work without extra code.

export const MenuRoot = M.Root;
export const MenuTrigger = M.Trigger;

const panel = "z-[350] min-w-48 overflow-hidden rounded-lg p-1 text-ink surface-raised animate-pop-in focus:outline-none";

export function MenuContent({ className, align = "end", sideOffset = 6, children, ...rest }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={sideOffset} collisionPadding={12} className={cn(panel, className)} {...rest}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

const itemStyles =
  "relative flex h-8 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2 text-base text-ink-2 outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-45";

export function MenuItem({
  icon,
  shortcut,
  danger,
  children,
  className,
  ...rest
}: ComponentProps<typeof M.Item> & { icon?: IconName; shortcut?: string; danger?: boolean }) {
  return (
    <M.Item className={cn(itemStyles, danger && "text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger", className)} {...rest}>
      {icon && <Icon name={icon} size={15} className={danger ? "" : "text-ink-3"} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </M.Item>
  );
}

export function MenuCheckboxItem({ children, className, ...rest }: ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem className={cn(itemStyles, className)} {...rest}>
      <span className="grid size-4 place-items-center">
        <M.ItemIndicator>
          <Icon name="check" size={14} className="text-accent" />
        </M.ItemIndicator>
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </M.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="label-text px-2 pb-1 pt-2">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line" />;
}

export const MenuSub = M.Sub;
export function MenuSubTrigger({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <M.SubTrigger className={cn(itemStyles, "data-[state=open]:bg-hover")}>
      {icon && <Icon name={icon} size={15} className="text-ink-3" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <Icon name="chevron" size={12} className="text-ink-4" />
    </M.SubTrigger>
  );
}
export function MenuSubContent({ className, children, ...rest }: ComponentProps<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent sideOffset={4} collisionPadding={12} className={cn(panel, className)} {...rest}>
        {children}
      </M.SubContent>
    </M.Portal>
  );
}

export const PopoverRoot = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export function PopoverContent({ className, align = "start", sideOffset = 8, children, ...rest }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn("z-[350] rounded-lg p-3 text-ink surface-raised animate-pop-in focus:outline-none", className)}
        {...rest}
      >
        {children}
      </P.Content>
    </P.Portal>
  );
}
