import { templates, type Template } from "@dovli/core";
import { Icon } from "@dovli/ui";
import { Crumb, TopBar } from "@/components/TopBar";
import { TemplateCard, cardGrid } from "@/features/home/cards";
import { Section, wide } from "@/features/home/Home";
import { useFromTemplate } from "@/features/pages/actions";

export function TemplatesView() {
  const use = useFromTemplate();
  const groups: Template["group"][] = ["Work", "Thinking", "Personal"];
  return (
    <div className="flex h-full flex-col">
      <TopBar
        crumbs={
          <Crumb current>
            <Icon name="templates" size={14} className="text-ink-3" />
            Templates
          </Crumb>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className={wide}>
          <header className="flex flex-col gap-1.5">
            <h1 className="display-text m-0 text-[clamp(2.2rem,4.2vw,3rem)]">Templates</h1>
            <p className="m-0 mt-1.5 max-w-[52ch] text-md text-ink-2">Pick a starting point. Each one becomes an ordinary page you can change.</p>
          </header>
          {groups.map((g) => {
            const list = templates.filter((t) => t.group === g);
            return (
              <Section key={g} title={g} id={`tg-${g}`} aside={<span className="text-sm tabular-nums text-ink-3">{list.length}</span>}>
                <div className={cardGrid}>
                  {list.map((t) => (
                    <TemplateCard key={t.id} t={t} onUse={use} />
                  ))}
                </div>
              </Section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
