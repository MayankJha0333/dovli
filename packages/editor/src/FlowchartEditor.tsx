import { useMemo, useRef } from "react";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Button } from "@dovli/ui";
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
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-bg pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] text-ink"
      role="dialog"
      aria-modal="true"
      aria-label="Edit flowchart"
    >
      <header className="flex h-14 flex-none items-center gap-3 border-b border-line pl-[max(18px,env(safe-area-inset-left,0px))] pr-[max(12px,env(safe-area-inset-right,0px))]">
        <span className="display-text text-xl">Edit flowchart</span>
        <span className="hidden text-sm text-ink-3 sm:inline">Changes appear in the page when you click Done</span>
        <Button variant="primary" className="ml-auto" onClick={done}>
          Done
        </Button>
      </header>
      <div className="dovli-canvas relative min-h-0 flex-1">
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
