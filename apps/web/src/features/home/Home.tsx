import { useState } from "react";
import { store, useStore } from "@/lib/store";
import { templates } from "@dovli/core";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toasts";
import { TopBar } from "@/components/TopBar";
import { PageCard, TemplateCard } from "@/features/home/cards";
import { newPage, useFromTemplate } from "@/features/pages/actions";

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function QuickAction({ icon, title, hint, onClick }: { icon: string; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="quick" onClick={onClick}>
      <span className="quick__icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="quick__text">
        <span className="quick__title">{title}</span>
        <span className="quick__hint">{hint}</span>
      </span>
    </button>
  );
}

export function Home({ onMenu }: { onMenu: () => void }) {
  const pages = useStore((s) => s.pages);
  const use = useFromTemplate();
  const all = Object.values(pages);
  const recent = [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const [confirmReset, setConfirmReset] = useState(false);
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="view">
      <TopBar
        onMenu={onMenu}
        crumbs={
          <span className="crumb crumb--here">
            <Icon name="home" size={14} />
            Home
          </span>
        }
      />
      <div className="scroll">
        <div className="wide">
          <header className="lede">
            <p className="lede__date">{date}</p>
            <h1 className="display">{greeting()}</h1>
          </header>

          <div className="quick-row">
            <QuickAction icon="page" title="New page" hint="Start with a blank page" onClick={() => newPage("doc")} />
            <QuickAction icon="board" title="New whiteboard" hint="Shapes, arrows and sketches" onClick={() => newPage("board")} />
            <QuickAction
              icon="templates"
              title="Use a template"
              hint={`${templates.length} ready-made pages`}
              onClick={() => store.navigate({ name: "templates" })}
            />
          </div>

          <section className="section" aria-labelledby="recent-title">
            <div className="section__head">
              <h2 id="recent-title" className="section__title">
                Recent
              </h2>
              <span className="section__count">{all.length} pages</span>
            </div>
            {recent.length === 0 ? (
              <p className="empty">No pages yet. Create one above, or start from a template.</p>
            ) : (
              <div className="card-grid">
                {recent.map((p) => (
                  <PageCard key={p.id} page={p} />
                ))}
              </div>
            )}
          </section>

          <section className="section" aria-labelledby="tpl-title">
            <div className="section__head">
              <h2 id="tpl-title" className="section__title">
                Start from a template
              </h2>
              <button type="button" className="link" onClick={() => store.navigate({ name: "templates" })}>
                See all
              </button>
            </div>
            <div className="card-grid">
              {["meeting", "brief", "journal", "userflow"].map((id) => {
                const t = templates.find((x) => x.id === id)!;
                return <TemplateCard key={id} t={t} onUse={use} />;
              })}
            </div>
          </section>

          <footer className="home-foot">
            {confirmReset ? (
              <div className="confirm">
                <span>Replace every page with the sample pages?</span>
                <button type="button" className="btn btn--quiet" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    store.resetWorkspace();
                    setConfirmReset(false);
                    toast("Sample pages restored");
                  }}
                >
                  Replace
                </button>
              </div>
            ) : (
              <button type="button" className="link link--quiet" onClick={() => setConfirmReset(true)}>
                Restore sample pages
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */
