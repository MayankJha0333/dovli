import { useMemo } from "react";
import { pagesWithTag, tagIndex } from "@dovli/core";
import { Button, EmptyState, Icon, cn } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { Crumb, CrumbSep, TopBar } from "@/components/TopBar";
import { PageCard, cardGrid } from "@/features/home/cards";
import { wide } from "@/features/home/Home";

/** Every page that uses a #tag. Nested tags (#ideas/books) also show under their parent (#ideas). */
export function TagView({ tag }: { tag: string }) {
  const pages = useStore((s) => s.pages);
  const list = useMemo(() => pagesWithTag(pages, tag), [pages, tag]);
  const all = useMemo(() => tagIndex(pages), [pages]);
  const children = all.filter((t) => t.tag.startsWith(`${tag}/`));
  return (
    <div className="flex h-full flex-col">
      <TopBar
        crumbs={
          <>
            <Crumb onClick={() => store.navigate({ name: "home" })}>Tags</Crumb>
            <CrumbSep />
            <Crumb current>
              <Icon name="hash" size={13} className="text-accent" />
              {tag}
            </Crumb>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className={wide}>
          <header className="flex flex-col gap-3">
            <h1 className="display-text m-0 text-[clamp(2.2rem,4.2vw,3rem)]">
              <span className="text-accent">#</span>
              {tag}
            </h1>
            <p className="m-0 text-md text-ink-2">
              {list.length} page{list.length === 1 ? "" : "s"}. Type #{tag} anywhere in a page to add it here.
            </p>
            {children.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {children.map((c) => (
                  <button
                    key={c.tag}
                    type="button"
                    onClick={() => store.navigate({ name: "tag", tag: c.tag })}
                    className={cn("h-7 rounded-full bg-accent-soft px-3 text-sm font-medium text-accent hover:brightness-95")}
                  >
                    #{c.tag} <span className="tabular-nums opacity-70">{c.pages.length}</span>
                  </button>
                ))}
              </div>
            )}
          </header>
          {list.length ? (
            <div className={cardGrid}>
              {list.map((p) => (
                <PageCard key={p.id} page={p} />
              ))}
            </div>
          ) : (
            <EmptyState icon="hash" title={`No pages use #${tag} yet`} action={<Button onClick={() => store.navigate({ name: "home" })}>Go home</Button>} />
          )}
        </div>
      </div>
    </div>
  );
}
