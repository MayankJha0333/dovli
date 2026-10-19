import type { DovliEditor } from "@dovli/editor";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ancestors, childrenOf, displayTitle, outline, pageTags, subpageCardIds, timeAgo, wordCount } from "@dovli/core";
import { resolveLook } from "@dovli/theme";
import { Button, Icon, Spinner, cn } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { settings, useSettings } from "@/lib/settings";
import { setActiveEditor, takeTitleFocus, ui, useUI } from "@/lib/ui";
import { Crumb, CrumbSep, TopBar } from "@/components/TopBar";
import { Backlinks, scrollToBlock } from "./PageInfo";
import { Cover, CoverPicker, IconPicker, PageIconGlyph, TitleField, hasOwnIcon } from "./PageHeader";
import { PageToolbar } from "./panels/PageToolbar";
import { find } from "@/lib/find";

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
  const spellcheck = useSettings((s) => s.spellcheck);
  const editorRef = useRef<DovliEditor | null>(null);
  const [editor, setEditor] = useState<DovliEditor | null>(null);
  const onReady = useCallback(
    (e: DovliEditor | null) => {
      editorRef.current = e;
      setEditor(e);
      setActiveEditor(e, id);
    },
    [id],
  );
  const presenting = useUI((s) => s.presenting === id);
  const scroller = useRef<HTMLDivElement>(null);

  // Craft's scroll fader: it fades in over the first 48px of scrolling, so the top of the page is untouched.
  const fadeFrame = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const onScroll = useCallback(() => {
    if (fadeFrame.current) return;
    fadeFrame.current = requestAnimationFrame(() => {
      fadeFrame.current = 0;
      const el = scroller.current;
      const r = root.current;
      if (!el || !r) return;
      r.style.setProperty("--fade-o", String(Math.min(1, Math.max(0, el.scrollTop / 48))));
      r.style.setProperty("--scrollbar", `${el.offsetWidth - el.clientWidth}px`);
    });
  }, []);
  useEffect(() => {
    root.current?.style.setProperty("--fade-o", "0");
    return () => cancelAnimationFrame(fadeFrame.current);
  }, [id]);

  // A brand-new page starts with the cursor in its title.
  useEffect(() => {
    if (page && takeTitleFocus(page.id)) requestAnimationFrame(focusTitleEnd);
  }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Present: the page full screen, read-only, bigger. ← → (or Page Up/Down) step through
  // the headings, Esc stops. Falls back to filling the window where full screen isn't allowed.
  useEffect(() => {
    if (!presenting) return;
    const el = scroller.current;
    el?.requestFullscreen?.().catch(() => {});
    const stop = () => ui.set({ presenting: null });
    const onFs = () => !document.fullscreenElement && stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return stop();
      const keys = ["ArrowRight", "ArrowLeft", "PageDown", "PageUp", " "];
      if (!keys.includes(e.key) || !page) return;
      e.preventDefault();
      const heads = outline(page);
      const top = el?.getBoundingClientRect().top ?? 0;
      const pos = heads.map((h) => ({ id: h.id, y: (document.querySelector(`.bn-block-outer[data-id="${CSS.escape(h.id)}"]`)?.getBoundingClientRect().top ?? 0) - top }));
      const forward = e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ";
      const next = forward ? pos.find((p) => p.y > 40) : [...pos].reverse().find((p) => p.y < -40);
      if (next) scrollToBlock(next.id);
      else el?.scrollTo({ top: forward ? el.scrollHeight : 0, behavior: "smooth" });
    };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [presenting]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘F opens Find in the sidebar, like Craft; ⌘G and ⌘⇧G step through the matches.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || page?.kind !== "doc") return;
      const k = e.key.toLowerCase();
      if (k === "f" && !e.shiftKey) {
        e.preventDefault();
        find.show();
      } else if (k === "g" && find.get().open) {
        e.preventDefault();
        find.step(e.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page?.kind]);

  if (!page || page.deletedAt) return null;
  const look = page.kind === "doc" ? resolveLook(page.style, page.look) : null;
  const style = look?.style ?? null;
  const trail = ancestors(pages, page.id);
  const kids = childrenOf(pages, page.id);
  const linked = subpageCardIds(page.blocks);
  const unlinked = kids.filter((k) => !linked.has(k.id));
  const words = wordCount(page);
  const tags = pageTags(page);

  const crumbs = (
    <>
      {trail.map((a) => (
        <span key={a.id} className="contents">
          <Crumb onClick={() => store.navigate({ name: "page", id: a.id })}>
            <span className="font-serif text-ink-4">{a.mark}</span>
            <span className="truncate">{displayTitle(a)}</span>
          </Crumb>
          <CrumbSep />
        </span>
      ))}
      <Crumb current>
        <span className="font-serif text-accent">{page.mark}</span>
        <span className="truncate">{displayTitle(page)}</span>
      </Crumb>
    </>
  );

  const actions = <PageToolbar page={page} editor={editor} onFind={() => find.show()} onPresent={() => ui.set({ presenting: page.id })} />;

  if (page.kind === "board")
    return (
      <div className="flex h-full flex-col">
        <TopBar crumbs={crumbs} bareActions showCrumbs={trail.length > 0}>
          {actions}
        </TopBar>
        <div className="flex flex-none items-center gap-3 px-4 pb-3 pt-1 [border-bottom:1px_solid_var(--d-line)]">
          <IconPicker
            page={page}
            trigger={
              <button type="button" aria-label="Change page icon" className="flex-none rounded-sm transition-transform hover:brightness-95 active:scale-[0.97]">
                <PageIconGlyph mark={page.mark} size="sm" />
              </button>
            }
          />
          <TitleField page={page} onEnter={() => (document.activeElement as HTMLElement)?.blur()} className="min-w-0 flex-1 text-2xl" />
          <span className="whitespace-nowrap text-sm text-ink-3 max-[640px]:hidden">Edited {timeAgo(page.updatedAt)}</span>
        </div>
        <Suspense fallback={<div className="grid flex-1 place-items-center"><Spinner label="Opening whiteboard" /></div>}>
          <Whiteboard key={page.id} page={page} />
        </Suspense>
      </div>
    );

  const meta = [`Edited ${timeAgo(page.updatedAt)}`, `${words} ${words === 1 ? "word" : "words"}`, ...(kids.length ? [`${kids.length} ${kids.length === 1 ? "page" : "pages"} inside`] : [])];

  return (
    <div ref={root} className="relative flex h-full flex-col">
      {!presenting && (
        <TopBar
          crumbs={crumbs}
          bareActions
          showCrumbs={trail.length > 0}
          // Like Craft, the bar itself has no background, before or after scrolling: only its glass
          // pills float over the page, and the strip between them lets clicks through to the page.
          className="pointer-events-none absolute inset-x-0 top-0 [&>*]:pointer-events-auto"
        >
          {actions}
        </TopBar>
      )}
      {/* Craft's scroll fader: a blur that fades out downwards, under the top bar's pills. It stops
          short of the scrollbar so that stays crisp. */}
      {!presenting && (
        <div
          aria-hidden="true"
          data-scroll-fader
          data-styled={style ? "" : undefined}
          style={look?.vars as any}
          className="scroll-fader pointer-events-none absolute left-0 right-[var(--scrollbar,0px)] top-0 z-[15] h-[76px]"
        />
      )}
      <div className="flex min-h-0 flex-1">
        <div
          ref={scroller}
          data-print="scroll"
          data-backdrop-fixed={style && !presenting ? "" : undefined}
          onScroll={presenting ? undefined : onScroll}
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
            style && "[background:var(--s-backdrop)]",
            presenting && "dovli-presenting fixed inset-0 z-[400] bg-panel",
            presenting && style && "[background:var(--s-backdrop)]",
          )}
          style={look?.vars as any}
        >
          {/* Plain pages: the cover runs edge to edge across the page area. */}
          {!style && page.cover && <Cover page={page} editable={!presenting} />}
          <article
            data-print="sheet"
            data-divider={look?.divider}
            className={cn(
              "mx-auto w-full px-6 pb-[120px] max-[640px]:px-4",
              // Room for the floating top bar (56px), then the page's own top space.
              page.cover && !style ? "pt-0" : "pt-[104px] max-[640px]:pt-[88px]",
              look?.wide ? "max-w-[1180px]" : "max-w-[820px]",
              style &&
                cn(
                  "page-styled mb-14 mt-[76px] w-[calc(100%-3rem)] rounded-sheet bg-[var(--s-paper)] px-6 shadow-sheet animate-sheet-in max-[640px]:mb-3.5 max-[640px]:mt-[62px] max-[640px]:w-[calc(100%-1.25rem)] max-[640px]:px-3.5",
                  page.cover ? "pt-0" : "pt-14 max-[640px]:pt-9",
                  look?.wide ? "max-w-[1200px]" : "max-w-[860px]",
                ),
            )}
          >
            {/* Styled pages: the cover sits on the paper's top edge. */}
            {style && page.cover && (
              <div className="-mx-6 mb-0 max-[640px]:-mx-3.5">
                <Cover page={page} variant="sheet" editable={!presenting} />
              </div>
            )}
            <header className="group/head relative mb-7 px-[54px] max-[640px]:px-0">
              {/* The icon: half over the cover when there is one. A page with only the default
                  mark shows no icon here; "Add icon" appears on hover instead. */}
              {hasOwnIcon(page) && (
                <div className={cn("relative z-[1] flex", page.cover ? "-mt-[40px] mb-2 max-[640px]:-mt-[32px]" : "mb-3")}>
                  <IconPicker
                    page={page}
                    trigger={
                      <button type="button" aria-label="Change page icon" disabled={presenting} className="rounded-xl transition-transform hover:brightness-95 active:scale-[0.97] disabled:pointer-events-none">
                        <PageIconGlyph mark={page.mark} onCover={!!page.cover} />
                      </button>
                    }
                  />
                </div>
              )}
              {!presenting && (!hasOwnIcon(page) || !page.cover) && (
                <div
                  className={cn(
                    "-ml-2 flex h-8 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/head:opacity-100 [@media(hover:none)]:opacity-100",
                    page.cover && !hasOwnIcon(page) && "mt-3",
                  )}
                  data-print="hide"
                >
                  {!hasOwnIcon(page) && (
                    <IconPicker
                      page={page}
                      trigger={
                        <Button size="sm" variant="ghost" icon="sparkles" className="text-ink-3">
                          Add icon
                        </Button>
                      }
                    />
                  )}
                  {!page.cover && (
                    <CoverPicker
                      page={page}
                      trigger={
                        <Button size="sm" variant="ghost" icon="image" className="text-ink-3">
                          Add cover
                        </Button>
                      }
                    />
                  )}
                </div>
              )}
              <TitleField page={page} readOnly={presenting} onEnter={() => focusEditorStart(editorRef.current)} />
              <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-3" data-print="hide">
                {meta.map((m, i) => (
                  <span key={m} className="flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden="true" className="text-ink-4">·</span>}
                    {m}
                  </span>
                ))}
                {tags.slice(0, 4).map((t) => (
                  <button key={t} type="button" onClick={() => store.navigate({ name: "tag", tag: t })} className="ml-1 h-6 rounded-full bg-accent-soft px-2.5 text-xs font-medium text-accent hover:brightness-95">
                    #{t}
                  </button>
                ))}
              </div>
              {/* A hairline under the title, as in Craft, so the document starts clearly. */}
              {page.kind === "doc" && <div aria-hidden="true" className="mt-5 h-px bg-line max-[640px]:mt-4" />}
            </header>
            <Suspense fallback={<div className="px-[54px] py-6 text-ink-3 max-[640px]:px-0">Opening page</div>}>
              <PageEditor
                key={page.id}
                page={page}
                onReady={onReady}
                readOnly={presenting}
                spellcheck={spellcheck}
                onExitTop={focusTitleEnd}
              />
            </Suspense>
            {unlinked.length > 0 && !presenting && (
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
            {!presenting && <Backlinks page={page} />}
          </article>
          {presenting && (
            <div className="pointer-events-none fixed inset-x-0 bottom-5 z-10 flex justify-center" data-print="hide">
              <div className="pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 text-sm text-ink-2 shadow-pop surface-raised">
                <span>← → move between headings</span>
                <span aria-hidden="true" className="text-ink-4">·</span>
                <button type="button" onClick={() => ui.set({ presenting: null })} className="font-semibold text-ink hover:text-accent">
                  Stop presenting (Esc)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
