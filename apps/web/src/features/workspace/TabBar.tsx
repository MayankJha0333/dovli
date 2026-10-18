// The row of tabs above the page, like Craft: Home, one tab per open view, and + for a new page.

import type { Route } from "@dovli/core";
import { displayTitle } from "@dovli/core";
import { Icon, Tooltip, cn, modKey } from "@dovli/ui";
import { settings, useSettings } from "@/lib/settings";
import { store, useStore } from "@/lib/store";
import { tabs, useTabs } from "@/lib/tabs";
import { newPage } from "@/features/pages/actions";

/** The tab's mark and title. Returned as one string so the store hook sees a stable value. */
function useTabLabel(r: Route): { mark: string; title: string } {
  const label = useStore((s) => {
    if (r.name === "page") {
      const p = s.pages[r.id];
      return `${p?.mark ?? "¶"}\n${p ? displayTitle(p) : "Page"}`;
    }
    if (r.name === "templates") return "▦\nTemplates";
    if (r.name === "trash") return "🗑\nTrash";
    if (r.name === "tag") return `#\n${r.tag}`;
    return "⌂\nAll pages";
  });
  const [mark, ...rest] = label.split("\n");
  return { mark, title: rest.join("\n") };
}

function Tab({ route, index, active }: { route: Route; index: number; active: boolean }) {
  const { mark, title } = useTabLabel(route);
  return (
    <li
      data-active={active || undefined}
      className={cn(
        "group/tab relative flex h-9 min-w-[110px] flex-[0_1_220px] items-center rounded-full pl-1 pr-1.5 text-sm transition-colors",
        active ? "font-semibold text-ink surface-chip" : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
      onAuxClick={(e) => e.button === 1 && tabs.close(index)}
    >
      <button
        type="button"
        aria-label={`Close ${title}`}
        title="Close tab"
        onClick={() => tabs.close(index)}
        className={cn(
          "grid size-6 flex-none place-items-center rounded-full text-ink-3 hover:bg-hover hover:text-ink",
          active ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Icon name="close" size={11} />
      </button>
      <button type="button" aria-current={active ? "page" : undefined} onClick={() => tabs.activate(index)} className="flex h-full min-w-0 flex-1 items-center gap-1.5 pr-1.5 text-left">
        <span aria-hidden="true" className={cn("flex-none font-serif", active ? "text-accent" : "text-ink-4")}>
          {mark}
        </span>
        <span className="truncate">{title}</span>
      </button>
    </li>
  );
}

export function TabBar() {
  const list = useTabs((s) => s.tabs);
  const active = useTabs((s) => s.active);
  const onHome = useStore((s) => s.route.name === "home");
  const hidden = useSettings((s) => s.sidebarHidden);

  return (
    <div data-print="hide" className="flex h-11 flex-none items-center gap-1.5 px-1 max-[860px]:hidden">
      {hidden && (
        <Tooltip label="Show sidebar" shortcut={`${modKey()}\\`}>
          <button
            type="button"
            aria-label="Show sidebar"
            onClick={() => settings.set({ sidebarHidden: false })}
            className="grid size-9 flex-none place-items-center rounded-full text-ink-2 surface-chip hover:text-ink"
          >
            <Icon name="panelLeft" size={16} />
          </button>
        </Tooltip>
      )}
      <Tooltip label="All pages">
        <button
          type="button"
          aria-label="All pages"
          aria-current={onHome ? "page" : undefined}
          onClick={() => store.navigate({ name: "home" })}
          className={cn("grid size-9 flex-none place-items-center rounded-full transition-colors", onHome ? "text-ink surface-chip" : "text-ink-3 hover:bg-hover hover:text-ink")}
        >
          <Icon name="home" size={16} />
        </button>
      </Tooltip>
      <nav aria-label="Open pages" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        <ul className="m-0 flex min-w-0 list-none items-center gap-1 p-0">
          {list.map((r, i) => (
            <Tab key={`${i}-${JSON.stringify(r)}`} route={r} index={i} active={i === active} />
          ))}
        </ul>
        <Tooltip label="New page in a new tab">
          <button
            type="button"
            aria-label="New tab"
            onClick={() => {
              tabs.nextInNewTab();
              newPage("doc");
            }}
            className="grid size-8 flex-none place-items-center rounded-full text-ink-3 hover:bg-hover hover:text-ink"
          >
            <Icon name="plus" size={15} />
          </button>
        </Tooltip>
      </nav>
    </div>
  );
}
