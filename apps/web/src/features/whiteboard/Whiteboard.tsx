import { useEffect, useMemo, useRef } from "react";
import { Excalidraw, convertToExcalidrawElements, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { Page } from "@dovli/core";
import { useIsDark } from "@dovli/editor";
import { store } from "@/lib/store";

try {
  // Excalidraw loads its fonts from <origin>/fonts/…, served from public/fonts.
  (window as any).EXCALIDRAW_ASSET_PATH = `${window.location.origin}/`;
} catch {
  /* ignore */
}

/** A cheap fingerprint so we only save when shapes really changed. */
function fingerprint(elements: readonly any[]) {
  let v = elements.length;
  for (const e of elements) v += e.version;
  return v;
}

export default function Whiteboard({ page }: { page: Page }) {
  const dark = useIsDark();
  const lastPrint = useRef<number | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const converted = useRef<any[] | null>(null);

  const initialData = useMemo(() => {
    const board = page.board ?? {};
    let elements = board.elements ?? [];
    if (!elements.length && board.skeleton?.length) {
      elements = convertToExcalidrawElements(board.skeleton as any, { regenerateIds: false }) as any[];
      converted.current = elements;
    }
    lastPrint.current = fingerprint(elements);
    return {
      elements,
      files: board.files ?? {},
      scrollToContent: true,
      appState: {
        viewBackgroundColor: "transparent",
        currentItemRoughness: 0,
        currentItemFontFamily: 6,
        currentItemStrokeWidth: 1,
        currentItemRoundness: "round" as const,
      },
    };
    // Only on first open of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);


  // A template's outline becomes real shapes the first time the board opens. Save that once,
  // after render (saving during render would update the sidebar mid-render).
  useEffect(() => {
    if (!converted.current) return;
    const board = page.board ?? {};
    store.updatePage(page.id, { board: { ...board, elements: converted.current, skeleton: undefined } }, false);
    converted.current = null;
  }, [page.id]);
  return (
    <div className="board">
      <Excalidraw
        key={page.id}
        initialData={initialData as any}
        theme={dark ? "dark" : "light"}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: null, export: false } }}
        onChange={(elements, _appState, files) => {
          const print = fingerprint(elements);
          if (print === lastPrint.current) return;
          lastPrint.current = print;
          window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(() => {
            const live = elements.filter((e: any) => !e.isDeleted);
            const used = new Set(live.map((e: any) => e.fileId).filter(Boolean));
            const keptFiles = Object.fromEntries(Object.entries(files).filter(([id]) => used.has(id)));
            store.updatePage(page.id, { board: { elements: live as any[], files: keptFiles } });
          }, 300);
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
    </div>
  );
}
