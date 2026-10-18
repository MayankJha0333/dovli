// The "/" and "[[" menus, drawn with Dovli's own design tokens instead of BlockNote's Mantine
// look. BlockNote still opens, places, filters and drives the menu with the keyboard; this
// component only draws the list it hands over (and keeps the ids its keyboard handling expects).

import { useEffect, useMemo, useRef } from "react";
import type { DefaultReactSuggestionItem, SuggestionMenuProps } from "@blocknote/react";

/** "Ctrl-Alt-1" → "Ctrl Alt 1"; Mac shortcuts ("⌘⌥1") are already short. */
function prettyKeys(badge: string): string[] {
  if (!badge.includes("-") && !badge.includes("+")) return [...badge];
  return badge.split(/[-+]/).filter(Boolean).map((k) => (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1).toLowerCase()));
}

export function SlashMenu({ items, loadingState, selectedIndex, onItemClick }: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const list = useRef<HTMLDivElement>(null);

  // Keep the chosen row in view as the arrow keys move through a long list.
  useEffect(() => {
    if (selectedIndex === undefined) return;
    list.current?.querySelector(`#bn-suggestion-menu-item-${selectedIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const rows = useMemo(() => {
    const out: { group?: string; item: DefaultReactSuggestionItem; index: number }[] = [];
    items.forEach((item, index) => out.push({ group: index === 0 || items[index - 1].group !== item.group ? item.group : undefined, item, index }));
    return out;
  }, [items]);

  const loading = loadingState !== "loaded";

  return (
    <div
      ref={list}
      id="bn-suggestion-menu"
      // A list of choices while there are some; otherwise a status line saying nothing matched.
      role={rows.length ? "listbox" : "status"}
      aria-label="Insert"
      // Focus stays in the page (arrow keys move the choice), but the list can still be scrolled.
      tabIndex={-1}
      className="bn-suggestion-menu dovli-menu flex max-h-[inherit] w-[min(320px,calc(100vw-24px))] flex-col overflow-y-auto overscroll-contain rounded-lg p-1.5 font-sans text-ink surface-raised animate-pop-in [scrollbar-width:thin]"
    >
      {rows.map(({ group, item, index }) => {
        const selected = index === selectedIndex;
        const small = item.size === "small";
        return (
          <div key={`${item.group}-${item.title}`} className="contents">
            {group && (
              <div role="presentation" className="bn-suggestion-menu-label label-text px-2 pb-1 pt-2.5 first:pt-1.5">
                {group}
              </div>
            )}
            <div
              id={`bn-suggestion-menu-item-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={selected || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onItemClick?.(item)}
              className={
                "bn-suggestion-menu-item group/item flex flex-none cursor-pointer select-none items-center gap-3 rounded-md px-2 text-left transition-colors duration-100 hover:bg-hover " +
                (small ? "min-h-8 py-1" : "min-h-11 py-1.5") +
                (selected ? " bg-hover" : "")
              }
            >
              {item.icon && (
                <span
                  aria-hidden="true"
                  className={
                    "grid flex-none place-items-center rounded-sm transition-colors [&_svg]:size-[17px] " +
                    (small ? "size-6 text-ink-3" : "size-8 shadow-[inset_0_0_0_1px_var(--d-line)] ") +
                    (small ? "" : selected ? "bg-accent-soft text-accent" : "bg-well text-ink-2")
                  }
                >
                  {item.icon}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={"bn-mt-suggestion-menu-item-title truncate font-medium text-ink " + (small ? "text-sm" : "text-base leading-5")}>{item.title}</span>
                {item.subtext && !small && <span className="truncate text-xs text-ink-3">{item.subtext}</span>}
              </span>
              {item.badge && (
                <span className="flex flex-none items-center gap-0.5 max-[640px]:hidden [@media(pointer:coarse)]:hidden" aria-label={`Shortcut ${item.badge}`}>
                  {prettyKeys(item.badge).map((k, i) => (
                    <kbd
                      key={i}
                      className="grid h-5 min-w-5 place-items-center rounded-xs bg-well px-1 font-sans text-2xs font-medium text-ink-3 shadow-[inset_0_0_0_1px_var(--d-line)]"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {!rows.length && !loading && (
        <div className="bn-suggestion-menu-item flex min-h-11 items-center px-3 text-sm text-ink-3">Nothing matches. Keep typing, or press Esc.</div>
      )}
      {loading && !rows.length && (
        <div className="flex flex-col gap-1.5 p-1.5" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-9 rounded-md bg-[linear-gradient(90deg,var(--d-well),var(--d-hover),var(--d-well))] bg-[length:200%_100%] animate-shimmer" />
          ))}
        </div>
      )}
    </div>
  );
}
