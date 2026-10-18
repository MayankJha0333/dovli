// The Style panel: the page's look at a glance, all styles, colours, cover, dividers, font and width.

import { useRef } from "react";
import type { DividerStyle, Page, PageFont, PageLook } from "@dovli/core";
import { DIVIDER_STYLES, PAGE_FONTS, PLAIN_BASE, coverPreset, getStyle, lookName, resolveLook } from "@dovli/theme";
import { Button, Icon, Switch, cn } from "@dovli/ui";
import { store } from "@/lib/store";
import { ui } from "@/lib/ui";
import { CoverPicker, useCoverSrc } from "../PageHeader";
import { PanelTitle, Section, Tile } from "./kit";

const HEX = /^#[0-9a-f]{6}$/i;

function setLook(page: Page, patch: Partial<PageLook>) {
  const next: PageLook = { ...(page.look ?? {}), ...patch };
  for (const k of Object.keys(next) as (keyof PageLook)[]) if (next[k] === undefined) delete next[k];
  store.updatePage(page.id, { look: Object.keys(next).length ? next : undefined });
}

/** A colour row: the current colour as a swatch, which opens the system colour picker. */
function ColorRow({ label, value, shown, onPick, onReset }: { label: string; value: string; shown: string; onPick: (hex: string) => void; onReset?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-h-11 items-center gap-2">
      <span className="flex-1 text-base text-ink">{label}</span>
      {onReset && (
        <button type="button" onClick={onReset} className="rounded-sm px-1.5 py-0.5 text-xs text-ink-3 hover:bg-hover hover:text-ink">
          Reset
        </button>
      )}
      <label className="relative h-9 w-[72px] cursor-pointer overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] focus-within:ring-2 focus-within:ring-accent" style={{ background: shown }}>
        <input ref={input} type="color" value={value} aria-label={label} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

export function StylePanel({ page }: { page: Page }) {
  const look = page.look ?? {};
  const r = resolveLook(page.style, look);
  const shownStyle = r.style ?? null;
  const coverSrc = useCoverSrc(page.cover);
  const preset = coverPreset(page.cover);
  const hex = (v: string | undefined, fallback: string) => (v && HEX.test(v) ? v : fallback);
  const base = getStyle(page.style) ?? PLAIN_BASE;

  return (
    <div>
      <PanelTitle>Style</PanelTitle>

      {/* The look at a glance: the backdrop with a little page on it. Opens every style. */}
      <button
        type="button"
        onClick={() => ui.set({ styleFor: page.id })}
        aria-label={`Page style: ${lookName(r)}. See all styles`}
        className="group relative block h-[150px] w-full overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
        style={{ background: shownStyle ? shownStyle.backdrop : "var(--d-bg)" }}
      >
        <span
          className="absolute left-1/2 top-4 flex h-[150px] w-[118px] -translate-x-1/2 flex-col gap-1.5 rounded-md p-2.5 text-left shadow-card transition-transform duration-200 group-hover:-translate-y-1"
          style={{ background: shownStyle ? shownStyle.paper : "var(--d-panel)", color: shownStyle ? shownStyle.ink : "var(--d-ink)" }}
        >
          <span className="truncate text-sm font-bold leading-tight" style={{ fontFamily: r.font ? PAGE_FONTS[r.font].family : "var(--title-font, var(--d-font-display))" }}>
            {lookName(r)}
          </span>
          <span className="h-1 w-4/5 rounded bg-current opacity-20" />
          <span className="h-1 w-3/5 rounded bg-current opacity-20" />
          <span className="h-1 w-2/3 rounded opacity-70" style={{ background: shownStyle ? shownStyle.accent : "var(--d-accent)" }} />
        </span>
      </button>
      <div className="mt-2.5 flex justify-center gap-1.5">
        <Button size="sm" variant="secondary" icon="palette" onClick={() => ui.set({ styleFor: page.id })}>
          All styles
        </Button>
        {(page.style || r.customColors) && (
          <Button size="sm" variant="ghost" onClick={() => store.updatePage(page.id, { style: undefined, look: page.look ? { ...look, backdrop: undefined, paper: undefined, ink: undefined, accent: undefined } : undefined })}>
            Plain
          </Button>
        )}
      </div>

      <Section title="Colour" className="mt-3">
        <ColorRow
          label="Backdrop"
          value={hex(look.backdrop ?? base.backdrop, "#e9ebf1")}
          shown={shownStyle ? shownStyle.backdrop : "var(--d-bg)"}
          onPick={(v) => setLook(page, { backdrop: v })}
          onReset={look.backdrop ? () => setLook(page, { backdrop: undefined }) : undefined}
        />
        <ColorRow
          label="Paper"
          value={hex(look.paper ?? base.paper, "#ffffff")}
          shown={shownStyle ? shownStyle.paper : "var(--d-panel)"}
          onPick={(v) => setLook(page, { paper: v })}
          onReset={look.paper ? () => setLook(page, { paper: undefined }) : undefined}
        />
        <ColorRow
          label="Text"
          value={hex(look.ink ?? base.ink, "#15171d")}
          shown={shownStyle ? shownStyle.ink : "var(--d-ink)"}
          onPick={(v) => setLook(page, { ink: v })}
          onReset={look.ink ? () => setLook(page, { ink: undefined }) : undefined}
        />
        <ColorRow
          label="Accent"
          value={hex(look.accent ?? base.accent, "#5146d9")}
          shown={shownStyle ? shownStyle.accent : "var(--d-accent)"}
          onPick={(v) => setLook(page, { accent: v })}
          onReset={look.accent ? () => setLook(page, { accent: undefined }) : undefined}
        />
      </Section>

      <Section title="Cover">
        <div className="flex min-h-11 items-center gap-2">
          <span className="flex-1 text-base text-ink">Cover picture</span>
          {page.cover && (
            <button type="button" onClick={() => store.updatePage(page.id, { cover: null })} className="rounded-sm px-1.5 py-0.5 text-xs text-ink-3 hover:bg-hover hover:text-ink">
              Remove
            </button>
          )}
          <CoverPicker
            page={page}
            trigger={
              <button
                type="button"
                aria-label={page.cover ? "Change cover" : "Add a cover"}
                className="grid h-9 w-[72px] place-items-center overflow-hidden rounded-md bg-well text-ink-3 shadow-[inset_0_0_0_1px_var(--d-line)] hover:text-ink"
                style={preset ? { background: preset.css } : undefined}
              >
                {coverSrc ? <img src={coverSrc} alt="" className="size-full object-cover" /> : !preset && <Icon name="plus" size={16} />}
              </button>
            }
          />
        </div>
      </Section>

      <Section title="Dividers">
        <div className="grid grid-cols-3 gap-1.5">
          {DIVIDER_STYLES.map((d) => (
            <Tile key={d.id} active={r.divider === d.id} onClick={() => setLook(page, { divider: d.id === "line" ? undefined : (d.id as DividerStyle) })} className="flex-col gap-1 py-2">
              <span aria-hidden="true" className={cn("block h-2.5 w-10", `dovli-divider-sample-${d.id}`)} />
              <span className="text-sm">{d.label}</span>
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="Font">
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(PAGE_FONTS) as PageFont[]).map((id) => (
            <Tile key={id} active={(r.font ?? "system") === id} className="h-14 flex-col gap-0" onClick={() => setLook(page, { font: id === "system" ? undefined : id })}>
              <span className="text-lg leading-none" style={{ fontFamily: PAGE_FONTS[id].family }}>
                {PAGE_FONTS[id].sample}
              </span>
              <span className="text-xs text-ink-2">{PAGE_FONTS[id].label}</span>
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="Layout">
        <div className="flex min-h-10 items-center gap-2">
          <label htmlFor="wide-page" className="flex-1 text-base text-ink">
            Wide page
          </label>
          <Switch id="wide-page" label="Wide page" checked={r.wide} onCheckedChange={(v) => setLook(page, { wide: v || undefined })} />
        </div>
      </Section>
    </div>
  );
}
