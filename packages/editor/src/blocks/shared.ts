import type { KeyboardEvent } from "react";

/** App-wide shortcuts that must still work while typing inside a block's own fields. */
const APP_SHORTCUTS = new Set(["k", "f", ",", "\\"]);

/**
 * Inputs inside a block (table cells, link fields) must keep their keys: without this, the editor
 * would treat Enter, Backspace, arrows or ⌘Z as editing the document around them.
 * App shortcuts (⌘K, ⌘F, ⌘, and ⌘\) are let through.
 */
export function stopEditorKeys(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && APP_SHORTCUTS.has(e.key.toLowerCase())) return;
  e.stopPropagation();
}

/** Run a function at most once per `ms`, using the latest arguments. */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const run = (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  return run;
}
