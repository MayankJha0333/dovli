import { useMemo, useRef } from "react";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { parseScene } from "./excalidrawKit";
import { useIsDark } from "./useIsDark";

/** Full-screen editor for one flowchart block. Calls onDone with the new scene as JSON. */
export default function FlowchartEditor({ scene, onDone }: { scene: string; onDone: (json: string) => void }) {
  const dark = useIsDark();
  const latest = useRef<{ elements: readonly any[]; files: Record<string, any> } | null>(null);
  const initial = useMemo(() => parseScene(scene), [scene]);

  const done = () => {
    if (!latest.current) return onDone(scene);
    const live = latest.current.elements.filter((e: any) => !e.isDeleted);
    const used = new Set(live.map((e: any) => e.fileId).filter(Boolean));
    const files = Object.fromEntries(Object.entries(latest.current.files).filter(([id]) => used.has(id)));
    onDone(JSON.stringify({ elements: live, files }));
  };

  return (
    <div className="flow-modal" role="dialog" aria-modal="true" aria-label="Edit flowchart">
      <header className="flow-modal__bar">
        <span className="flow-modal__title">Edit flowchart</span>
        <span className="flow-modal__hint hide-sm">Changes appear in the page when you click Done</span>
        <button type="button" className="btn btn--primary" onClick={done}>
          Done
        </button>
      </header>
      <div className="flow-modal__canvas">
        <Excalidraw
          initialData={{
            elements: initial.elements,
            files: initial.files,
            scrollToContent: true,
            appState: {
              viewBackgroundColor: "transparent",
              currentItemRoughness: 0,
              currentItemFontFamily: 6,
              currentItemStrokeWidth: 1,
              currentItemEndArrowhead: "triangle",
            } as any,
          }}
          theme={dark ? "dark" : "light"}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: null, export: false } }}
          onChange={(elements, _app, files) => {
            latest.current = { elements, files };
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.Help />
          </MainMenu>
        </Excalidraw>
      </div>
    </div>
  );
}
