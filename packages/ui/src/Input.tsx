import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

export const inputStyles =
  "h-9 w-full min-w-0 rounded-md border-0 bg-well px-3 text-base text-ink shadow-sm outline-none transition-shadow placeholder:text-ink-4 focus:shadow-[0_0_0_2px_var(--d-accent)] disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(inputStyles, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(inputStyles, "h-auto min-h-24 py-2 leading-relaxed", className)} {...rest} />;
});

/** A text field with an icon inside on the left, and an optional thing on the right (like a key hint). */
export const IconInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon: IconName; end?: ReactNode; wrapperClassName?: string }
>(function IconInput({ icon, end, className, wrapperClassName, ...rest }, ref) {
  return (
    <label
      className={cn(
        "flex h-9 items-center gap-2 rounded-md bg-well px-3 text-ink-3 shadow-sm transition-shadow focus-within:text-ink-2 focus-within:shadow-[0_0_0_2px_var(--d-accent)]",
        wrapperClassName,
      )}
    >
      <Icon name={icon} size={15} />
      <input
        ref={ref}
        className={cn("h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-4", className)}
        {...rest}
      />
      {end}
    </label>
  );
});

/** A label, a control and an optional hint or error, wired together for screen readers. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      {children({ id, "aria-describedby": hintId, "aria-invalid": error ? true : undefined })}
      {(hint || error) && (
        <p id={hintId} className={cn("m-0 text-xs", error ? "text-danger" : "text-ink-3")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
