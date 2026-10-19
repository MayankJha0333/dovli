// The sidebar, like Craft's: a floating card with two sides. The workspace side has new page,
// all pages, starred, the page tree and tags; the page side shows the open page's contents,
// to-dos, attachments and links. The dots at the bottom switch sides.

import { useEffect, useMemo, useState } from "react";
import { childrenOf, displayTitle, favoritePages, tagIndex, type Page } from "@dovli/core";
import { Icon, IconButton, Kbd, SectionLabel, cn, modKey, type IconName, DovliMark } from "@dovli/ui";
import { settings } from "@/lib/settings";
import { store, useStore } from "@/lib/store";
import { keepSpaceSidebar, ui, useUI } from "@/lib/ui";
import { newPage } from "@/features/pages/actions";
import { PageMenu } from "@/features/page/PageMenu";
import { PageSide } from "./PageSide";
import { SyncNotice } from "./SyncNotice";
import { useAuth } from "@/lib/auth";
import { refreshShared, useSharedWithMe } from "@/lib/share";

/** One row in the sidebar. Every theme gets its own height, radius and active look from tokens. */
const rowBase =
  "group/row relative flex h-row w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 text-left text-base text-ink-2 transition-colors hover:bg-hover hover:text-ink";
const rowActive = "bg-active text-active-ink font-semibold shadow-active hover:bg-active hover:text-active-ink";

/** Open a page from the sidebar's own list: the list stays in view. */
function openFromList(id: string) {
  keepSpaceSidebar();
  store.navigate({ name: "page", id });
}

function NavRow({ icon, label, active, onClick, count, shortcut }: { icon: IconName; label: string; active?: boolean; onClick: () => void; count?: number; shortcut?: string }) {
  return (
    <button type="button" className={cn(rowBase, active && rowActive)} aria-current={active ? "page" : undefined} onClick={onClick}>
      <Icon name={icon} size={16} className={active ? "" : "text-ink-3"} />
      <span className="flex-1 truncate">{label}</span>
      {!!count && <span className="text-xs tabular-nums text-ink-4">{count}</span>}
      {shortcut && <Kbd className="opacity-0 transition-opacity group-hover/row:opacity-100 max-[860px]:hidden">{shortcut}</Kbd>}
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
          onClick={() => openFromList(page.id)}
        >
          <span className={cn("w-[18px] flex-none text-center font-serif", active ? "text-accent" : "text-ink-3")}>{page.mark}</span>
          <span className="truncate">{displayTitle(page)}</span>
        </button>
        <span className="flex flex-none items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 max-[860px]:opacity-100">
          <PageMenu page={page} trigger={<IconButton icon="more" label="Page actions" size="xs" tooltip={false} />} />
          <IconButton
            icon="plus"
            label={`Add a page inside ${displayTitle(page)}`}
            size="xs"
            tooltip={false}
            onClick={() => {
              keepSpaceSidebar();
              newPage("doc", page.id);
            }}
          />
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

/** A section title that can fold its list away. Folded, it shows how many items it holds. */
function Fold({ title, open, onToggle, action, count }: { title: string; open: boolean; onToggle: () => void; action?: React.ReactNode; count?: number }) {
  return (
    <SectionLabel action={action}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="-mx-1 flex items-center gap-1 rounded-xs px-1 hover:text-ink">
        {title}
        <Icon name={open ? "chevronDown" : "chevron"} size={10} className="opacity-60" />
        {!open && !!count && <span className="ml-0.5 tabular-nums font-normal normal-case tracking-normal text-ink-4">{count}</span>}
      </button>
    </SectionLabel>
  );
}

// Which sections are open, remembered in this browser. Favourites and Tags start folded so the
// page tree has the room; Pages starts open.
type Folds = { starred: boolean; shared: boolean; pages: boolean; tags: boolean };
const FOLDS_KEY = "dovli.sidebarFolds.v1";
const DEFAULT_FOLDS: Folds = { starred: false, shared: true, pages: true, tags: false };
/** How many favourites the workspace side last showed (null until it first shows). */
let seenFavourites: number | null = null;
function loadFolds(): Folds {
  try {
    return { ...DEFAULT_FOLDS, ...JSON.parse(localStorage.getItem(FOLDS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_FOLDS;
  }
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="m-0 px-2.5 pb-1 pt-0.5 text-sm leading-snug text-ink-3">{children}</p>;
}

function SpaceSide() {
  const pages = useStore((s) => s.pages);
  const route = useStore((s) => s.route);
  const [open, setOpen] = useState<Folds>(loadFolds);
  const save = (next: Folds) => {
    setOpen(next);
    try {
      localStorage.setItem(FOLDS_KEY, JSON.stringify(next));
    } catch {
      /* private window: the choice lasts until the page closes */
    }
  };
  const toggle = (k: keyof Folds) => save({ ...open, [k]: !open[k] });
  const roots = childrenOf(pages, null);
  const favorites = favoritePages(pages);
  // Adding a favourite opens the section, so you see where the page went. The count is kept
  // outside this component, so a favourite added while the page side was showing counts too.
  useEffect(() => {
    if (seenFavourites !== null && favorites.length > seenFavourites && !open.starred) save({ ...open, starred: true });
    seenFavourites = favorites.length;
  }, [favorites.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const tags = useMemo(() => tagIndex(pages).slice(0, 12), [pages]);
  const shared = useSharedWithMe();
  const signedIn = useAuth((a) => a.status === "signed-in");
  // Pages others shared with you: fetched when signed in, and again when Dovli comes back into view.
  useEffect(() => {
    if (!signedIn) return;
    void refreshShared();
    const onShow = () => document.visibilityState === "visible" && void refreshShared();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [signedIn]);
  const trashCount = useMemo(() => Object.values(pages).filter((p) => p.deletedAt).length, [pages]);

  return (
    <>
      <nav aria-label="Main" className="flex flex-col gap-px">
        <NavRow
          icon="pagePlus"
          label="New page"
          shortcut={`${modKey()}⌥N`}
          onClick={() => {
            keepSpaceSidebar();
            newPage();
          }}
        />
        <button type="button" onClick={() => ui.set({ palette: true })} className={rowBase}>
          <Icon name="search" size={16} className="text-ink-3" />
          <span className="flex-1 text-left">Search</span>
          <Kbd className="max-[860px]:hidden">{modKey()}K</Kbd>
        </button>
        <NavRow icon="home" label="All pages" active={route.name === "home"} onClick={() => store.navigate({ name: "home" })} />
        <NavRow icon="templates" label="Templates" active={route.name === "templates"} onClick={() => store.navigate({ name: "templates" })} />
      </nav>

      <div className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        <section aria-label="Favourites" className="mt-4">
          <Fold title="Favourites" open={open.starred} count={favorites.length} onToggle={() => toggle("starred")} />
          {open.starred &&
            (favorites.length ? (
              <ul className="m-0 flex list-none flex-col gap-px p-0">
                {favorites.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={cn(rowBase, route.name === "page" && route.id === p.id && rowActive)}
                      onClick={() => openFromList(p.id)}
                    >
                      <span className="w-[18px] flex-none text-center font-serif text-ink-3">{p.mark}</span>
                      <span className="truncate">{displayTitle(p)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Hint>Add pages to favourites to keep them close.</Hint>
            ))}
        </section>

        {shared.length > 0 && (
          <section aria-label="Shared with me" className="mt-4">
            <Fold title="Shared with me" open={open.shared} count={shared.length} onToggle={() => toggle("shared")} />
            {open.shared && (
              <ul className="m-0 flex list-none flex-col gap-px p-0">
                {shared.map((x) => (
                  <li key={`${x.workspaceId}/${x.pageId}`}>
                    <a href={`/p/${encodeURIComponent(x.workspaceId)}/${encodeURIComponent(x.pageId)}`} className={cn(rowBase, "no-underline")} title={`Shared by ${x.sharedByName} · ${x.role === "editor" ? "you can edit" : "view only"}`}>
                      <span className="w-[18px] flex-none text-center font-serif text-ink-3">{x.mark || "¶"}</span>
                      <span className="flex-1 truncate">{x.title}</span>
                      {x.role === "viewer" && <Icon name="eye" size={13} className="flex-none text-ink-4" aria-label="View only" />}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-label="Pages" className="mt-4">
          <Fold
            title="Pages"
            open={open.pages}
            onToggle={() => toggle("pages")}
            action={
              <IconButton
                icon="plus"
                label="New page"
                size="xs"
                onClick={() => {
                  keepSpaceSidebar();
                  newPage();
                }}
              />
            }
          />
          {open.pages &&
            (roots.length ? (
              <ul role="tree" aria-label="Pages" className="m-0 flex list-none flex-col gap-px p-0">
                {roots.map((p) => (
                  <TreeRow key={p.id} page={p} depth={0} />
                ))}
              </ul>
            ) : (
              <Hint>No pages yet.</Hint>
            ))}
        </section>

        <section aria-label="Tags" className="mt-4">
          <Fold title="Tags" open={open.tags} count={tags.length} onToggle={() => toggle("tags")} />
          {open.tags &&
            (tags.length ? (
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
            ) : (
              <Hint>Type # and a word in any page to tag it.</Hint>
            ))}
        </section>

        <div className="mt-4">
          <NavRow icon="trash" label="Trash" count={trashCount} active={route.name === "trash"} onClick={() => store.navigate({ name: "trash" })} />
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const open = useUI((s) => s.nav);
  const mode = useUI((s) => s.sidebarMode);
  const page = useStore((s) => (s.route.name === "page" ? s.pages[s.route.id] : undefined));
  const showPage = mode === "page" && !!page && !page.deletedAt;

  return (
    <aside
      aria-label="Sidebar"
      data-print="hide"
      className={cn(
        "flex min-h-0 flex-col gap-1 overflow-hidden rounded-shell px-2.5 pb-2 pt-3 shadow-shell surface-sidebar [border-right:var(--d-divider)]",
        "max-[860px]:fixed max-[860px]:inset-y-0 max-[860px]:left-0 max-[860px]:z-50 max-[860px]:w-[min(304px,86vw)] max-[860px]:rounded-l-none max-[860px]:[background:linear-gradient(var(--d-sidebar),var(--d-sidebar)),var(--d-bg)] max-[860px]:pb-[calc(10px+env(safe-area-inset-bottom))] max-[860px]:pt-[calc(14px+env(safe-area-inset-top))] max-[860px]:shadow-pop max-[860px]:transition-transform max-[860px]:duration-200",
        open ? "max-[860px]:translate-x-0" : "max-[860px]:invisible max-[860px]:-translate-x-[102%]",
      )}
    >
      <div className="mb-1 flex h-10 items-center gap-2 px-1.5">
        <button
          type="button"
          onClick={() => (showPage ? ui.set({ sidebarMode: "space" }) : store.navigate({ name: "home" }))}
          className="-m-1 flex min-w-0 items-center gap-2.5 rounded-md p-1 hover:bg-hover"
        >
          <DovliMark size={26} />
          <span className="truncate font-display text-lg font-bold tracking-[-0.025em] text-ink">Dovli</span>
          <span className="sr-only">{showPage ? ", show all pages in the sidebar" : ", go to all pages"}</span>
        </button>
        <IconButton
          icon="panelLeft"
          label="Hide sidebar"
          shortcut={`${modKey()}\\`}
          size="sm"
          className="ml-auto max-[860px]:hidden"
          onClick={() => settings.set({ sidebarHidden: true })}
        />
        <IconButton icon="close" label="Close sidebar" size="sm" className="ml-auto min-[861px]:hidden" onClick={() => ui.set({ nav: false })} />
      </div>

      {showPage ? <PageSide page={page} /> : <SpaceSide />}

      {/* Only shown when something needs you: saving failed, sync stopped, or offline with changes waiting. */}
      <SyncNotice />
      {/* One quiet row: the two sides of the sidebar in the middle, Settings on the right. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center pt-1">
        <span aria-hidden="true" />
        <div role="tablist" aria-label="Sidebar view" className="flex items-center justify-center gap-1">
          {(
            [
              ["space", "Show all pages"],
              ["page", page ? `Show the contents of ${displayTitle(page)}` : "Open a page to see its contents"],
            ] as const
          ).map(([m, label]) => {
            const on = m === "page" ? showPage : !showPage;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={label}
                title={label}
                disabled={m === "page" && !page}
                onClick={() => ui.set({ sidebarMode: m })}
                className="group/dot grid h-5 w-6 place-items-center rounded-full disabled:opacity-40"
              >
                <span className={cn("block h-[7px] rounded-full transition-all duration-200", on ? "w-4 bg-ink-2" : "w-[7px] bg-ink-4 group-hover/dot:bg-ink-3")} />
              </button>
            );
          })}
        </div>
        <IconButton icon="settings" label="Settings" shortcut={`${modKey()},`} size="sm" className="justify-self-end" onClick={() => ui.set({ settings: "appearance" })} />
      </div>
    </aside>
  );
}
