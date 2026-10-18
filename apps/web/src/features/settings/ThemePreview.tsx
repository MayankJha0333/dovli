import { themeVariables, type AppTheme } from "@dovli/theme";
import { cn } from "@dovli/ui";

/** CSS variables for one theme, to paint a preview of it inside any other theme. */
export function themeStyle(t: AppTheme): React.CSSProperties {
  const { "color-scheme": scheme, ...vars } = themeVariables(t);
  return { ...(vars as React.CSSProperties), colorScheme: scheme as any };
}

/**
 * A miniature of the app in a theme. It uses the very same classes as the real app, wrapped in that
 * theme's variables, so what you see here is exactly what you get.
 */
export function ThemePreview({ theme, className }: { theme: AppTheme; className?: string }) {
  const glass = theme.colors.glows.length > 0;
  const gap = theme.layout.gap ? "gap-1.5 p-1.5" : "gap-0 p-0";
  return (
    <div style={themeStyle(theme)} className={cn("relative isolate aspect-[16/10] overflow-hidden rounded-md bg-bg text-ink", className)} aria-hidden="true">
      {glass && (
        <>
          <span className="absolute -left-6 -top-8 size-24 rounded-full bg-[var(--d-glow-1)] opacity-[var(--d-glow-1-o)] blur-xl" />
          <span className="absolute -right-6 bottom-0 size-20 rounded-full bg-[var(--d-glow-2)] opacity-[var(--d-glow-2-o)] blur-xl" />
          <span className="absolute bottom-[-30%] left-1/3 size-20 rounded-full bg-[var(--d-glow-3)] opacity-[var(--d-glow-3-o)] blur-xl" />
        </>
      )}
      <div className={cn("relative grid h-full grid-cols-[34%_1fr]", gap)}>
        <div className="flex flex-col gap-1 rounded-[calc(var(--d-radius-shell)/3)] p-1.5 shadow-shell surface-sidebar [border-right:var(--d-divider)]">
          <div className="mb-0.5 flex items-center gap-1">
            <span className="size-2.5 rounded-[3px] bg-brand" />
            <span className="h-1.5 w-8 rounded-full bg-ink opacity-80" />
          </div>
          <span className="h-3 rounded-[4px] bg-well" />
          <span className="h-3 rounded-[4px] bg-active shadow-active" />
          <span className="h-1.5 w-3/4 rounded-full bg-ink-3 opacity-50" />
          <span className="h-1.5 w-2/3 rounded-full bg-ink-3 opacity-50" />
          <span className="mt-auto h-3 rounded-[4px] bg-primary" />
        </div>
        <div className="flex flex-col gap-1.5 rounded-[calc(var(--d-radius-shell)/3)] p-2.5 shadow-shell surface-panel">
          <span className="h-2.5 w-3/5 rounded-full bg-ink" style={{ fontFamily: "var(--d-font-display)" }} />
          <span className="h-1.5 w-11/12 rounded-full bg-ink-3 opacity-60" />
          <span className="h-1.5 w-4/5 rounded-full bg-ink-3 opacity-60" />
          <span className="mt-1 flex items-center gap-1">
            <span className="size-2 rounded-[2px] border border-accent bg-accent" />
            <span className="h-1.5 w-1/2 rounded-full bg-ink-3 opacity-60" />
          </span>
          <span className="mt-auto h-5 rounded-[5px] p-1 surface-raised">
            <span className="block h-full w-1/3 rounded-full bg-accent" />
          </span>
        </div>
      </div>
    </div>
  );
}
