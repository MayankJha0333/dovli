import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { displayTitle, childrenOf } from "@dovli/core";
import { useBridge } from "./bridge";
import { embedBlock, flowchartBlock } from "./embeds";

/** A link to another page, shown as a quiet row in the document. */
function SubpageLink({ pageId }: { pageId: string }) {
  const bridge = useBridge();
  const page = bridge.usePages((pages) => pages[pageId]);
  const childCount = bridge.usePages((pages) => (page ? childrenOf(pages, page.id).length : 0));
  if (!page) {
    return (
      <div className="subpage subpage--missing" contentEditable={false}>
        <span className="subpage__mark">×</span>
        <span className="subpage__text">
          <span className="subpage__title">This page was deleted</span>
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="subpage"
      contentEditable={false}
      onClick={() => bridge.openPage(page.id)}
    >
      <span className="subpage__mark">{page.mark}</span>
      <span className="subpage__text">
        <span className="subpage__title">{displayTitle(page)}</span>
        <span className="subpage__meta">
          {page.kind === "board" ? "Whiteboard" : childCount ? `${childCount} page${childCount > 1 ? "s" : ""} inside` : "Page"}
        </span>
      </span>
      <svg className="subpage__go" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 3.6 4.4 4.4L6 12.4" />
      </svg>
    </button>
  );
}

export const subpageBlock = createReactBlockSpec(
  {
    type: "subpage",
    propSchema: { pageId: { default: "" } },
    content: "none",
  },
  {
    render: ({ block }) => <SubpageLink pageId={block.props.pageId} />,
  },
);

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    subpage: subpageBlock(),
    embed: embedBlock(),
    flowchart: flowchartBlock(),
  },
});

export type DovliEditor = typeof schema.BlockNoteEditor;
