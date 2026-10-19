// Page-level AI actions from the page menu and the Info panel. They all open the assistant drawer
// beside the page (there is no separate AI pop-up any more), so every answer lands in one place,
// with changes to check, apply and undo.

import { pageText, type Page } from "@dovli/core";
import { toast } from "@dovli/ui";
import { assistant } from "@/lib/assistant";
import type { ReviewFocus } from "@/lib/assistantCore";
import { store } from "@/lib/store";

export type { ReviewFocus } from "@/lib/assistantCore";

/** Make sure the page is the one on screen, then run `then` once it is. */
function onPage(page: Page, then: () => void) {
  const route = store.get().route;
  if (route.name !== "page" || route.id !== page.id) store.navigate({ name: "page", id: page.id });
  requestAnimationFrame(then);
}

/** Summarise a page: the assistant suggests a short summary at the top, to apply or not. */
export function summarizePage(page: Page) {
  if (!pageText(page).trim()) return toast("This page has no text to summarise yet.");
  onPage(page, () => assistant.ask("Summarise this page in a short callout at the top: two or three plain sentences, then the key points as a list."));
}

/** Review a page: the assistant lists what to fix first, with fixes to pick and apply. */
export function reviewPage(page: Page, focus: ReviewFocus = "full") {
  onPage(page, () => assistant.review(focus));
}
