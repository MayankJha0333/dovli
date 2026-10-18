import { useState } from "react";
import { daysLeftInTrash, descendantIds, displayTitle, TRASH_DAYS, trashRoots, type Page } from "@dovli/core";
import { Button, EmptyState, Icon, toast } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { Crumb, TopBar } from "@/components/TopBar";
import { wide } from "@/features/home/Home";

function TrashRow({ page }: { page: Page }) {
  const pages = useStore((s) => s.pages);
  const inside = descendantIds(pages, page.id).length;
  const days = daysLeftInTrash(page);
  return (
    <li className="flex items-center gap-3 rounded-lg bg-well px-4 py-3 max-[640px]:flex-wrap">
      <span className="grid size-9 flex-none place-items-center rounded-sm bg-panel font-serif text-lg text-ink-3 shadow-sm">{page.mark}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-ink">{displayTitle(page)}</span>
        <span className="text-xs text-ink-3">
          {inside ? `${inside} page${inside > 1 ? "s" : ""} inside · ` : ""}
          {days === 0 ? "Deleted for good today" : `Deleted for good in ${days} day${days > 1 ? "s" : ""}`}
        </span>
      </span>
      <Button
        size="sm"
        icon="restore"
        onClick={() => {
          store.restorePages([page.id]);
          toast(`Restored “${displayTitle(page)}”`, { action: { label: "Open", onClick: () => store.navigate({ name: "page", id: page.id }) } });
        }}
      >
        Restore
      </Button>
      <Button size="sm" variant="dangerGhost" onClick={() => store.deleteForever([page.id])}>
        Delete forever
      </Button>
    </li>
  );
}

export function TrashView() {
  const pages = useStore((s) => s.pages);
  const roots = trashRoots(pages);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <TopBar
        crumbs={
          <Crumb current>
            <Icon name="trash" size={14} className="text-ink-3" />
            Trash
          </Crumb>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className={wide}>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h1 className="display-text m-0 text-[clamp(2.2rem,4.2vw,3rem)]">Trash</h1>
              <p className="m-0 max-w-[56ch] text-md text-ink-2">Deleted pages wait here for {TRASH_DAYS} days, then go for good. Restore one to put it back where it was.</p>
            </div>
            {roots.length > 0 &&
              (confirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-2">Delete everything here for good?</span>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      store.emptyTrash();
                      setConfirm(false);
                      toast("Trash emptied");
                    }}
                  >
                    Empty trash
                  </Button>
                </div>
              ) : (
                <Button variant="dangerGhost" icon="trash" onClick={() => setConfirm(true)}>
                  Empty trash
                </Button>
              ))}
          </header>
          {roots.length ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {roots.map((p) => (
                <TrashRow key={p.id} page={p} />
              ))}
            </ul>
          ) : (
            <EmptyState icon="trash" title="The trash is empty">
              Pages you delete show up here, so you can change your mind.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
