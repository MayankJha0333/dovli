// Where a dragged block lands. ProseMirror picks "before" or "after" a block from the letter under
// the pointer, so on a short line ("Alpha") pointing to the right of the word means "after" even
// on the top half. People expect top half = above, bottom half = below. While a block is being
// dragged, this points the editor's position lookup at the start of the block (top half) or its
// end (bottom half). The drop line and the drop itself both use that lookup, so they agree.

import type { DovliEditor } from "./schema";

type Coords = { left: number; top: number };

export function fixBlockDropPosition(editor: DovliEditor): () => void {
  let view: any;
  try {
    view = editor.prosemirrorView;
  } catch {
    return () => {};
  }
  if (!view || view.__dovliDropFix) return () => {};
  const original = view.posAtCoords.bind(view);
  view.__dovliDropFix = true;
  view.posAtCoords = (coords: Coords) => {
    if (!view.dragging) return original(coords);
    // The innermost block under the pointer's height, searched across the middle of the page.
    const root: HTMLElement = view.dom;
    const box = root.getBoundingClientRect();
    const hits = document.elementsFromPoint(box.left + box.width / 2, coords.top);
    const block = hits.map((el) => el.closest(".bn-block-outer")).find((el): el is HTMLElement => !!el && root.contains(el));
    const text = block?.querySelector<HTMLElement>(":scope > .bn-block > .bn-block-content .bn-inline-content");
    if (!block || !text) return original(coords);
    const r = block.getBoundingClientRect();
    const t = text.getBoundingClientRect();
    const upper = coords.top < r.top + r.height / 2;
    return original(upper ? { left: t.left + 1, top: t.top + 2 } : { left: t.right - 1, top: t.bottom - 2 });
  };
  return () => {
    view.posAtCoords = original;
    delete view.__dovliDropFix;
  };
}
