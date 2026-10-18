import { useState } from "react";
import { PAGE_STYLES, styleVars, type PageStyle } from "@dovli/theme";
import { Dialog, Icon, IconInput, cn } from "@dovli/ui";
import { store, useStore } from "@/lib/store";
import { ui, useUI } from "@/lib/ui";

function StyleCard({ s, selected, onPick }: { s: PageStyle | null; selected: boolean; onPick: () => void }) {
  const name = s ? s.name : "Plain";
  return (
    <button type="button" onClick={onPick} aria-pressed={selected} className="group flex min-w-0 flex-col gap-2 text-left text-ink">
      <span
        aria-hidden="true"
        style={s ? (styleVars(s) as any) : undefined}
        className={cn(
          "relative block aspect-[4/5] overflow-hidden rounded-lg transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-[3px]",
          s ? "[background:var(--s-backdrop)] shadow-[0_0_0_1px_rgba(0,0,0,0.06)] group-hover:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_12px_28px_rgba(0,0,0,0.16)]" : "bg-well shadow-[inset_0_0_0_1px_var(--d-line)]",
          selected && "shadow-[0_0_0_2.5px_var(--d-accent),0_0_0_5px_var(--d-accent-soft)] group-hover:shadow-[0_0_0_2.5px_var(--d-accent),0_0_0_5px_var(--d-accent-soft)]",
        )}
      >
        <span
          className="absolute inset-x-[24%] bottom-[13%] top-[21%] flex flex-col gap-2 rounded-[8px] p-[9px] shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
          style={{ background: s ? "var(--s-paper)" : "var(--d-panel)", color: s ? "var(--s-ink)" : "var(--d-ink)" }}
        >
          <span className="text-[13px] leading-[1.1] tracking-tight" style={{ fontFamily: "var(--title-font, var(--d-font-display))", fontStyle: "var(--title-style, normal)", fontWeight: "var(--title-weight, 600)" as any }}>
            {name}
          </span>
          <span className="flex flex-col gap-1">
            <i className="h-[3px] rounded-[2px] opacity-20" style={{ background: "currentColor" }} />
            <i className="h-[3px] w-4/5 rounded-[2px] opacity-20" style={{ background: "currentColor" }} />
            <i className="h-[3px] w-[55%] rounded-[2px] opacity-60" style={{ background: s ? "var(--s-accent)" : "var(--d-accent)" }} />
          </span>
        </span>
        {selected && (
          <span className="absolute right-[9px] top-[9px] grid size-[22px] place-items-center rounded-full bg-accent text-accent-ink shadow-sm">
            <Icon name="check" size={13} />
          </span>
        )}
      </span>
      <span className={cn("px-0.5 text-sm font-medium", selected && "text-accent")}>{name}</span>
    </button>
  );
}

/** Pick how a page looks: a backdrop behind it, paper, ink, accent and title font. */
export function StyleGallery() {
  const id = useUI((s) => s.styleFor);
  const page = useStore((s) => (id ? s.pages[id] : undefined));
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const list = PAGE_STYLES.filter((s) => !term || `${s.name} ${s.tags}`.toLowerCase().includes(term));
  const showPlain = !term || "plain original default white".includes(term);
  const pick = (style: string | undefined) => page && store.updatePage(page.id, { style });

  return (
    <Dialog open={!!page} onOpenChange={(o) => !o && ui.set({ styleFor: null })} title="Page style" description="Changes only this page. Your app theme stays the same." size="lg">
      <IconInput icon="search" placeholder="Search styles, like blue or flowers" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search styles" />
      {showPlain || list.length ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-5 max-[640px]:grid-cols-2">
          {showPlain && <StyleCard s={null} selected={!page?.style} onPick={() => pick(undefined)} />}
          {list.map((s) => (
            <StyleCard key={s.id} s={s} selected={page?.style === s.id} onPick={() => pick(s.id)} />
          ))}
        </div>
      ) : (
        <p className="m-0 py-8 text-center text-ink-2">No styles match “{q}”.</p>
      )}
    </Dialog>
  );
}
