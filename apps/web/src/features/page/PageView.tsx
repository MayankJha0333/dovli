import type { DovliEditor } from "@dovli/editor";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ancestors, childrenOf, displayTitle, pageTags, subpageCardIds, timeAgo, wordCount } from "@dovli/core";
import { getStyle, styleVars } from "@dovli/theme";
import { Button, Icon, IconButton, Pill, Spinner, cn, modKey } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { settings, useSettings } from "@/lib/settings";
import { setActiveEditor, takeTitleFocus, ui } from "@/lib/ui";
import { cloudConfigured } from "@/lib/supabase";
import { Crumb, CrumbSep, TopBar } from "@/components/TopBar";
import { Backlinks, PageInfoRail } from "./PageInfo";
import { Cover, CoverPicker, IconPicker, TitleField } from "./PageHeader";
import { PageMenu } from "./PageMenu";

export const PageEditor = lazy(() => import("@dovli/editor/page-editor"));
export const Whiteboard = lazy(() => import("@/features/whiteboard/Whiteboard"));

/** Put the cursor at the end of the page title. */
function focusTitleEnd() {
  const t = document.getElementById("page-title") as HTMLTextAreaElement | null;
  if (!t) return;
  t.focus();
  t.setSelectionRange(t.value.length, t.value.length);
}

/** Put the cursor at the start of the page's first block. */
function focusEditorStart(editor: DovliEditor | null) {
  if (!editor) return;
  editor.focus();
  const first = editor.document[0];
  try {
    if (first) editor.setTextCursorPosition(first, "start");
  } catch {
    /* the first block has no text (a picture, say): leave the cursor where the editor put it */
  }
}

export function PageView({ id }: { id: string }) {
  const page = useStore((s) => s.pages[id]);
  const pages = useStore((s) => s.pages);
  const showInfo = useSettings((s) => s.showPageInfo);
  const spellcheck = useSettings((s) => s.spellcheck);
  const editorRef = useRef<DovliEditor | null>(null);
  const onReady = useCallback((e: DovliEditor | null) => {
    editorRef.current = e;
    setActiveEditor(e);
  }, []);
  const [findOpen, setFindOpen] = useState(false);
  const closeFind = useCallback(() => {
    setFindOpen(false);
    editorRef.current?.focus();
  }, []);

  // A brand-new page starts with the cursor in its title.
  useEffect(() => {
    if (page && takeTitleFocus(page.id)) requestAnimationFrame(focusTitleEnd);
  }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘F finds in this page, ⌘\ shows or hides the side panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "f" && !e.shiftKey && page?.kind === "doc") {
        e.preventDefault();
        setFindOpen(true);
      } else if (e.key === "\\") {
        e.preventDefault();
        settings.set({ showPageInfo: !settings.get().showPageInfo });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page?.kind]);

  if (!page || page.deletedAt) return null;
  const style = page.kind === "doc" ? getStyle(page.style) : null;
  const trail = ancestors(pages, page.id);
  const kids = childrenOf(pages, page.id);
  const linked = subpageCardIds(page.blocks);
  const unlinked = kids.filter((k) => !linked.has(k.id));
  const words = wordCount(page);
  const tags = pageTags(page);
  const mod = modKey();

  const crumbs = (
    <>
      <Crumb onClick={() => store.navigate({ name: "home" })}>Home</Crumb>
      {trail.map((a) => (
        <span key={a.id} className="contents">
          <CrumbSep />
          <Crumb onClick={() => store.navigate({ name: "page", id: a.id })}>
            <span className="font-serif text-ink-4">{a.mark}</span>
            <span className="truncate">{displayTitle(a)}</span>
          </Crumb>
        </span>
      ))}
      <CrumbSep />
      <Crumb current>
        <span className="font-serif text-accent">{page.mark}</span>
        <span className="truncate">{displayTitle(page)}</span>
      </Crumb>
    </>
  );

  const actions = (
    <>
      <IconButton
        icon={page.favorite ? "starFilled" : "star"}
        label={page.favorite ? "Remove from favourites" : "Add to favourites"}
        size="sm"
        aria-pressed={!!page.favorite}
        className={page.favorite ? "text-warn aria-pressed:bg-transparent aria-pressed:text-warn" : ""}
        onClick={() => store.toggleFavorite(page.id)}
      />
      {cloudConfigured && (
        <Button size="sm" variant="ghost" icon="share" className="max-[640px]:hidden" onClick={() => ui.set({ share: page.id })}>
          Share
        </Button>
      )}
      {page.kind === "doc" && (
        <>
          <IconButton icon="palette" label="Page style" size="sm" onClick={() => ui.set({ styleFor: page.id })} />
          <IconButton icon="search" label="Find and replace" shortcut={`${mod}F`} size="sm" className="max-[640px]:hidden" onClick={() => setFindOpen(true)} />
          {!showInfo && <IconButton icon="panelRight" label="Show page info" shortcut={`${mod}\\`} size="sm" className="max-[1199px]:hidden" onClick={() => settings.set({ showPageInfo: true })} />}
        </>
      )}
      <PageMenu page={page} onFind={() => setFindOpen(true)} trigger={<IconButton icon="more" label="More" size="sm" tooltip={false} />} />
    </>
  );

  if (page.kind === "board")
    return (
      <div className="flex h-full flex-col">
        <TopBar crumbs={crumbs}>{actions}</TopBar>
        <div className="flex flex-none items-center gap-3 px-4 pb-3 pt-1 [border-bottom:1px_solid_var(--d-line)]">
          <IconPicker page={page} size="sm" />
          <TitleField page={page} onEnter={() => (document.activeElement as HTMLElement)?.blur()} className="min-w-0 flex-1 text-2xl" />
          <span className="whitespace-nowrap text-sm text-ink-3 max-[640px]:hidden">Edited {timeAgo(page.updatedAt)}</span>
        </div>
        <Suspense fallback={<div className="grid flex-1 place-items-center"><Spinner label="Opening whiteboard" /></div>}>
          <Whiteboard key={page.id} page={page} />
        </Suspense>
      </div>
    );

  return (
    <div className="flex h-full flex-col">
      <TopBar crumbs={crumbs}>{actions}</TopBar>
      <div className="flex min-h-0 flex-1">
        <div
          data-print="scroll"
          className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]", style && "[background:var(--s-backdrop)]")}
          style={style ? (styleVars(style) as any) : undefined}
        >
          <article
            data-print="sheet"
            className={cn(
              "mx-auto w-full max-w-[860px] px-6 pb-[120px] pt-10 max-[640px]:px-4 max-[640px]:pt-8",
              style &&
                "page-styled my-16 w-[calc(100%-3rem)] max-w-[880px] rounded-sheet bg-[var(--s-paper)] px-6 py-16 shadow-sheet animate-sheet-in max-[640px]:my-3.5 max-[640px]:w-[calc(100%-1.25rem)] max-[640px]:px-3.5 max-[640px]:py-9",
            )}
          >
            <Cover page={page} />
            <header className="group/head mb-6 px-[54px] max-[640px]:px-0">
              <div className="flex items-end gap-2">
                <IconPicker page={page} />
                {!page.cover && (
                  <CoverPicker
                    page={page}
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="image"
                        className="mb-4 text-ink-3 opacity-0 focus-visible:opacity-100 group-hover/head:opacity-100 [@media(hover:none)]:opacity-100"
                        data-print="hide"
                      >
                        Add cover
                      </Button>
                    }
                  />
                )}
              </div>
              <TitleField page={page} onEnter={() => focusEditorStart(editorRef.current)} />
              <div className="mt-3.5 flex flex-wrap gap-1.5" data-print="hide">
                <Pill>Edited {timeAgo(page.updatedAt)}</Pill>
                <Pill>
                  {words} {words === 1 ? "word" : "words"}
                </Pill>
                {kids.length > 0 && (
                  <Pill>
                    {kids.length} {kids.length === 1 ? "page" : "pages"} inside
                  </Pill>
                )}
                {tags.slice(0, 4).map((t) => (
                  <button key={t} type="button" onClick={() => store.navigate({ name: "tag", tag: t })} className="h-6 rounded-full bg-accent-soft px-2.5 text-xs font-medium text-accent hover:brightness-95">
                    #{t}
                  </button>
                ))}
              </div>
            </header>
            <Suspense fallback={<div className="px-[54px] py-6 text-ink-3 max-[640px]:px-0">Opening page</div>}>
              <PageEditor key={page.id} page={page} onReady={onReady} spellcheck={spellcheck} find={{ open: findOpen, onClose: closeFind }} onExitTop={focusTitleEnd} />
            </Suspense>
            {unlinked.length > 0 && (
              <section aria-label="Also inside this page" className="mt-11 px-[54px] max-[640px]:px-0" data-print="hide">
                <h2 className="label-text m-0 mb-2">Also inside this page</h2>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {unlinked.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        onClick={() => store.navigate({ name: "page", id: k.id })}
                        className="flex w-full items-center gap-3 rounded-md bg-panel py-2.5 pl-2.5 pr-3 text-left shadow-sm transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-card"
                      >
                        <span className="grid size-9 flex-none place-items-center rounded-sm bg-accent-soft font-serif text-lg text-accent">{k.mark}</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-md font-semibold text-ink">{displayTitle(k)}</span>
                          <span className="text-xs text-ink-3">{k.kind === "board" ? "Whiteboard" : `Edited ${timeAgo(k.updatedAt)}`}</span>
                        </span>
                        <Icon name="chevron" size={14} className="text-ink-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <Backlinks page={page} />
          </article>
        </div>
        {showInfo && <PageInfoRail page={page} />}
      </div>
    </div>
  );
}
