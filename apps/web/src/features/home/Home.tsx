// "All pages", like Craft's All Docs: every page as a little picture of itself, in a masonry of
// cards, a tidy grid or a plain list, sorted and filtered the way you like.

import { useMemo, useState } from "react";
import { displayTitle, favoritePages, livePages, pageText, previewLines, templates, timeAgo, type Page } from "@dovli/core";
import { coverPreset, resolveLook, styleVars } from "@dovli/theme";
import { Button, EmptyState, Icon, MenuContent, MenuItem, MenuLabel, MenuRoot, MenuTrigger, Segmented, cn, toast, type IconName } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { ui } from "@/lib/ui";
import { Crumb, TopBar } from "@/components/TopBar";
import { BoardSketch, PageCard, TemplateCard, cardGrid, sketchOf } from "@/features/home/cards";
import { newPage, useFromTemplate } from "@/features/pages/actions";

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function Section({ title, aside, children, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 id={id} className="m-0 text-md font-bold tracking-tight text-ink">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export const wide = "mx-auto flex max-w-[1180px] flex-col gap-10 px-8 pb-24 pt-10 max-[640px]:gap-8 max-[640px]:px-4 max-[640px]:pb-20 max-[640px]:pt-6";

type View = "cards" | "grid" | "list";
type Sort = "edited" | "created" | "title";
const SORTS: Record<Sort, string> = { edited: "Last edited", created: "Date created", title: "Title (A to Z)" };
const PREFS = "dovli.allPages.v1";

function loadPrefs(): { view: View; sort: Sort } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
    return { view: ["cards", "grid", "list"].includes(p.view) ? p.view : "cards", sort: p.sort in SORTS ? p.sort : "edited" };
  } catch {
    return { view: "cards", sort: "edited" };
  }
}

const open = (id: string) => store.navigate({ name: "page", id });

const editedAt = (p: Page) => Math.max(p.updatedAt, p.lastOpenedAt ?? 0);

/** A page drawn small, as tall as its content, for the masonry of cards. */
function MiniPage({ page }: { page: Page }) {
  const parent = useStore((s) => (page.parentId ? s.pages[page.parentId] : null));
  const style = page.kind === "doc" ? resolveLook(page.style, page.look).style : null;
  const preset = coverPreset(page.cover);
  const lines = page.kind === "doc" ? previewLines(page.blocks ?? [], 12) : [];
  return (
    <button
      type="button"
      onClick={() => open(page.id)}
      className="group mb-6 inline-flex w-full break-inside-avoid flex-col gap-2.5 text-left text-ink focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        style={style ? (styleVars(style) as any) : undefined}
        className={cn(
          "relative block w-full overflow-hidden rounded-lg px-[11%] pt-[11%] transition-shadow duration-200 group-focus-visible:ring-2 group-focus-visible:ring-accent",
          style ? "page-styled [background:var(--s-backdrop)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]" : "bg-well shadow-[inset_0_0_0_1px_var(--d-line)] group-hover:bg-accent-soft",
        )}
      >
        <span className="relative block overflow-hidden rounded-t-[7px] shadow-[0_0_0_1px_rgba(20,20,30,0.05),0_4px_14px_rgba(20,20,30,0.08)] transition-transform duration-300 ease-out [background:var(--d-panel)] group-hover:-translate-y-1">
          {preset && <span className="block h-7" style={{ background: preset.css }} />}
          {page.kind === "board" ? (
            <span className="relative block h-36">
              <BoardSketch sketch={sketchOf(page.board)} />
            </span>
          ) : (
            <span className="flex flex-col gap-[5px] px-3.5 pb-5 pt-3.5">
              <span className="mb-0.5 line-clamp-2 font-[family-name:var(--title-font,var(--d-font-display))] text-[13px] font-bold leading-tight tracking-tight text-ink">
                {displayTitle(page)}
              </span>
              {lines.length === 0 && <span className="text-[8px] text-ink-4">Empty page</span>}
              {lines.map((l, i) =>
                l.kind === "rule" ? (
                  <hr key={i} className="my-0.5 w-full border-0 border-t border-line" />
                ) : l.kind === "table" ? (
                  <span key={i} className="grid grid-cols-[1fr_2fr] overflow-hidden rounded-[3px] border border-line">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <i key={j} className="h-[7px] border-b border-r border-line [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0" />
                    ))}
                  </span>
                ) : (
                  <span
                    key={i}
                    className={cn(
                      "flex items-center gap-1 truncate text-[8px] leading-[1.4] text-ink-2",
                      (l.kind === "h1" || l.kind === "h2") && "mt-1 text-[9.5px] font-semibold text-ink",
                      l.kind === "h3" && "mt-0.5 text-[8.5px] font-semibold text-ink",
                      l.kind === "li" && "before:size-[2.5px] before:flex-none before:rounded-full before:bg-[var(--d-ink-3)] before:content-['']",
                    )}
                  >
                    {l.kind === "todo" && <span className="size-1.5 flex-none rounded-[2px] border border-ink-3" />}
                    {l.text || " "}
                  </span>
                ),
              )}
            </span>
          )}
        </span>
      </span>
      <span className="flex min-w-0 items-start gap-2 px-0.5">
        <span className="w-4 flex-none text-center font-serif text-md leading-snug text-accent">{page.mark}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold leading-snug">{displayTitle(page)}</span>
          <span className="truncate text-xs leading-snug text-ink-3">
            {timeAgo(editedAt(page))}
            {parent ? `, in ${displayTitle(parent)}` : ""}
          </span>
        </span>
      </span>
    </button>
  );
}

function ListRow({ page }: { page: Page }) {
  const parent = useStore((s) => (page.parentId ? s.pages[page.parentId] : null));
  return (
    <li>
      <button
        type="button"
        onClick={() => open(page.id)}
        className="grid min-h-12 w-full grid-cols-[24px_minmax(0,1fr)_minmax(0,180px)_120px] items-center gap-3 rounded-md px-3 text-left text-base text-ink transition-colors hover:bg-hover max-[640px]:grid-cols-[24px_minmax(0,1fr)_auto]"
      >
        <span className="text-center font-serif text-md text-accent">{page.mark}</span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{displayTitle(page)}</span>
          {page.kind === "board" && <span className="flex-none rounded-full bg-well px-2 py-px text-2xs text-ink-3">Whiteboard</span>}
          {page.favorite && <Icon name="starFilled" size={12} className="flex-none text-accent" />}
        </span>
        <span className="truncate text-sm text-ink-3 max-[640px]:hidden">{parent ? displayTitle(parent) : ""}</span>
        <span className="text-right text-sm tabular-nums text-ink-3">{timeAgo(editedAt(page))}</span>
      </button>
    </li>
  );
}

function Pages({ list, view }: { list: Page[]; view: View }) {
  if (view === "list")
    return (
      <ul className="-mx-3 m-0 flex list-none flex-col p-0" aria-label="Pages">
        {list.map((p) => (
          <ListRow key={p.id} page={p} />
        ))}
      </ul>
    );
  if (view === "grid")
    return (
      <div className={cardGrid}>
        {list.map((p) => (
          <PageCard key={p.id} page={p} />
        ))}
      </div>
    );
  return (
    <div className="columns-[200px] gap-x-6 max-[640px]:columns-2 max-[640px]:gap-x-3.5">
      {list.map((p) => (
        <MiniPage key={p.id} page={p} />
      ))}
    </div>
  );
}

function Quick({ icon, children, onClick }: { icon: IconName; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 flex-none items-center gap-2 rounded-full bg-well px-3.5 text-sm font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--d-line)] transition-colors hover:bg-hover hover:text-ink"
    >
      <Icon name={icon} size={15} className="text-accent" />
      {children}
    </button>
  );
}

export function Home() {
  const pages = useStore((s) => s.pages);
  const use = useFromTemplate();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [query, setQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const setPref = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS, JSON.stringify(next));
    } catch {
      /* private window: the choice lasts until the page closes */
    }
  };

  const all = useMemo(() => livePages(pages), [pages]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q ? all.filter((p) => displayTitle(p).toLowerCase().includes(q) || pageText(p).toLowerCase().includes(q)) : all.slice();
    const by: Record<Sort, (a: Page, b: Page) => number> = {
      edited: (a, b) => editedAt(b) - editedAt(a),
      created: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => displayTitle(a).localeCompare(displayTitle(b), undefined, { sensitivity: "base" }),
    };
    return found.sort(by[prefs.sort]);
  }, [all, query, prefs.sort]);
  const starred = query ? [] : favoritePages(pages);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        crumbs={
          <Crumb current>
            <Icon name="home" size={14} className="text-ink-3" />
            All pages
          </Crumb>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className={wide}>
          <header className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="m-0 text-sm font-medium text-ink-3">
                {greeting()} · {date}
              </p>
              <h1 className="display-text m-0 text-[clamp(2rem,3.6vw,2.6rem)]">All pages</h1>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              <Quick icon="page" onClick={() => newPage("doc")}>
                New page
              </Quick>
              <Quick icon="board" onClick={() => newPage("board")}>
                New whiteboard
              </Quick>
              <Quick icon="templates" onClick={() => store.navigate({ name: "templates" })}>
                Use a template
              </Quick>
              <Quick icon="importIcon" onClick={() => ui.set({ settings: "data" })}>
                Import
              </Quick>
            </div>
          </header>

          <div className="-mb-4 flex flex-wrap items-center gap-2 border-b border-line pb-3">
            <span className="mr-auto text-sm tabular-nums text-ink-3">
              {query ? `${list.length} of ${all.length} pages` : `${all.length} pages`}
            </span>
            <label className="flex h-8 w-[220px] items-center gap-2 rounded-md bg-well px-2.5 text-sm text-ink-3 shadow-[inset_0_0_0_1px_var(--d-line)] focus-within:ring-2 focus-within:ring-accent max-[640px]:order-last max-[640px]:w-full">
              <Icon name="search" size={14} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter pages"
                aria-label="Filter pages"
                className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-4"
              />
            </label>
            <MenuRoot modal={false}>
              <MenuTrigger asChild>
                <button type="button" aria-label={`Sort: ${SORTS[prefs.sort]}`} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink-2 hover:bg-hover hover:text-ink">
                  <Icon name="sort" size={14} />
                  <span className="max-[640px]:hidden">{SORTS[prefs.sort]}</span>
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuLabel>Sort by</MenuLabel>
                {(Object.keys(SORTS) as Sort[]).map((s) => (
                  <MenuItem key={s} icon={prefs.sort === s ? "check" : undefined} className={prefs.sort === s ? "" : "pl-[34px]"} onSelect={() => setPref({ sort: s })}>
                    {SORTS[s]}
                  </MenuItem>
                ))}
              </MenuContent>
            </MenuRoot>
            <Segmented<View>
              label="Show pages as"
              value={prefs.view}
              onValueChange={(v) => setPref({ view: v })}
              className="[&>*]:px-2"
              options={[
                { value: "cards", icon: "viewCards", label: <span className="sr-only">Cards</span> },
                { value: "grid", icon: "viewGrid", label: <span className="sr-only">Grid</span> },
                { value: "list", icon: "viewList", label: <span className="sr-only">List</span> },
              ]}
            />
          </div>

          {starred.length > 0 && (
            <Section title="Favourites" id="starred-title">
              <Pages list={starred} view={prefs.view} />
            </Section>
          )}

          <Section title={query ? "Matching pages" : "Everything"} id="all-title">
            {all.length === 0 ? (
              <EmptyState icon="page" title="No pages yet" action={<Button variant="primary" icon="plus" onClick={() => newPage()}>New page</Button>}>
                Create one, or start from a template.
              </EmptyState>
            ) : list.length === 0 ? (
              <EmptyState icon="search" title="No pages match" action={<Button variant="secondary" onClick={() => setQuery("")}>Clear the filter</Button>}>
                Nothing has “{query}” in its title or text.
              </EmptyState>
            ) : (
              <Pages list={list} view={prefs.view} />
            )}
          </Section>

          {!query && (
            <Section
              title="Start from a template"
              id="tpl-title"
              aside={
                <Button variant="link" size="sm" className="ml-auto" onClick={() => store.navigate({ name: "templates" })}>
                  See all
                </Button>
              }
            >
              <div className={cardGrid}>
                {["meeting", "brief", "journal", "userflow"].map((id) => {
                  const t = templates.find((x) => x.id === id);
                  return t ? <TemplateCard key={id} t={t} onUse={use} /> : null;
                })}
              </div>
            </Section>
          )}

          <footer className="border-t border-line pt-4">
            {confirmReset ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1.5 text-sm text-ink-2">Bring back the sample pages? Your own pages move to the trash.</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    store.resetWorkspace();
                    setConfirmReset(false);
                    toast("Sample pages restored. Your pages are in the trash for 30 days.");
                  }}
                >
                  Replace
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="-ml-2.5 text-ink-3" onClick={() => setConfirmReset(true)}>
                Restore sample pages
              </Button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
