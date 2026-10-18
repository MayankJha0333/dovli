// A small accessibility repair for markup BlockNote draws itself: it marks the page text with
// aria-expanded while the "/" menu is open, which isn't allowed on a text box (the menu is still
// announced through aria-activedescendant). Only the editor's outer element is touched: the
// editor ignores attribute changes there, while changes inside its blocks would make it redraw them.

import type { DovliEditor } from "./schema";

/** Keep aria-expanded off the editor element. Returns a function that stops. */
export function repairEditorA11y(editor: DovliEditor): () => void {
  const root = editor.domElement as HTMLElement | undefined;
  if (!root) return () => {};
  const clean = () => root.hasAttribute("aria-expanded") && root.removeAttribute("aria-expanded");
  clean();
  const watch = new MutationObserver(clean);
  watch.observe(root, { attributes: true, attributeFilter: ["aria-expanded"] });
  return () => watch.disconnect();
}
