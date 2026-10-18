import { useMemo } from "react";
import { backlinksOf, displayTitle, outgoingLinks, outline, pageTags, timeAgo, wordCount, type Page } from "@dovli/core";
import { IconButton, SectionLabel, cn } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { settings } from "@/lib/settings";

export function scrollToBlock(id: string) {
  const el = document.querySelector(`.bn-block-outer[data-id="${CSS.escape(id)}"]`);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LinkRow({ page }: { page: Page }) {
  return (
    <button
      type="button"
      onClick={() => store.navigate({ name: "page", id: page.id })}
      className="flex h-row w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-sm text-ink-2 hover:bg-hover hover:text-ink"
    >
      <span className="w-4 flex-none text-center font-serif text-ink-3">{page.mark}</span>
      <span className="truncate">{displayTitle(page)}</span>
    </button>
  );
}

/** "Linked from": every page that links here, shown under the page (and in the side panel). */
export function Backlinks({ page }: { page: Page }) {
  const pages = useStore((s) => s.pages);
  const list = useMemo(() => backlinksOf(pages, page.id), [pages, page.id]);
  if (!list.length) return null;
  return (
    <section aria-label="Linked from" className="mt-12 border-t border-line px-[54px] pt-5 max-[640px]:px-0" data-print="hide">
      <h2 className="label-text m-0 mb-2">Linked from {list.length} page{list.length > 1 ? "s" : ""}</h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-1 p-0 max-[640px]:grid-cols-1">
        {list.map((p) => (
          <li key={p.id}>
            <LinkRow page={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The side panel on wide screens: outline, links in and out, tags and details. */
export function PageInfoRail({ page }: { page: Page }) {
  const pages = useStore((s) => s.pages);
  const heads = useMemo(() => outline(page), [page]);
  const back = useMemo(() => backlinksOf(pages, page.id), [pages, page.id]);
  const out = useMemo(() => outgoingLinks(page).map((id) => pages[id]).filter((p) => p && !p.deletedAt), [page, pages]);
  const tags = useMemo(() => pageTags(page), [page]);
  const words = wordCount(page);

  return (
    <aside aria-label="Page info" data-print="hide" className="flex w-[240px] flex-none flex-col gap-6 overflow-y-auto px-4 pb-10 pt-6 [border-left:var(--d-divider)] max-[1199px]:hidden">
      <div className="-mb-3 -mt-2 flex justify-end">
        <IconButton icon="panelRight" label="Hide page info" shortcut="⌘\" size="sm" onClick={() => settings.set({ showPageInfo: false })} />
      </div>
      <section>
        <SectionLabel className="px-2">On this page</SectionLabel>
        {heads.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {heads.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => scrollToBlock(h.id)}
                  className={cn("w-full truncate rounded-sm py-1 pr-2 text-left text-sm text-ink-2 hover:bg-hover hover:text-ink", h.level === 1 ? "pl-2" : h.level === 2 ? "pl-4" : "pl-6")}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 px-2 text-sm text-ink-4">Headings you add show up here.</p>
        )}
      </section>

      {back.length > 0 && (
        <section>
          <SectionLabel className="px-2">Linked from</SectionLabel>
          {back.map((p) => (
            <LinkRow key={p.id} page={p} />
          ))}
        </section>
      )}

      {out.length > 0 && (
        <section>
          <SectionLabel className="px-2">Links to</SectionLabel>
          {out.map((p) => (
            <LinkRow key={p.id} page={p} />
          ))}
        </section>
      )}

      {tags.length > 0 && (
        <section>
          <SectionLabel className="px-2">Tags</SectionLabel>
          <div className="flex flex-wrap gap-1.5 px-2">
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => store.navigate({ name: "tag", tag: t })} className="h-6 rounded-full bg-accent-soft px-2.5 text-xs font-medium text-accent hover:brightness-95">
                #{t}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel className="px-2">Details</SectionLabel>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2 text-sm">
          <dt className="text-ink-3">Words</dt>
          <dd className="m-0 text-right tabular-nums text-ink-2">{words}</dd>
          <dt className="text-ink-3">Reading</dt>
          <dd className="m-0 text-right tabular-nums text-ink-2">{Math.max(1, Math.round(words / 220))} min</dd>
          <dt className="text-ink-3">Edited</dt>
          <dd className="m-0 text-right text-ink-2">{timeAgo(page.updatedAt)}</dd>
          <dt className="text-ink-3">Created</dt>
          <dd className="m-0 text-right text-ink-2">{new Date(page.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</dd>
        </dl>
      </section>
    </aside>
  );
}
