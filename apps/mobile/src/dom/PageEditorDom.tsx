"use dom";

// The full Dovli editor on the phone. Expo renders this file as a small web page inside the native
// app (a "DOM component"), so the phone gets exactly the same editor, blocks and themes as the web.
// Props cross from native to web as JSON; the callback props become async calls back to native.

import "./editor.css";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from "expo/dom";
import { connectEditor, type DovliEditor } from "@dovli/editor";
import PageEditor from "@dovli/editor/page-editor";
import type { Page } from "@dovli/core";
import { FONT_STYLESHEET, getTheme, resolveLook, themeStylesheet, type ThemeId } from "@dovli/theme";

let pages: Record<string, Page> = {};
const subs = new Set<() => void>();

/** What the phone screen can ask the editor to do. */
export interface PageEditorHandle extends DOMImperativeFactory {
  /** Put the cursor at the start of the page (return in the title, as on the web). */
  focusStart: () => void;
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
  onSave,
  onOpenPage,
  onCreatePage,
  onExitTop,
  readOnly,
  ref,
}: {
  page: Page;
  /** Titles and icons of other pages, for [[ links and sub-page cards. */
  others: Pick<Page, "id" | "title" | "mark" | "kind" | "parentId" | "deletedAt" | "updatedAt" | "createdAt" | "order">[];
  themeId: ThemeId;
  /** Solid colour behind the editor, matching the native screen around it. */
  background: string;
  onSave: (blocks: any[]) => Promise<void>;
  onOpenPage: (id: string) => Promise<void>;
  /** Make a page with this id on the phone (the editor needs the id straight away). */
  onCreatePage: (id: string, kind: "doc" | "board", title: string) => Promise<void>;
  /** Backspace, ← or ↑ at the very top of the page: the native title field takes the cursor. */
  onExitTop: () => Promise<void>;
  /** A page in the trash: read it, don't change it. */
  readOnly?: boolean;
  dom?: DOMProps;
  ref?: React.Ref<PageEditorHandle>;
}) {
  const editorRef = useRef<DovliEditor | null>(null);
  const onReady = useCallback((e: DovliEditor | null) => {
    editorRef.current = e;
  }, []);
  useDOMImperativeHandle(
    ref as React.Ref<PageEditorHandle>,
    () => ({
      focusStart: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const first = editor.document[0];
        try {
          if (first) editor.setTextCursorPosition(first, "start");
        } catch {
          /* the first block has no text (a picture, say): leave the cursor where the editor put it */
        }
      },
    }),
    [],
  );

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

  // A page with its own style (paper, ink, accent) gets the same look as on the web.
  const look = resolveLook(page.style, page.look);
  return (
    <div className={look.style ? "page-styled min-h-dvh w-full min-w-0 px-1 pb-24 text-ink" : "min-h-dvh w-full min-w-0 px-1 pb-24 text-ink"} style={look.vars as any} data-divider={look.divider}>
      <PageEditor page={page} onReady={onReady} onExitTop={() => void onExitTop()} readOnly={!!readOnly} touch />
    </div>
  );
}
