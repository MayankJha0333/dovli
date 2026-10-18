import { BlockNoteEditor } from "@blocknote/core";
import { schema } from "./schema";

// Turning pages into Markdown or HTML (export) and back (import), without showing an editor.
// Browser only: it renders Dovli's custom blocks with React to get their HTML.

let headless: BlockNoteEditor<any, any, any> | null = null;

function editor() {
  if (!headless) headless = BlockNoteEditor.create({ schema }) as BlockNoteEditor<any, any, any>;
  return headless;
}

export function blocksToMarkdown(blocks: any[]): string {
  if (!blocks?.length) return "";
  return editor().blocksToMarkdownLossy(blocks);
}

/** HTML that keeps Dovli's look when opened on its own (lists, tables, callouts…). */
export function blocksToHTML(blocks: any[]): string {
  if (!blocks?.length) return "";
  return editor().blocksToHTMLLossy(blocks);
}

export function markdownToBlocks(markdown: string): any[] {
  return editor().tryParseMarkdownToBlocks(markdown);
}

export function htmlToBlocks(html: string): any[] {
  return editor().tryParseHTMLToBlocks(html);
}
