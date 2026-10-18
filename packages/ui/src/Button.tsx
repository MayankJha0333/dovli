import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";
import { Tooltip } from "./Tooltip";

export const buttonStyles = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,box-shadow,filter,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** The one main action on a screen. */
        primary: "bg-primary text-primary-ink shadow-sm hover:bg-primary-hover",
        /** Accent-coloured action (used where the theme's primary is neutral). */
        accent: "bg-accent text-accent-ink hover:bg-accent-hover",
        /** A normal button on a surface. */
        secondary: "bg-well text-ink shadow-sm hover:bg-hover",
        /** A quiet button with no fill until hovered. */
        ghost: "bg-transparent text-ink-2 hover:bg-hover hover:text-ink",
        danger: "bg-danger text-white hover:brightness-110",
        dangerGhost: "bg-transparent text-danger hover:bg-danger-soft",
        link: "h-auto bg-transparent px-0 font-semibold text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-7 rounded-sm px-2.5 text-sm",
        md: "h-9 rounded-md px-3.5 text-base",
        lg: "h-11 rounded-md px-5 text-md",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  icon?: IconName;
  iconEnd?: IconName;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, icon, iconEnd, className, children, type = "button", ...rest },
  ref,
) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <button ref={ref} type={type} className={cn(buttonStyles({ variant, size, block }), className)} {...rest}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={iconSize} />}
    </button>
  );
});

export const iconButtonStyles = cva(
  "inline-grid flex-none place-items-center text-ink-3 transition-colors duration-150 hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-hover data-[state=open]:text-ink aria-pressed:bg-active aria-pressed:text-active-ink",
  {
    variants: {
      size: {
        xs: "size-6 rounded-xs",
        sm: "size-7 rounded-sm",
        md: "size-8 rounded-sm",
        lg: "size-10 rounded-md",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonStyles> {
  icon: IconName;
  /** Spoken by screen readers and shown as a tooltip. */
  label: string;
  /** Keyboard shortcut shown in the tooltip, e.g. "⌘K". */
  shortcut?: string;
  tooltip?: boolean;
}

/** A square button with just an icon. Always has a label for screen readers, and a tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, shortcut, size, tooltip = true, className, type = "button", ...rest },
  ref,
) {
  const iconSize = size === "xs" ? 13 : size === "sm" ? 14 : size === "lg" ? 18 : 16;
  const button = (
    <button ref={ref} type={type} aria-label={label} className={cn(iconButtonStyles({ size }), className)} {...rest}>
      <Icon name={icon} size={iconSize} />
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip label={label} shortcut={shortcut}>
      {button}
    </Tooltip>
  );
});
