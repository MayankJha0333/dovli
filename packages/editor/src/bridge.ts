import type { Page, PageKind } from "@dovli/core";

/**
 * The editor does not own any data. The app that shows it (the Next.js web app today, the phone
 * app's web view later) plugs its own store in here, once, before the editor renders.
 */
export interface EditorBridge {
  /** React hook: read from the app's pages and re-render when they change. */
  usePages<T>(select: (pages: Record<string, Page>) => T): T;
  /** Open another page, e.g. when a sub-page link is clicked. */
  openPage(id: string): void;
  /** Make a new page inside `parentId` and return it. */
  createPage(input: { parentId: string; kind: PageKind }): Page;
  /** Save the document after an edit. */
  saveBlocks(pageId: string, blocks: any[]): void;
}

let current: EditorBridge | null = null;

export function connectEditor(bridge: EditorBridge) {
  current = bridge;
}

export function useBridge(): EditorBridge {
  if (!current) throw new Error("Call connectEditor() before rendering the Dovli editor.");
  return current;
}
