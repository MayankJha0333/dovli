import { useCallback } from "react";
import { store } from "@/lib/store";
import type { Template } from "@dovli/core";
import { toast } from "@/components/Toasts";

/* ------------------------------------------------------------------ */
/* Actions shared by several views                                     */
/* ------------------------------------------------------------------ */

export function newPage(kind: "doc" | "board" = "doc", parentId: string | null = null) {
  const page = store.createPage({ kind, parentId });
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
