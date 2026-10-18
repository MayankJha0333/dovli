import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultStyleSpecs } from "@blocknote/core";
import { calloutBlock } from "./blocks/callout";
import { dataTableBlock } from "./blocks/dataTable";
import { embedBlock, flowchartBlock } from "./blocks/embeds";
import { pageLinkInline, subpageBlock } from "./blocks/pageLinks";
import { pdfBlock } from "./blocks/pdf";
import { captionBlock, fontStyle } from "./blocks/textStyles";

/**
 * BlockNote's to-do, with a name for its checkbox: the line's own text (aria-labelledby), so a
 * screen reader says "Buy milk, checkbox" and the name follows the text as it's edited. An empty
 * line falls back to "To-do".
 */
const baseCheckList = defaultBlockSpecs.checkListItem;
const baseRender = baseCheckList.implementation.render as (this: unknown, ...args: any[]) => { dom: Node; contentDOM?: HTMLElement };
const checkListItem = {
  ...baseCheckList,
  implementation: {
    ...baseCheckList.implementation,
    render(this: unknown, ...args: any[]) {
      const out = baseRender.apply(this, args);
      const box = (out.dom as ParentNode).querySelector?.('input[type="checkbox"]');
      if (box && out.contentDOM) {
        out.contentDOM.id = `todo-${args[0].id}`;
        box.setAttribute("aria-labelledby", out.contentDOM.id);
        box.setAttribute("aria-label", "To-do"); // used while the line is still empty
      }
      return out;
    },
  },
} as typeof defaultBlockSpecs.checkListItem;

/** Every block Dovli understands: BlockNote's own, plus Dovli's. */
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    checkListItem,
    subpage: subpageBlock(),
    embed: embedBlock(),
    flowchart: flowchartBlock(),
    callout: calloutBlock(),
    dataTable: dataTableBlock(),
    pdf: pdfBlock(),
    caption: captionBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    pageLink: pageLinkInline,
  },
  styleSpecs: {
    ...defaultStyleSpecs,
    font: fontStyle,
  },
});

export type DovliEditor = typeof schema.BlockNoteEditor;
