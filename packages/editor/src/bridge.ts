import type { Page, PageKind } from "@dovli/core";

/** What the AI panel needs to act on a piece of the page. */
export interface AISelection {
  /** The selected text (or the whole page for a summary). */
  text: string;
  /** Replace the selection with new text. */
  replace: (text: string) => void;
  /** Add new text right after the selection. */
  insertAfter: (text: string) => void;
}

/**
 * The editor does not own any data. The app that shows it (the Next.js web app, the shared-page
 * viewer, the phone app's web view) plugs its own store in here, once, before the editor renders.
 */
export interface EditorBridge {
  /** React hook: read from the app's pages and re-render when they change. */
  usePages<T>(select: (pages: Record<string, Page>) => T): T;
  /** Read every page right now, without subscribing (used when a menu opens). */
  getPages(): Record<string, Page>;
  /** Open another page, e.g. when a sub-page card or a [[page link]] is clicked. */
  openPage(id: string): void;
  /** Make a new page inside `parentId` (or at the top level) and return it. */
  createPage(input: { parentId: string | null; kind: PageKind; title?: string }): Page;
  /** Save the document after an edit. */
  saveBlocks(pageId: string, blocks: any[]): void;
  /** Keep a file (image, PDF…) and return the address to store in the page. */
  uploadFile?(file: File): Promise<string>;
  /** Turn a stored address into one the browser can show. */
  resolveFileUrl?(url: string): Promise<string>;
  /** Ask the person which page to move blocks to. Resolves to a page id, or null if they cancel. */
  pickPage?(opts: { title: string; exclude: string }): Promise<string | null>;
  /** Append blocks to the end of another page. */
  appendBlocks?(pageId: string, blocks: any[]): void;
  /** Open the AI panel for a selection. Missing when AI is not available. */
  openAI?(selection: AISelection): void;
  /** Open the page list for a #tag. */
  openTag?(tag: string): void;
  /** Show a short message. */
  notify?(message: string): void;
}

let current: EditorBridge | null = null;

export function connectEditor(bridge: EditorBridge) {
  current = bridge;
}

export function useBridge(): EditorBridge {
  if (!current) throw new Error("Call connectEditor() before rendering the Dovli editor.");
  return current;
}

/** The bridge outside React (for conversions). May be null before the app connects it. */
export function getBridge(): EditorBridge | null {
  return current;
}
