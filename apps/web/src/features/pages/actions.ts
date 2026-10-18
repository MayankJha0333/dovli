import { useCallback } from "react";
import { displayTitle, type Page, type Template } from "@dovli/core";
import { toast } from "@dovli/ui";
import { store } from "@/lib/store";
import { requestTitleFocus, ui } from "@/lib/ui";

/* ------------------------------------------------------------------ */
/* Page actions shared by the sidebar, page menu, palette and home      */
/* ------------------------------------------------------------------ */

export function newPage(kind: "doc" | "board" = "doc", parentId: string | null = null) {
  const page = store.createPage({ kind, parentId });
  if (kind === "doc") requestTitleFocus(page.id);
  store.navigate({ name: "page", id: page.id });
  return page;
}

export function useFromTemplate() {
  return useCallback((t: Template, parentId: string | null = null) => {
    const built = t.build();
    const page = store.createPage({ parentId, kind: t.kind, mark: t.mark, ...built });
    store.navigate({ name: "page", id: page.id });
    toast(`Created from the ${t.name} template`);
  }, []);
}

/** Move a page to the trash, with an Undo button in the toast. */
export function trashWithUndo(page: Page) {
  const ids = store.trashPage(page.id);
  if (!ids.length) return;
  const n = ids.length - 1;
  toast(n ? `Moved “${displayTitle(page)}” and ${n} page${n > 1 ? "s" : ""} inside to the trash` : `Moved “${displayTitle(page)}” to the trash`, {
    action: { label: "Undo", onClick: () => store.restorePages([page.id]) },
  });
}

export function duplicate(page: Page) {
  const copy = store.duplicatePage(page.id);
  if (copy) {
    store.navigate({ name: "page", id: copy.id });
    toast("Page duplicated");
  }
}

export async function moveWithPicker(page: Page) {
  const to = await ui.pickPage(`Move “${displayTitle(page)}” to…`, page.id);
  if (to === null) return;
  store.movePage(page.id, to === "__root__" ? null : to);
  toast(to === "__root__" ? "Moved to the top level" : `Moved into “${displayTitle(store.get().pages[to])}”`);
}

export async function copyLink(page: Page) {
  try {
    await navigator.clipboard.writeText(`${location.origin}${location.pathname}#p-${page.id}`);
    toast("Link copied. It opens this page for anyone signed in to your account.");
  } catch {
    toast("Couldn't reach the clipboard.", { tone: "danger" });
  }
}
