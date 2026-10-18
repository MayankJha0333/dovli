import { useState } from "react";
import { favoritePages, recentPages, templates } from "@dovli/core";
import { Button, EmptyState, Icon, toast, type IconName } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { ui } from "@/lib/ui";
import { Crumb, TopBar } from "@/components/TopBar";
import { PageCard, TemplateCard, cardGrid } from "@/features/home/cards";
import { newPage, useFromTemplate } from "@/features/pages/actions";

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function QuickAction({ icon, title, hint, onClick }: { icon: IconName; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3.5 rounded-lg bg-well px-4 py-3.5 text-left text-ink transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-panel hover:shadow-card"
    >
      <span className="grid size-10 flex-none place-items-center rounded-md bg-panel text-accent shadow-sm">
        <Icon name={icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="text-base font-semibold">{title}</span>
        <span className="truncate text-sm text-ink-3">{hint}</span>
      </span>
    </button>
  );
}

export function Section({ title, aside, children, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 id={id} className="m-0 text-md font-bold tracking-tight text-ink">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export const wide = "mx-auto flex max-w-[1080px] flex-col gap-11 px-7 pb-24 pt-12 max-[640px]:gap-9 max-[640px]:px-4 max-[640px]:pb-20 max-[640px]:pt-7";

export function Home() {
  const pages = useStore((s) => s.pages);
  const use = useFromTemplate();
  const recent = recentPages(pages, 8);
  const favorites = favoritePages(pages).slice(0, 4);
  const total = Object.values(pages).filter((p) => !p.deletedAt).length;
  const [confirmReset, setConfirmReset] = useState(false);
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex h-full flex-col">
      <TopBar
        crumbs={
          <Crumb current>
            <Icon name="home" size={14} className="text-ink-3" />
            Home
          </Crumb>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className={wide}>
          <header className="flex flex-col gap-1.5">
            <p className="m-0 text-sm font-medium text-ink-3">{date}</p>
            <h1 className="display-text m-0 text-[clamp(2.2rem,4.2vw,3rem)]">{greeting()}</h1>
          </header>

          <div className="-mt-4 grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[640px]:-mt-2 max-[640px]:grid-cols-1">
            <QuickAction icon="page" title="New page" hint="Start with a blank page" onClick={() => newPage("doc")} />
            <QuickAction icon="board" title="New whiteboard" hint="Shapes, arrows and sketches" onClick={() => newPage("board")} />
            <QuickAction icon="templates" title="Use a template" hint={`${templates.length} ready-made pages`} onClick={() => store.navigate({ name: "templates" })} />
            <QuickAction icon="importIcon" title="Import" hint="From Notion or Markdown" onClick={() => ui.set({ settings: "data" })} />
          </div>

          {favorites.length > 0 && (
            <Section title="Favourites" id="fav-title">
              <div className={cardGrid}>
                {favorites.map((p) => (
                  <PageCard key={p.id} page={p} />
                ))}
              </div>
            </Section>
          )}

          <Section title="Recent" id="recent-title" aside={<span className="text-sm tabular-nums text-ink-3">{total} pages</span>}>
            {recent.length === 0 ? (
              <EmptyState icon="page" title="No pages yet" action={<Button variant="primary" icon="plus" onClick={() => newPage()}>New page</Button>}>
                Create one, or start from a template.
              </EmptyState>
            ) : (
              <div className={cardGrid}>
                {recent.map((p) => (
                  <PageCard key={p.id} page={p} />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Start from a template"
            id="tpl-title"
            aside={
              <Button variant="link" size="sm" className="ml-auto" onClick={() => store.navigate({ name: "templates" })}>
                See all
              </Button>
            }
          >
            <div className={cardGrid}>
              {["meeting", "brief", "journal", "userflow"].map((id) => {
                const t = templates.find((x) => x.id === id);
                return t ? <TemplateCard key={id} t={t} onUse={use} /> : null;
              })}
            </div>
          </Section>

          <footer className="border-t border-line pt-4">
            {confirmReset ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1.5 text-sm text-ink-2">Bring back the sample pages? Your own pages move to the trash.</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    store.resetWorkspace();
                    setConfirmReset(false);
                    toast("Sample pages restored. Your pages are in the trash for 30 days.");
                  }}
                >
                  Replace
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="-ml-2.5 text-ink-3" onClick={() => setConfirmReset(true)}>
                Restore sample pages
              </Button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
