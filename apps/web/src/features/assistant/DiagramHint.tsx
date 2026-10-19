// Spotting diagrams drawn with text (arrows, lines and boxes typed out, or Mermaid code) and
// offering to make them real flowcharts. Mermaid is drawn at once; a text drawing goes to the
// assistant, which redraws it. "Not now" hides the offer for that block on this device.

import { useEffect, useMemo, useState } from "react";
import type { Page } from "@dovli/core";
import { Button, Icon, IconButton, toast } from "@dovli/ui";
import { assistant, dismissDiagram, dismissedDiagrams } from "@/lib/assistant";
import { findTextDiagrams, type TextDiagram } from "@/lib/assistantCore";

/** The first diagram drawn as text in this page that the person hasn't said no to. */
export function useTextDiagram(page: Page | undefined): TextDiagram | null {
  const [dismissed, setDismissed] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : dismissedDiagrams()));
  useEffect(() => {
    const refresh = () => setDismissed(dismissedDiagrams());
    window.addEventListener("dovli:diagram-hints", refresh);
    return () => window.removeEventListener("dovli:diagram-hints", refresh);
  }, []);
  const blocks = page?.kind === "doc" && !page.deletedAt ? page.blocks : undefined;
  return useMemo(() => findTextDiagrams(blocks).find((d) => !dismissed.has(d.id)) ?? null, [blocks, dismissed]);
}

/** Make it a flowchart: Mermaid straight away, a text drawing through the assistant. */
export function drawDiagram(d: TextDiagram) {
  if (assistant.drawDiagram(d)) toast("Drawn as a flowchart. Press ⌘Z to undo.");
}

/** The offer, as a small card. `compact` is the one-line version inside the assistant panel. */
export function DiagramHint({ diagram, compact = false }: { diagram: TextDiagram; compact?: boolean }) {
  const mermaid = diagram.kind === "mermaid";
  return (
    <div
      role="status"
      className={
        compact
          ? "mx-2 mt-2 flex items-center gap-2 rounded-[10px] bg-accent-soft py-1.5 pl-2.5 pr-1"
          : "pointer-events-auto flex w-[300px] max-w-[calc(100vw-32px)] items-start gap-2.5 rounded-[14px] p-3 shadow-pop surface-raised animate-pop-in"
      }
    >
      <span className={compact ? "text-accent" : "mt-0.5 grid size-7 flex-none place-items-center rounded-[9px] bg-accent-soft text-accent"}>
        <Icon name="board" size={compact ? 13 : 15} />
      </span>
      {compact ? (
        <>
          <span className="flex-1 text-xs font-medium text-ink-2">{mermaid ? "Mermaid code in this page" : "A diagram drawn with text"}</span>
          <button type="button" onClick={() => drawDiagram(diagram)} className="h-6 rounded-full bg-panel px-2.5 text-xs font-semibold text-accent shadow-sm hover:brightness-95">
            Make it a flowchart
          </button>
        </>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="m-0 text-sm font-semibold text-ink">{mermaid ? "Draw this Mermaid code?" : "Make this a real flowchart?"}</p>
            <p className="m-0 mt-0.5 text-xs text-ink-3">
              {mermaid ? "It becomes a flowchart you can see and edit, right where the code is." : "This page has a diagram drawn with text. The assistant can redraw it as a flowchart you can edit."}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="accent" icon="board" onClick={() => drawDiagram(diagram)}>
              Make it a flowchart
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dismissDiagram(diagram.id)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      <IconButton icon="close" label="Not now" size="xs" onClick={() => dismissDiagram(diagram.id)} className={compact ? "" : "-mr-1 -mt-1"} />
    </div>
  );
}
