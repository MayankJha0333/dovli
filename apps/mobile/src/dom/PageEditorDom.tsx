"use dom";

// The full Dovli page on the phone. Expo renders this file as a small web page inside the native
// app (a "DOM component"), so the phone gets exactly the same editor, blocks and themes as the web.
// The cover, icon and title are drawn here too, so they scroll away with the page as on the web;
// a styled page gets its backdrop and paper sheet. Props cross from native to web as JSON; the
// callback props become async calls back to native.

import "./editor.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from "expo/dom";
import { connectEditor, type DovliEditor } from "@dovli/editor";
import PageEditor from "@dovli/editor/page-editor";
import type { Page, PageLook } from "@dovli/core";
import { FONT_STYLESHEET, coverPreset, getTheme, resolveLook, themeStylesheet, type ThemeId } from "@dovli/theme";

// BlockNote wants the page to shrink above the phone keyboard (as the web app's viewport does).
// Expo writes this page's viewport tag, so add it here, before the editor mounts and checks.
if (typeof document !== "undefined") {
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport && !viewport.content.includes("interactive-widget")) viewport.content += ", interactive-widget=resizes-content";
}

// Android's DOM-component web view has DOM storage switched off, so window.localStorage is null, and
// BlockNote's toggle blocks crash reading their open/closed state from it. Keep that state in memory.
if (typeof window !== "undefined") {
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {}
  if (!storage) {
    const mem = new Map<string, string>();
    const memory: Storage = {
      get length() {
        return mem.size;
      },
      clear: () => mem.clear(),
      getItem: (k) => mem.get(k) ?? null,
      key: (i) => [...mem.keys()][i] ?? null,
      removeItem: (k) => void mem.delete(k),
      setItem: (k, v) => void mem.set(k, String(v)),
    };
    Object.defineProperty(window, "localStorage", { value: memory, configurable: true });
  }
}

let pages: Record<string, Page> = {};
const subs = new Set<() => void>();

/** What the phone screen can ask the editor to do. */
export interface PageEditorHandle extends DOMImperativeFactory {
  /** Back to the top of the page (a tap on the small title in the top bar). */
  scrollToTop: () => void;
}

/** A page's cover: a built-in gradient, or a picture from the web. Uploaded pictures stay on the
 *  device they were added on (they aren't synced yet), so they don't show here. */
function Cover({ cover, sheet }: { cover: string; sheet: boolean }) {
  const preset = coverPreset(cover);
  const src = /^https?:\/\//i.test(cover) ? cover : null;
  if (!preset && !src) return null;
  return (
    <div
      aria-hidden
      className="w-full overflow-hidden bg-well"
      style={{ height: sheet ? 150 : 190, background: preset?.css, borderTopLeftRadius: sheet ? 24 : 0, borderTopRightRadius: sheet ? 24 : 0 }}
    >
      {src && <img src={src} alt="" className="size-full object-cover" />}
    </div>
  );
}

/** Styles for the PDF copy of a page: the page's paper fills the sheet, and editing controls go. */
const PRINT_CSS = `
@page { margin: 14mm 12mm; }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.dovli-print { min-height: 0 !important; padding-bottom: 28px; border-radius: 18px; overflow: hidden; }
[data-print="hide"], .bn-side-menu, .bn-toolbar, .bn-formatting-toolbar, .bn-suggestion-menu { display: none !important; }
.dovli-print img, .dovli-print svg, .dovli-print table, .dovli-print pre, .dovli-print figure { break-inside: avoid; }
.dovli-print h1, .dovli-print h2, .dovli-print h3 { break-after: avoid; }
`;

const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Every stylesheet the page uses, as text (or a link, for ones from other sites like Google Fonts). */
async function pageCss(): Promise<{ css: string; links: string }> {
  let css = "";
  let links = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      css += Array.from(sheet.cssRules).map((r) => r.cssText).join("\n") + "\n";
    } catch {
      if (sheet.href) links += `<link rel="stylesheet" href="${escapeHtml(sheet.href)}">`;
    }
  }
  return { css, links };
}

/** A standalone HTML copy of what's on screen inside `root`: the same markup and styles, with
 *  form fields turned into text and drawings turned into pictures, ready to print as a PDF. */
async function snapshot(root: HTMLElement, title: string): Promise<string> {
  const clone = root.cloneNode(true) as HTMLElement;
  // A textarea's text isn't part of its markup: write the title out as a heading instead.
  const live = root.querySelectorAll("textarea");
  clone.querySelectorAll("textarea").forEach((el, i) => {
    const h = document.createElement("h1");
    h.textContent = live[i]?.value || "Untitled";
    h.setAttribute("style", el.getAttribute("style") ?? "");
    h.className = el.className;
    h.style.height = "auto";
    h.style.margin = "0";
    el.replaceWith(h);
  });
  const canvases = root.querySelectorAll("canvas");
  clone.querySelectorAll("canvas").forEach((el, i) => {
    try {
      const img = document.createElement("img");
      img.src = canvases[i].toDataURL("image/png");
      img.style.width = `${canvases[i].clientWidth}px`;
      el.replaceWith(img);
    } catch {
      el.remove();
    }
  });
  clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
  clone.querySelectorAll('[data-print="hide"]').forEach((el) => el.remove());
  const { css, links } = await pageCss();
  const html = document.documentElement;
  return `<!doctype html><html lang="en" data-theme="${html.dataset.theme ?? ""}" data-scheme="${html.dataset.scheme ?? ""}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>${links}<style>${css}</style><style>${PRINT_CSS}</style></head><body>${clone.outerHTML}</body></html>`;
}

/** The title: grows with its text. Return carries on into the page, as on the web. */
function TitleField({ value, onChange, onEnter, readOnly, board, inputRef }: { value: string; onChange: (v: string) => void; onEnter: () => void; readOnly?: boolean; board: boolean; inputRef: React.RefObject<HTMLTextAreaElement | null> }) {
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, inputRef]);
  return (
    <textarea
      ref={inputRef}
      rows={1}
      readOnly={readOnly}
      value={value}
      placeholder={board ? "Untitled board" : "Untitled"}
      aria-label="Page title"
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ""))}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        e.preventDefault();
        onEnter();
      }}
      className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-ink outline-none placeholder:text-ink-4"
      style={{
        fontFamily: "var(--title-font, var(--d-font-display))",
        fontStyle: "var(--title-style, normal)" as any,
        fontWeight: "var(--title-weight, var(--d-display-weight))" as any,
        letterSpacing: "var(--d-display-tracking)",
        fontSize: 30,
        lineHeight: 1.15,
      }}
    />
  );
}
const setPages = (next: Record<string, Page>) => {
  pages = next;
  subs.forEach((s) => s());
};

export default function PageEditorDom({
  page,
  others,
  themeId,
  background,
  mark,
  cover,
  liveStyle,
  liveLook,
  path,
  meta,
  topInset,
  bottomInset,
  onTitleChange,
  onOpenInfo,
  onTitleHidden,
  onSave,
  onOpenPage,
  onCreatePage,
  readOnly,
  onPrint,
  ref,
}: {
  page: Page;
  /** Titles and icons of other pages, for [[ links and sub-page cards. */
  others: Pick<Page, "id" | "title" | "mark" | "kind" | "parentId" | "deletedAt" | "updatedAt" | "createdAt" | "order">[];
  themeId: ThemeId;
  /** Solid colour behind the editor, matching the native screen around it. */
  background: string;
  /** The page's current icon and cover (they can change from the actions sheet while it's open). */
  mark: string;
  cover?: string | null;
  /** The page's style and look as they are now (changed from the Style sheet while it's open). */
  liveStyle?: string | null;
  liveLook?: PageLook | null;
  /** The pages this one sits inside, outermost first: tap one to go there. */
  path: { id: string; label: string }[];
  /** "Edited 2 min ago · 120 words": opens Page info. */
  meta: string;
  /** Room at the top for the phone's floating buttons, and at the bottom for the home indicator. */
  topInset: number;
  bottomInset: number;
  onTitleChange: (title: string) => Promise<void>;
  onOpenInfo: () => Promise<void>;
  /** The title scrolled under the top bar (or came back): the bar shows a small title meanwhile. */
  onTitleHidden: (hidden: boolean) => Promise<void>;
  onSave: (blocks: any[]) => Promise<void>;
  onOpenPage: (id: string) => Promise<void>;
  /** Make a page with this id on the phone (the editor needs the id straight away). */
  onCreatePage: (id: string, kind: "doc" | "board", title: string) => Promise<void>;
  /** A page in the trash: read it, don't change it. */
  readOnly?: boolean;
  /** Print mode: draw the page once, read-only, then hand back a standalone HTML copy for a PDF. */
  onPrint?: (html: string) => Promise<void>;
  dom?: DOMProps;
  ref?: React.Ref<PageEditorHandle>;
}) {
  const shown = useMemo(
    () => (liveStyle === undefined && liveLook === undefined ? page : { ...page, style: liveStyle ?? undefined, look: liveLook ?? undefined }),
    [page, liveStyle, liveLook],
  );
  const editorRef = useRef<DovliEditor | null>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback((e: DovliEditor | null) => {
    editorRef.current = e;
    setReady(!!e);
  }, []);
  /** Put the cursor at the start of the page (Return in the title, as on the web). */
  const focusStart = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const first = editor.document[0];
    try {
      if (first) editor.setTextCursorPosition(first, "start");
    } catch {
      /* the first block has no text (a picture, say): leave the cursor where the editor put it */
    }
  }, []);
  useDOMImperativeHandle(
    ref as React.Ref<PageEditorHandle>,
    () => ({
      scrollToTop: () => (boxRef.current ?? window).scrollTo({ top: 0, behavior: "smooth" }),
    }),
    [],
  );

  const titleRef = useRef<HTMLTextAreaElement>(null);
  // A styled page scrolls inside its paper sheet; a plain page scrolls as a whole.
  const boxRef = useRef<HTMLElement>(null);
  const [title, setTitle] = useState(page.title);
  const styled = !!resolveLook(shown.style, shown.look).style;

  // Tell the phone when the title has scrolled out of sight (up out of the sheet, or under the
  // floating buttons), so its top bar can show a small title meanwhile.
  useEffect(() => {
    const box = boxRef.current;
    const target: HTMLElement | Window = box ?? window;
    let hidden = false;
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = titleRef.current;
      const edge = box ? box.getBoundingClientRect().top + 4 : topInset;
      const now = !!el && el.getBoundingClientRect().bottom < edge;
      if (now !== hidden) {
        hidden = now;
        void onTitleHidden(now).catch(() => {});
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [topInset, onTitleHidden, styled]);

  // Theme: the same CSS variables as the web app, switched by data-theme.
  useEffect(() => {
    let style = document.getElementById("dovli-themes");
    if (!style) {
      style = document.createElement("style");
      style.id = "dovli-themes";
      style.textContent = themeStylesheet();
      document.head.append(style);
      // The theme fonts, as on the web. Offline, the editor uses the phone's own font.
      const fonts = document.createElement("link");
      fonts.rel = "stylesheet";
      fonts.href = FONT_STYLESHEET;
      document.head.append(fonts);
    }
    const t = getTheme(themeId);
    document.documentElement.dataset.theme = t.id;
    document.documentElement.dataset.scheme = t.scheme;
    document.documentElement.style.colorScheme = t.scheme;
    document.documentElement.style.background = background;
    document.body.style.background = background;
  }, [themeId, background]);

  // Starts as the page it opened with, so a save of the same blocks is skipped.
  const lastSaved = useRef<string | null>(JSON.stringify(page.blocks ?? []));

  // The page list for links and sub-page cards. It's swapped in while rendering (so this render
  // sees it), but listeners hear about it only afterwards: telling them during render makes React
  // warn "Cannot update a component while rendering a different component".
  const nextPages = useMemo(() => ({ ...Object.fromEntries(others.map((o) => [o.id, o as Page])), [page.id]: page }), [others, page]);
  pages = nextPages;
  useEffect(() => subs.forEach((s) => s()), [nextPages]);

  useMemo(
    () =>
      connectEditor({
        usePages: (select) =>
          useSyncExternalStore(
            (l) => {
              subs.add(l);
              return () => subs.delete(l);
            },
            () => select(pages),
            () => select(pages),
          ),
        getPages: () => pages,
        openPage: (id) => void onOpenPage(id),
        createPage: (input) => {
          // The page is saved on the phone side; the editor gets its id right away.
          const id = Math.random().toString(36).slice(2, 12);
          const now = Date.now();
          const created: Page = { id, parentId: page.id, kind: input.kind, title: input.title ?? "", mark: input.kind === "board" ? "◇" : "¶", createdAt: now, updatedAt: now, order: 0 };
          setPages({ ...pages, [id]: created });
          void onCreatePage(id, input.kind, input.title ?? "");
          return created;
        },
        // Only send real changes. The editor also saves when it closes; sending an unchanged page then
        // makes the app answer an editor that's already gone ("Unable to find the 'DomWebView'").
        saveBlocks: (_id, blocks) => {
          const json = JSON.stringify(blocks);
          if (json === lastSaved.current) return;
          lastSaved.current = json;
          void onSave(blocks).catch(() => {});
        },
      }),
    [onSave, onOpenPage, onCreatePage, page.id],
  );

  // A page with its own style (paper, ink, accent) gets the same look as on the web: its backdrop
  // behind, and the page on a paper sheet. A plain page fills the screen.
  const look = resolveLook(shown.style, shown.look);
  const hasCover = !!cover && (!!coverPreset(cover) || /^https?:\/\//i.test(cover));
  const head = (
    <header className={styled ? "px-4" : "px-5"} style={{ paddingTop: hasCover ? 0 : styled ? 24 : topInset }}>
      {path.length > 0 && !hasCover && (
        <nav aria-label="Where this page is" data-print="hide" className="mb-3 flex flex-wrap items-center gap-1 text-[13px] font-medium text-ink-3">
          {path.map((a) => (
            <span key={a.id} className="flex items-center gap-1">
              <button type="button" className="max-w-[160px] truncate border-0 bg-transparent p-0 text-ink-3" onClick={() => void onOpenPage(a.id)}>
                {a.label}
              </button>
              <span aria-hidden className="text-ink-4">›</span>
            </span>
          ))}
        </nav>
      )}
      <div
        aria-hidden
        className="flex items-center justify-center rounded-[18px]"
        style={{ width: 56, height: 56, fontSize: 26, color: "var(--d-accent)", background: "var(--d-accent-soft)", marginTop: hasCover ? -28 : 0, position: "relative", boxShadow: hasCover ? "0 0 0 3px var(--d-panel)" : undefined }}
      >
        {mark}
      </div>
      <div className="mt-4">
        <TitleField
          inputRef={titleRef}
          value={title}
          readOnly={readOnly}
          board={page.kind === "board"}
          onChange={(v) => {
            setTitle(v);
            void onTitleChange(v).catch(() => {});
          }}
          onEnter={focusStart}
        />
      </div>
      <button type="button" data-print="hide" onClick={() => void onOpenInfo()} className="mb-3 mt-1.5 flex items-center gap-1 border-0 bg-transparent p-0 text-[13px] text-ink-3">
        {meta}
        <span aria-hidden className="text-ink-4">ⓘ</span>
      </button>
    </header>
  );
  const editor = (
    <div className="px-4">
      <PageEditor page={shown} onReady={onReady} onExitTop={() => titleRef.current?.focus()} readOnly={!!readOnly} touch />
    </div>
  );

  // Print mode: once the editor, fonts and drawings are in, send back the page as HTML.
  const printRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onPrint || !ready) return;
    let cancelled = false;
    void (async () => {
      await document.fonts?.ready.catch(() => {});
      // Flowcharts, link previews and pictures draw a moment after the text.
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled || !printRef.current) return;
      await onPrint(await snapshot(printRef.current, title || "Untitled")).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  if (onPrint)
    return (
      <div
        ref={printRef}
        className={styled ? "dovli-print page-styled w-full min-w-0 text-ink" : "dovli-print w-full min-w-0 text-ink"}
        data-divider={look.divider}
        style={{ ...(look.vars as any), background: styled ? "var(--s-paper)" : "var(--d-panel)", paddingTop: hasCover ? 0 : 8 }}
      >
        {hasCover && <Cover cover={cover!} sheet={styled} />}
        {head}
        {editor}
      </div>
    );

  if (!styled)
    return (
      <div className="min-h-dvh w-full min-w-0 pb-24 text-ink" data-divider={look.divider} style={look.vars as any}>
        {hasCover && <Cover cover={cover!} sheet={false} />}
        {head}
        {editor}
      </div>
    );
  return (
    <div className="page-styled min-h-dvh w-full min-w-0 text-ink" style={look.vars as any} data-divider={look.divider}>
      <div aria-hidden className="fixed inset-0" style={{ background: "var(--s-backdrop)", zIndex: 0 }} />
      {/* The sheet stays where it is, over the style's art; the page scrolls inside it. */}
      <article
        ref={boxRef}
        className="fixed overflow-y-auto overflow-x-hidden"
        style={{
          zIndex: 1,
          top: topInset,
          left: 10,
          right: 10,
          bottom: bottomInset,
          background: "var(--s-paper)",
          borderRadius: 24,
          boxShadow: "var(--d-shadow-sheet)",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="pb-16">
          {hasCover && <Cover cover={cover!} sheet />}
          {head}
          {editor}
        </div>
      </article>
    </div>
  );
}
