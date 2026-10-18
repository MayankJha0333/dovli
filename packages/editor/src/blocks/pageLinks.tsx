import { createReactBlockSpec, createReactInlineContentSpec } from "@blocknote/react";
import { childrenOf, displayTitle } from "@dovli/core";
import { Icon } from "@dovli/ui";
import { useBridge } from "../bridge";

/* ------------------------------------------------------------------ */
/* Sub-page card: a page inside this page, shown as a row you can open  */
/* ------------------------------------------------------------------ */

function SubpageCard({ pageId }: { pageId: string }) {
  const bridge = useBridge();
  const page = bridge.usePages((pages) => pages[pageId]);
  const childCount = bridge.usePages((pages) => (page ? childrenOf(pages, page.id).length : 0));
  const base =
    "my-0.5 flex w-full items-center gap-3 rounded-md py-2.5 pl-2.5 pr-3 text-left font-sans leading-tight text-ink transition-[box-shadow,transform] duration-150";
  if (!page || page.deletedAt) {
    return (
      <div className={`${base} cursor-default text-ink-3 shadow-[inset_0_0_0_1px_var(--d-line)]`} contentEditable={false}>
        <span className="grid size-9 flex-none place-items-center rounded-sm bg-well text-ink-3">×</span>
        <span className="text-md font-semibold">{page ? "This page is in the trash" : "This page was deleted"}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${base} bg-panel shadow-sm hover:-translate-y-px hover:shadow-card`}
      contentEditable={false}
      onClick={() => bridge.openPage(page.id)}
    >
      <span className="grid size-9 flex-none place-items-center rounded-sm bg-accent-soft font-serif text-lg text-accent">{page.mark}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-md font-semibold">{displayTitle(page)}</span>
        <span className="text-xs text-ink-3">
          {page.kind === "board" ? "Whiteboard" : childCount ? `${childCount} page${childCount > 1 ? "s" : ""} inside` : "Page"}
        </span>
      </span>
      <Icon name="chevron" size={14} className="text-ink-3" />
    </button>
  );
}

export const subpageBlock = createReactBlockSpec(
  { type: "subpage", propSchema: { pageId: { default: "" } }, content: "none" },
  {
    render: ({ block }) => <SubpageCard pageId={block.props.pageId} />,
    toExternalHTML: ({ block }) => <SubpageExport pageId={block.props.pageId} />,
  },
);

function SubpageExport({ pageId }: { pageId: string }) {
  const bridge = useBridge();
  const page = bridge.usePages((pages) => pages[pageId]);
  return (
    <p>
      <a href={`#p-${pageId}`}>{page ? displayTitle(page) : "Page"}</a>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* [[Page link]]: a link to any page, written inside a sentence          */
/* ------------------------------------------------------------------ */

function PageLinkChip({ pageId, fallback }: { pageId: string; fallback: string }) {
  const bridge = useBridge();
  const page = bridge.usePages((pages) => pages[pageId]);
  const gone = !page || !!page.deletedAt;
  return (
    <button
      type="button"
      contentEditable={false}
      data-page-link={pageId}
      onClick={() => !gone && bridge.openPage(pageId)}
      className={
        gone
          ? "mx-px inline cursor-default rounded-xs px-1 text-ink-4 line-through decoration-1"
          : "mx-px inline cursor-pointer rounded-xs bg-accent-soft px-1 font-medium text-accent underline decoration-accent/30 underline-offset-[3px] hover:decoration-accent"
      }
    >
      <span aria-hidden="true" className="mr-0.5 font-serif text-[0.9em] opacity-80">
        {page?.mark ?? "¶"}
      </span>
      {page ? displayTitle(page) : fallback || "Missing page"}
    </button>
  );
}

export const pageLinkInline = createReactInlineContentSpec(
  {
    type: "pageLink",
    propSchema: { pageId: { default: "" }, title: { default: "" } },
    content: "none",
  },
  {
    render: ({ inlineContent }) => <PageLinkChip pageId={inlineContent.props.pageId} fallback={inlineContent.props.title} />,
    toExternalHTML: ({ inlineContent }) => <a href={`#p-${inlineContent.props.pageId}`}>{inlineContent.props.title || "Page"}</a>,
  },
);
