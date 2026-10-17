// The phone app's workspace store. For now it keeps pages in memory, starting from the same
// sample pages as the web app. Syncing with the web app (Supabase) comes next.
import { useSyncExternalStore } from "react";
import { seedPages, type Page } from "@dovli/core";

let pages: Record<string, Page> = seedPages();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getPages: () => pages,
  createPage(): Page {
    const now = Date.now();
    const page: Page = {
      id: Math.random().toString(36).slice(2, 12),
      parentId: null,
      kind: "doc",
      title: "",
      mark: "¶",
      blocks: [],
      createdAt: now,
      updatedAt: now,
      order: Object.keys(pages).length,
    };
    pages = { ...pages, [page.id]: page };
    emit();
    return page;
  },
};

export function usePages<T>(select: (pages: Record<string, Page>) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(pages));
}
