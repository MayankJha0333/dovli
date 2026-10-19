"use dom";

// A whiteboard on the phone: the same Excalidraw canvas as the web app, running in a small web page
// inside the app (a "DOM component", like the editor). It saves the shapes back to the page through
// onSave, with the same rules as the web: only real changes, a moment after you stop drawing.

import "@excalidraw/excalidraw/index.css";
import { useEffect, useMemo, useRef } from "react";
import type { DOMProps } from "expo/dom";
import { Excalidraw, MainMenu, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { BoardData } from "@dovli/core";

/** A cheap fingerprint so we only save when shapes really changed. */
function fingerprint(elements: readonly any[]) {
  let v = elements.length;
  for (const e of elements) v += e.version;
  return v;
}

export default function BoardDom({
  board,
  dark,
  readOnly,
  onSave,
}: {
  board: BoardData;
  dark: boolean;
  /** A whiteboard in the trash: look, don't change. */
  readOnly?: boolean;
  /** `quiet`: the template's outline turned into shapes on first open; not an edit. */
  onSave: (board: BoardData, quiet: boolean) => Promise<void>;
  dom?: DOMProps;
}) {
  const lastPrint = useRef<number | null>(null);
  useEffect(() => {
    for (const el of [document.documentElement, document.body]) {
      el.style.margin = "0";
      el.style.height = "100%";
      el.style.overscrollBehavior = "none";
      el.style.background = dark ? "#121212" : "#ffffff";
    }
  }, [dark]);
  const saveTimer = useRef<number | undefined>(undefined);
  const firstSaveQuiet = useRef(false);

  const initialData = useMemo(() => {
    let elements = board.elements ?? [];
    let converted = false;
    // A template's outline becomes real shapes the first time the board opens.
    if (!elements.length && board.skeleton?.length) {
      elements = convertToExcalidrawElements(board.skeleton as any, { regenerateIds: false }) as any[];
      converted = true;
    }
    lastPrint.current = converted ? null : fingerprint(elements);
    firstSaveQuiet.current = converted;
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
        viewModeEnabled: !!readOnly,
      },
    };
    // Only when the board first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }} className="dovli-board">
      <Excalidraw
        initialData={initialData as any}
        theme={dark ? "dark" : "light"}
        viewModeEnabled={!!readOnly}
        // Start with the whole board in view: a phone screen is narrower than most boards.
        excalidrawAPI={(api) => setTimeout(() => api.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.85, animate: false }), 60)}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: null, export: false, saveAsImage: false } }}
        onChange={(elements, _appState, files) => {
          if (readOnly) return;
          const print = fingerprint(elements);
          if (print === lastPrint.current) return;
          lastPrint.current = print;
          window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(() => {
            const live = elements.filter((e: any) => !e.isDeleted);
            const used = new Set(live.map((e: any) => e.fileId).filter(Boolean));
            const keptFiles = Object.fromEntries(Object.entries(files).filter(([id]) => used.has(id)));
            const quiet = firstSaveQuiet.current;
            firstSaveQuiet.current = false;
            void onSave({ elements: live as any[], files: keptFiles }, quiet).catch(() => {});
          }, 300);
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
    </div>
  );
}
