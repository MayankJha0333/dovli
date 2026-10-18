import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from "@blocknote/core";
import { calloutBlock } from "./blocks/callout";
import { dataTableBlock } from "./blocks/dataTable";
import { embedBlock, flowchartBlock } from "./blocks/embeds";
import { pageLinkInline, subpageBlock } from "./blocks/pageLinks";
import { pdfBlock } from "./blocks/pdf";

/** Every block Dovli understands: BlockNote's own, plus Dovli's. */
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    subpage: subpageBlock(),
    embed: embedBlock(),
    flowchart: flowchartBlock(),
    callout: calloutBlock(),
    dataTable: dataTableBlock(),
    pdf: pdfBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    pageLink: pageLinkInline,
  },
});

export type DovliEditor = typeof schema.BlockNoteEditor;
