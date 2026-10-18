import { useMemo, useState } from "react";
import { childrenOf, displayTitle, favoritePages, tagIndex, type Page } from "@dovli/core";
import { Button, Icon, IconButton, Kbd, SectionLabel, cn, modKey, type IconName } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { ui, useUI } from "@/lib/ui";
import { newPage } from "@/features/pages/actions";
import { PageMenu } from "@/features/page/PageMenu";
import { SyncBadge } from "./SyncBadge";

/** One row in the sidebar. Every theme gets its own height, radius and active look from tokens. */
const rowBase =
  "group/row relative flex h-row w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 text-left text-base text-ink-2 transition-colors hover:bg-hover hover:text-ink";
const rowActive = "bg-active text-active-ink font-semibold shadow-active hover:bg-active hover:text-active-ink";

function NavRow({ icon, label, active, onClick, count }: { icon: IconName; label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button type="button" className={cn(rowBase, active && rowActive)} aria-current={active ? "page" : undefined} onClick={onClick}>
      <Icon name={icon} size={16} className={active ? "" : "text-ink-3"} />
      <span className="flex-1 truncate">{label}</span>
      {!!count && <span className="text-xs tabular-nums text-ink-4">{count}</span>}
    </button>
  );
}

function TreeRow({ page, depth }: { page: Page; depth: number }) {
  const pages = useStore((s) => s.pages);
  const active = useStore((s) => s.route.name === "page" && s.route.id === page.id);
  const kids = childrenOf(pages, page.id);
  const open = !!page.expanded && kids.length > 0;
  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={active} aria-level={depth + 1}>
      <div className={cn(rowBase, "gap-1 pr-1", active && rowActive)} style={{ paddingLeft: 4 + depth * 14 }}>
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Collapse" : "Expand"}
          disabled={!kids.length}
          onClick={() => store.updatePage(page.id, { expanded: !page.expanded }, false)}
          className="grid size-5 flex-none place-items-center rounded-xs text-ink-4 hover:bg-hover hover:text-ink disabled:invisible"
        >
          <Icon name="chevron" size={11} className={cn("transition-transform duration-150", open && "rotate-90")} />
        </button>
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"
          aria-current={active ? "page" : undefined}
          onClick={() => store.navigate({ name: "page", id: page.id })}
        >
          <span className={cn("w-[18px] flex-none text-center font-serif", active ? "text-accent" : "text-ink-3")}>{page.mark}</span>
          <span className="truncate">{displayTitle(page)}</span>
        </button>
        <span className="flex flex-none items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 max-[860px]:opacity-100">
          <PageMenu page={page} trigger={<IconButton icon="more" label="Page actions" size="xs" tooltip={false} />} />
          <IconButton icon="plus" label={`Add a page inside ${displayTitle(page)}`} size="xs" tooltip={false} onClick={() => newPage("doc", page.id)} />
        </span>
      </div>
      {open && (
        <ul role="group" className="m-0 flex list-none flex-col gap-px p-0">
          {kids.map((k) => (
            <TreeRow key={k.id} page={k} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const pages = useStore((s) => s.pages);
  const route = useStore((s) => s.route);
  const open = useUI((s) => s.nav);
  const [showTags, setShowTags] = useState(true);
  const roots = childrenOf(pages, null);
  const favorites = favoritePages(pages);
  const tags = useMemo(() => tagIndex(pages).slice(0, 12), [pages]);
  const trashCount = useMemo(() => Object.values(pages).filter((p) => p.deletedAt).length, [pages]);

  return (
    <aside
      aria-label="Sidebar"
      data-print="hide"
      className={cn(
        "flex min-h-0 flex-col gap-1 overflow-hidden rounded-shell px-2.5 pb-2.5 pt-3 shadow-shell surface-sidebar [border-right:var(--d-divider)]",
        "max-[860px]:fixed max-[860px]:inset-y-0 max-[860px]:left-0 max-[860px]:z-50 max-[860px]:w-[min(304px,86vw)] max-[860px]:rounded-l-none max-[860px]:[background:linear-gradient(var(--d-sidebar),var(--d-sidebar)),var(--d-bg)] max-[860px]:pb-[calc(12px+env(safe-area-inset-bottom))] max-[860px]:pt-[calc(14px+env(safe-area-inset-top))] max-[860px]:shadow-pop max-[860px]:transition-transform max-[860px]:duration-200",
        open ? "max-[860px]:translate-x-0" : "max-[860px]:invisible max-[860px]:-translate-x-[102%]",
      )}
    >
      <div className="flex h-10 items-center gap-2.5 px-1.5">
        <button type="button" onClick={() => store.navigate({ name: "home" })} className="-m-1 flex items-center gap-2.5 rounded-md p-1 hover:bg-hover">
          <span className="grid size-7 place-items-center rounded-sm bg-brand font-display text-md font-bold text-brand-ink" aria-hidden="true">
            D
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">Dovli</span>
          <span className="sr-only">, go to Home</span>
        </button>
        <IconButton icon="close" label="Close sidebar" size="sm" className="ml-auto min-[861px]:hidden" onClick={() => ui.set({ nav: false })} />
      </div>

      <button
        type="button"
        onClick={() => ui.set({ palette: true })}
        className="my-1.5 flex h-9 items-center gap-2 rounded-md bg-well px-3 text-base text-ink-3 shadow-sm transition-colors hover:text-ink-2"
      >
        <Icon name="search" size={15} />
        <span className="flex-1 text-left">Search</span>
        <Kbd className="max-[860px]:hidden">{modKey()}K</Kbd>
      </button>

      <nav aria-label="Main" className="flex flex-col gap-px">
        <NavRow icon="home" label="Home" active={route.name === "home"} onClick={() => store.navigate({ name: "home" })} />
        <NavRow icon="templates" label="Templates" active={route.name === "templates"} onClick={() => store.navigate({ name: "templates" })} />
      </nav>

      <div className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {favorites.length > 0 && (
          <section aria-label="Favourites" className="mt-3">
            <SectionLabel>Favourites</SectionLabel>
            <ul className="m-0 flex list-none flex-col gap-px p-0">
              {favorites.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={cn(rowBase, route.name === "page" && route.id === p.id && rowActive)}
                    onClick={() => store.navigate({ name: "page", id: p.id })}
                  >
                    <span className="w-[18px] flex-none text-center font-serif text-ink-3">{p.mark}</span>
                    <span className="truncate">{displayTitle(p)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Pages" className="mt-3">
          <SectionLabel action={<IconButton icon="plus" label="New page" size="xs" onClick={() => newPage()} />}>Pages</SectionLabel>
          {roots.length ? (
            <ul role="tree" aria-label="Pages" className="m-0 flex list-none flex-col gap-px p-0">
              {roots.map((p) => (
                <TreeRow key={p.id} page={p} depth={0} />
              ))}
            </ul>
          ) : (
            <p className="m-0 px-2.5 py-2 text-sm text-ink-3">No pages yet.</p>
          )}
        </section>

        {tags.length > 0 && (
          <section aria-label="Tags" className="mt-3">
            <SectionLabel
              action={<IconButton icon={showTags ? "chevronDown" : "chevron"} label={showTags ? "Hide tags" : "Show tags"} size="xs" tooltip={false} onClick={() => setShowTags((v) => !v)} />}
            >
              Tags
            </SectionLabel>
            {showTags && (
              <ul className="m-0 flex list-none flex-col gap-px p-0">
                {tags.map((t) => (
                  <li key={t.tag}>
                    <button
                      type="button"
                      className={cn(rowBase, route.name === "tag" && route.tag === t.tag && rowActive)}
                      onClick={() => store.navigate({ name: "tag", tag: t.tag })}
                    >
                      <Icon name="hash" size={14} className="text-ink-3" />
                      <span className="flex-1 truncate">{t.tag}</span>
                      <span className="text-xs tabular-nums text-ink-4">{t.pages.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="mt-3">
          <NavRow icon="trash" label="Trash" count={trashCount} active={route.name === "trash"} onClick={() => store.navigate({ name: "trash" })} />
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button variant="primary" block icon="plus" onClick={() => newPage()}>
          New page
        </Button>
        <div className="flex items-center gap-1">
          <SyncBadge />
          <IconButton icon="settings" label="Settings" shortcut={`${modKey()},`} size="sm" className="ml-auto" onClick={() => ui.set({ settings: "appearance" })} />
        </div>
      </div>
    </aside>
  );
}
