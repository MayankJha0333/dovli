// Moving out of the top of the page into the title, the way people expect from a document:
// Backspace, ← or ↑ at the very start of the first block goes to the title. Without this,
// Backspace at the start of a heading turns it into plain text, which feels like a bug there.

import { SuggestionMenu } from "@blocknote/core/extensions";
import type { ResolvedPos } from "prosemirror-model";
import type { DovliEditor } from "./schema";

/**
 * Where the cursor really is. This runs before the editor's own key handling, and right after
 * Home or a click the editor may not have caught up with the cursor yet, so read it from the page.
 */
function cursor(editor: DovliEditor): ResolvedPos | null {
  const view = editor.prosemirrorView;
  if (!view) return null;
  const sel = (view.root as Document).getSelection?.();
  if (sel && sel.rangeCount && sel.isCollapsed && sel.anchorNode && view.dom.contains(sel.anchorNode)) {
    try {
      return view.state.doc.resolve(view.posAtDOM(sel.anchorNode, sel.anchorOffset));
    } catch {
      /* fall back to the editor's own idea of the cursor */
    }
  }
  return view.state.selection.empty ? view.state.selection.$from : null;
}

/** True when the cursor is in the first text block of the page. `atStart`: also at its first character. */
function inFirstBlock(editor: DovliEditor, atStart: boolean): boolean {
  const $from = cursor(editor);
  if (!$from || !$from.parent.isTextblock) return false;
  let first: number | undefined;
  $from.doc.descendants((node, pos) => {
    if (first !== undefined) return false;
    if (node.isTextblock) {
      first = pos;
      return false;
    }
    return true;
  });
  if (first === undefined || $from.before() !== first) return false;
  return !atStart || $from.parentOffset === 0;
}

/** Handle a key press inside the editor. Returns true when it moved the cursor to the title. */
export function handleTopEdgeKey(editor: DovliEditor, e: KeyboardEvent | React.KeyboardEvent, exitTop: () => void): boolean {
  if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return false;
  // An open "/", "[[" or emoji menu uses the arrow keys itself. Ask the editor rather than the
  // page: a menu that was just closed stays on screen for a moment while it fades out.
  if (editor.getExtension(SuggestionMenu)?.shown()) return false;
  const go =
    ((e.key === "Backspace" || e.key === "ArrowLeft") && inFirstBlock(editor, true)) ||
    (e.key === "ArrowUp" && inFirstBlock(editor, false) && !!editor.prosemirrorView?.endOfTextblock("up"));
  if (!go) return false;
  e.preventDefault();
  e.stopPropagation();
  exitTop();
  return true;
}
