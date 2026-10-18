"use dom";

// The full Dovli editor on the phone. Expo renders this file as a small web page inside the native
// app (a "DOM component"), so the phone gets exactly the same editor, blocks and themes as the web.
// Props cross from native to web as JSON; the callback props become async calls back to native.

import "./editor.css";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { DOMProps } from "expo/dom";
import { connectEditor } from "@dovli/editor";
import PageEditor from "@dovli/editor/page-editor";
import type { Page } from "@dovli/core";
import { FONT_STYLESHEET, getTheme, resolveLook, themeStylesheet, type ThemeId } from "@dovli/theme";

let pages: Record<string, Page> = {};
const subs = new Set<() => void>();
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
  dom?: DOMProps;
}) {
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

  useMemo(() => {
    setPages({ ...Object.fromEntries(others.map((o) => [o.id, o as Page])), [page.id]: page });
  }, [others, page]);

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
        saveBlocks: (_id, blocks) => void onSave(blocks),
      }),
    [onSave, onOpenPage, onCreatePage, page.id],
  );

  // A page with its own style (paper, ink, accent) gets the same look as on the web.
  const look = resolveLook(page.style, page.look);
  return (
    <div className={look.style ? "page-styled min-h-dvh px-1 pb-24 text-ink" : "min-h-dvh px-1 pb-24 text-ink"} style={look.vars as any} data-divider={look.divider}>
      <PageEditor page={page} onExitTop={() => void onExitTop()} />
    </div>
  );
}
