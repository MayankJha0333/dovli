import type { DovliEditor } from "@dovli/editor";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { store, useStore } from "@/lib/store";
import { childrenOf, ancestors, displayTitle, wordCount, timeAgo } from "@dovli/core";
import { getStyle, styleVars } from "@dovli/theme";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toasts";
import { ToolButton, TopBar } from "@/components/TopBar";
import { StyleGallery } from "@/features/page-styles/StyleGallery";
import { DeleteControl, collectLinked } from "@/features/page/DeleteControl";
import { MarkPicker } from "@/features/page/MarkPicker";
import { TitleField } from "@/features/page/TitleField";
import { newPage } from "@/features/pages/actions";

export const PageEditor = lazy(() => import("@dovli/editor/page-editor"));
export const Whiteboard = lazy(() => import("@/features/whiteboard/Whiteboard"));

export function PageView({ id, onMenu }: { id: string; onMenu: () => void }) {
  const page = useStore((s) => s.pages[id]);
  const pages = useStore((s) => s.pages);
  const editorRef = useRef<DovliEditor | null>(null);
  const onReady = useCallback((e: DovliEditor | null) => {
    editorRef.current = e;
  }, []);
  const [styling, setStyling] = useState(false);
  const closeStyling = useCallback(() => setStyling(false), []);

  if (!page) return null;
  const style = page.kind === "doc" ? getStyle(page.style) : null;
  const trail = ancestors(pages, page.id);
  const kids = childrenOf(pages, page.id);
  const linked = collectLinked(page.blocks);
  const unlinked = kids.filter((k) => !linked.has(k.id));
  const words = wordCount(page);

  const copyMarkdown = async () => {
    const ed = editorRef.current;
    if (!ed) return;
    const md = `# ${displayTitle(page)}\n\n${ed.blocksToMarkdownLossy(ed.document.filter((b: any) => b.type !== "subpage") as any)}`;
    try {
      await navigator.clipboard.writeText(md);
      toast("Markdown copied");
    } catch {
      toast("Couldn't reach the clipboard. Try again from a browser tab.");
    }
  };

  const crumbs = (
    <>
      <button type="button" className="crumb" onClick={() => store.navigate({ name: "home" })}>
        Home
      </button>
      {trail.map((a) => (
        <span key={a.id} className="crumb-wrap">
          <span className="crumb-sep" aria-hidden="true">
            <Icon name="chevron" size={11} />
          </span>
          <button type="button" className="crumb" onClick={() => store.navigate({ name: "page", id: a.id })}>
            <span className="crumb__mark">{a.mark}</span>
            {displayTitle(a)}
          </button>
        </span>
      ))}
      <span className="crumb-wrap">
        <span className="crumb-sep" aria-hidden="true">
          <Icon name="chevron" size={11} />
        </span>
        <span className="crumb crumb--here">
          <span className="crumb__mark">{page.mark}</span>
          {displayTitle(page)}
        </span>
      </span>
    </>
  );

  return (
    <div className={`view view--${page.kind}${style ? " view--styled" : ""}`}>
      <TopBar onMenu={onMenu} crumbs={crumbs}>
        {page.kind === "doc" && <ToolButton icon="palette" label="Page style" onClick={() => setStyling(true)} />}
        {page.kind === "doc" && <ToolButton icon="copy" label="Copy as Markdown" onClick={copyMarkdown} />}
        <ToolButton icon="pagePlus" label="Add page inside" onClick={() => newPage("doc", page.id)} />
        <DeleteControl key={page.id} page={page} />
      </TopBar>

      {styling && <StyleGallery page={page} onClose={closeStyling} />}

      {page.kind === "doc" ? (
        <div className="scroll" style={style ? styleVars(style) : undefined}>
          <article className={`sheet${style ? " sheet--styled" : ""}`}>
            <header className="page-head">
              <MarkPicker page={page} />
              <TitleField page={page} onEnter={() => editorRef.current?.focus()} />
              <p className="page-meta">
                <span>Edited {timeAgo(page.updatedAt)}</span>
                <span>
                  {words} {words === 1 ? "word" : "words"}
                </span>
                {kids.length > 0 && (
                  <span>
                    {kids.length} {kids.length === 1 ? "page" : "pages"} inside
                  </span>
                )}
              </p>
            </header>
            <Suspense fallback={<div className="loading">Opening page</div>}>
              <PageEditor key={page.id} page={page} onReady={onReady} />
            </Suspense>
            {unlinked.length > 0 && (
              <section className="inside">
                <h2 className="inside__title">Also inside this page</h2>
                <ul>
                  {unlinked.map((k) => (
                    <li key={k.id}>
                      <button type="button" className="subpage" onClick={() => store.navigate({ name: "page", id: k.id })}>
                        <span className="subpage__mark">{k.mark}</span>
                        <span className="subpage__text">
                          <span className="subpage__title">{displayTitle(k)}</span>
                          <span className="subpage__meta">{k.kind === "board" ? "Whiteboard" : `Edited ${timeAgo(k.updatedAt)}`}</span>
                        </span>
                        <span className="subpage__go" aria-hidden="true">
                          <Icon name="chevron" size={14} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </div>
      ) : (
        <div className="board-wrap">
          <div className="board-head">
            <MarkPicker page={page} size="sm" />
            <TitleField page={page} onEnter={() => (document.activeElement as HTMLElement)?.blur()} />
            <span className="board-head__meta">Edited {timeAgo(page.updatedAt)}</span>
          </div>
          <Suspense fallback={<div className="loading">Opening whiteboard</div>}>
            <Whiteboard key={page.id} page={page} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Document cards (recent pages + templates)                           */
/* ------------------------------------------------------------------ */
