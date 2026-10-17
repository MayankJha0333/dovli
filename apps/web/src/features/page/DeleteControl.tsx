import { useEffect, useRef, useState } from "react";
import { store, useStore } from "@/lib/store";
import { descendantIds, type Page } from "@dovli/core";
import { toast } from "@/components/Toasts";
import { ToolButton } from "@/components/TopBar";

export function collectLinked(blocks: any[] | undefined, out = new Set<string>()) {
  for (const b of blocks ?? []) {
    if (b.type === "subpage" && b.props?.pageId) out.add(b.props.pageId);
    if (b.children?.length) collectLinked(b.children, out);
  }
  return out;
}

export function DeleteControl({ page }: { page: Page }) {
  const pages = useStore((s) => s.pages);
  const [asking, setAsking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inside = descendantIds(pages, page.id).length;
  useEffect(() => {
    if (!asking) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAsking(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [asking]);
  return (
    <div className="popover-anchor" ref={ref}>
      <ToolButton icon="trash" label="Delete page" onClick={() => setAsking((a) => !a)} />
      {asking && (
        <div className="popover" role="dialog" aria-label="Delete page">
          <p className="popover__title">Delete this page?</p>
          <p className="popover__text">
            {inside ? `The ${inside} ${inside === 1 ? "page" : "pages"} inside it will be deleted too. ` : ""}This can't be undone.
          </p>
          <div className="popover__actions">
            <button type="button" className="btn btn--quiet" onClick={() => setAsking(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                store.deletePage(page.id);
                toast("Page deleted");
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
