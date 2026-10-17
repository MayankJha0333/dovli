import { templates, type Template } from "@dovli/core";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { TemplateCard } from "@/features/home/cards";
import { useFromTemplate } from "@/features/pages/actions";

export function TemplatesView({ onMenu }: { onMenu: () => void }) {
  const use = useFromTemplate();
  const groups: Template["group"][] = ["Work", "Thinking", "Personal"];
  return (
    <div className="view">
      <TopBar
        onMenu={onMenu}
        crumbs={
          <span className="crumb crumb--here">
            <Icon name="templates" size={14} />
            Templates
          </span>
        }
      />
      <div className="scroll">
        <div className="wide">
          <header className="lede">
            <h1 className="display">Templates</h1>
            <p className="lede__sub">Pick a starting point. Each one becomes an ordinary page you can change.</p>
          </header>
          {groups.map((g) => (
            <section key={g} className="section" aria-labelledby={`tg-${g}`}>
              <div className="section__head">
                <h2 id={`tg-${g}`} className="section__title">
                  {g}
                </h2>
                <span className="section__count">{templates.filter((t) => t.group === g).length}</span>
              </div>
              <div className="card-grid">
                {templates
                  .filter((t) => t.group === g)
                  .map((t) => (
                    <TemplateCard key={t.id} t={t} onUse={use} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */
