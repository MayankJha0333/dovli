// The page side of the sidebar, like Craft's: the open page at the top, then four tabs:
// Contents (its headings, with the one you're reading marked), To-dos, Attachments and Links.

import { useEffect, useMemo, useState } from "react";
import { attachments, backlinksOf, childrenOf, displayTitle, outgoingLinks, outline, timeAgo, todoItems, webLinks, type AttachmentKind, type Page } from "@dovli/core";
import { resolveLook, styleVars } from "@dovli/theme";
import { Icon, cn, type IconName } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { getActiveEditor } from "@/lib/ui";
import { BoardSketch, DocPreview, sketchOf } from "@/features/home/cards";
import { scrollToBlock } from "@/features/page/PageInfo";
import { tabs, wantsNewTab } from "@/lib/tabs";

type Tab = "contents" | "todos" | "files" | "links";
const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: "contents", icon: "outline", label: "Contents" },
  { id: "todos", icon: "checkbox", label: "To-dos" },
  { id: "files", icon: "paperclip", label: "Attachments" },
  { id: "links", icon: "link", label: "Links" },
];

/** Scroll to a block and flash it briefly so the eye can find it. */
function goTo(id: string) {
  scrollToBlock(id);
  const el = document.querySelector<HTMLElement>(`.bn-block-outer[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  el.classList.remove("dovli-flash");
  void el.offsetWidth;
  el.classList.add("dovli-flash");
}

/** The heading you're reading: the last one that has scrolled past the top of the page area. */
function useReadingHeading(ids: string[]): string | null {
  const [current, setCurrent] = useState<string | null>(ids[0] ?? null);
  const key = ids.join(",");
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = (document.getElementById("main")?.getBoundingClientRect().top ?? 0) + 110;
      let found: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.querySelector(`.bn-block-outer[data-id="${CSS.escape(id)}"]`);
        if (el && el.getBoundingClientRect().top <= top) found = id;
      }
      setCurrent(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return current;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 px-2.5 py-3 text-sm leading-relaxed text-ink-3">{children}</p>;
}

const itemRow = "flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-1 text-left text-sm text-ink-2 transition-colors hover:bg-hover hover:text-ink";

function Contents({ page }: { page: Page }) {
  const heads = useMemo(() => outline(page), [page]);
  const reading = useReadingHeading(heads.map((h) => h.id));
  if (page.kind !== "doc") return <Empty>Whiteboards have no headings.</Empty>;
  if (!heads.length) return <Empty>Add a heading and it shows up here, so you can jump to it.</Empty>;
  const min = Math.min(...heads.map((h) => h.level));
  return (
    <ul className="m-0 flex list-none flex-col gap-px p-0" aria-label="Headings">
      {heads.map((h) => {
        const on = h.id === reading;
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => goTo(h.id)}
              aria-current={on ? "location" : undefined}
              className={cn(itemRow, on && "bg-active font-semibold text-active-ink shadow-active hover:bg-active hover:text-active-ink", h.level === min && !on && "text-ink")}
              style={{ paddingLeft: 10 + (h.level - min) * 14 }}
            >
              <span className="line-clamp-2">{h.text}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Todos({ page }: { page: Page }) {
  const items = useMemo(() => todoItems(page), [page]);
  if (!items.length) return <Empty>No to-dos on this page. Type [] at the start of a line to add one.</Empty>;
  const done = items.filter((t) => t.checked).length;
  const toggle = (id: string, checked: boolean) => {
    const editor = getActiveEditor();
    try {
      editor?.updateBlock(id, { props: { checked: !checked } });
    } catch {
      /* the block moved; the next change re-reads the page */
    }
  };
  return (
    <div>
      <div className="mx-2.5 mb-2 mt-1 flex items-center gap-2 text-xs text-ink-3">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-well">
          <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${(done / items.length) * 100}%` }} />
        </span>
        <span className="tabular-nums">
          {done} of {items.length} done
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {items.map((t) => (
          <li key={t.id} className="group/todo flex items-start gap-1 rounded-md hover:bg-hover">
            <button
              type="button"
              role="checkbox"
              aria-checked={t.checked}
              aria-label={t.text || "To-do"}
              onClick={() => toggle(t.id, t.checked)}
              className={cn(
                "ml-2 mt-[7px] grid size-4 flex-none place-items-center rounded-[5px] border-[1.5px] transition-colors",
                t.checked ? "border-accent bg-accent text-accent-ink" : "border-ink-4 hover:border-ink-2",
              )}
            >
              {t.checked && <Icon name="check" size={11} />}
            </button>
            <button type="button" onClick={() => goTo(t.id)} className={cn(itemRow, "px-1.5 hover:bg-transparent", t.checked && "text-ink-3 line-through")}>
              <span className="line-clamp-2">{t.text || "Empty to-do"}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const KIND_ICON: Record<AttachmentKind, IconName> = { image: "image", video: "play", audio: "play", file: "file", pdf: "pdf", embed: "link" };

function Files({ page }: { page: Page }) {
  const items = useMemo(() => attachments(page), [page]);
  if (!items.length) return <Empty>Pictures, videos, PDFs and files you add to this page are listed here.</Empty>;
  return (
    <ul className="m-0 flex list-none flex-col gap-px p-0">
      {items.map((a) => (
        <li key={a.id}>
          <button type="button" onClick={() => goTo(a.id)} className={itemRow}>
            {a.kind === "image" && a.url && !a.url.startsWith("dovli-file:") ? (
              <img src={a.url} alt="" className="size-7 flex-none rounded-sm object-cover shadow-[inset_0_0_0_1px_var(--d-line)]" />
            ) : (
              <span className="grid size-7 flex-none place-items-center rounded-sm bg-well text-ink-3">
                <Icon name={KIND_ICON[a.kind]} size={14} />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PageLinkRow({ page }: { page: Page }) {
  return (
    <button
      type="button"
      onClick={(e) => (wantsNewTab(e) ? tabs.openInNewTab({ name: "page", id: page.id }) : store.navigate({ name: "page", id: page.id }))}
      className={itemRow}
    >
      <span className="w-4 flex-none text-center font-serif text-ink-3">{page.mark}</span>
      <span className="truncate">{displayTitle(page)}</span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="label-text m-0 mb-1 px-2.5">{title}</h3>
      {children}
    </section>
  );
}

function Links({ page }: { page: Page }) {
  const pages = useStore((s) => s.pages);
  const from = useMemo(() => backlinksOf(pages, page.id), [pages, page.id]);
  const to = useMemo(() => outgoingLinks(page).map((id) => pages[id]).filter((p) => p && !p.deletedAt), [page, pages]);
  const inside = childrenOf(pages, page.id);
  const web = useMemo(() => webLinks(page), [page]);
  if (!from.length && !to.length && !inside.length && !web.length)
    return <Empty>Nothing links here yet. Type [[ in any page to link to another one.</Empty>;
  return (
    <div>
      {from.length > 0 && (
        <Group title={`Linked from ${from.length}`}>
          {from.map((p) => (
            <PageLinkRow key={p.id} page={p} />
          ))}
        </Group>
      )}
      {to.length > 0 && (
        <Group title="Links to">
          {to.map((p) => (
            <PageLinkRow key={p.id} page={p} />
          ))}
        </Group>
      )}
      {inside.length > 0 && (
        <Group title="Pages inside">
          {inside.map((p) => (
            <PageLinkRow key={p.id} page={p} />
          ))}
        </Group>
      )}
      {web.length > 0 && (
        <Group title="On the web">
          {web.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className={itemRow}>
              <Icon name="link" size={13} className="flex-none text-ink-3" />
              <span className="truncate">{l.text}</span>
            </a>
          ))}
        </Group>
      )}
    </div>
  );
}

/** A small picture of the page, styled like the page itself. */
function Thumb({ page }: { page: Page }) {
  const style = page.kind === "doc" ? resolveLook(page.style, page.look).style : null;
  return (
    <span
      aria-hidden="true"
      style={style ? (styleVars(style) as any) : undefined}
      className={cn(
        "relative block h-[74px] w-[58px] flex-none overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--d-line)]",
        style ? "page-styled [background:var(--s-backdrop)]" : "bg-well",
      )}
    >
      <span className="absolute inset-x-[7px] -bottom-1 top-[7px] overflow-hidden rounded-t-[4px] shadow-[0_0_0_1px_rgba(20,20,30,0.05),0_2px_6px_rgba(20,20,30,0.08)] [background:var(--d-panel)]">
        <span className="block w-[200%] origin-top-left scale-50">
          {page.kind === "board" ? (
            <span className="relative block h-[120px]">
              <BoardSketch sketch={sketchOf(page.board)} />
            </span>
          ) : (
            <DocPreview title={displayTitle(page)} blocks={page.blocks ?? []} />
          )}
        </span>
      </span>
    </span>
  );
}

export function PageSide({ page }: { page: Page }) {
  const [tab, setTab] = useState<Tab>("contents");
  const counts: Partial<Record<Tab, number>> = {
    todos: todoItems(page).filter((t) => !t.checked).length,
    files: attachments(page).length,
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-1.5 pb-3 pt-1">
        <Thumb page={page} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 font-display text-md font-bold leading-tight tracking-tight text-ink">{displayTitle(page)}</span>
          <span className="text-xs text-ink-3">Edited {timeAgo(page.updatedAt)}</span>
        </div>
      </div>
      <div role="tablist" aria-label="About this page" className="mx-0.5 mb-2 grid grid-cols-4 gap-0.5 rounded-md bg-well p-0.5">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`side-tab-${t.id}`}
              aria-selected={on}
              aria-controls="side-tab-panel"
              aria-label={t.label}
              title={t.label}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative grid h-8 place-items-center rounded-[calc(var(--radius-md)-2px)] text-ink-3 transition-colors hover:text-ink",
                on && "bg-panel text-ink shadow-sm",
              )}
            >
              <Icon name={t.icon} size={15} />
              {!!counts[t.id] && (
                <span className="absolute right-1 top-0.5 min-w-3.5 rounded-full bg-accent px-1 text-[9px] font-bold leading-[14px] text-accent-ink">{counts[t.id]}</span>
              )}
            </button>
          );
        })}
      </div>
      <div id="side-tab-panel" role="tabpanel" aria-labelledby={`side-tab-${tab}`} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        <h2 className="label-text m-0 mb-1.5 px-2.5 pt-1">{TABS.find((t) => t.id === tab)!.label}</h2>
        {tab === "contents" && <Contents page={page} />}
        {tab === "todos" && <Todos page={page} />}
        {tab === "files" && <Files page={page} />}
        {tab === "links" && <Links page={page} />}
      </div>
    </div>
  );
}
