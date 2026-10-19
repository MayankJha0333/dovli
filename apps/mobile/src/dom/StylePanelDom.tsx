"use dom";

// The Style panel on the phone, as on the web: every page style (drawn with the same CSS
// backdrops), colours, cover, dividers, font and width. It runs as a small web page because the
// styles are CSS art; every change goes back to the phone, which saves it on the page.

import "./editor.css";
import { useEffect, useState } from "react";
import type { DOMProps } from "expo/dom";
import type { DividerStyle, PageFont, PageLook } from "@dovli/core";
import { COVER_PRESETS, DIVIDER_STYLES, FONT_STYLESHEET, PAGE_FONTS, PAGE_STYLES, PLAIN_BASE, coverPreset, getStyle, getTheme, lookName, resolveLook, styleVars, themeStylesheet, type PageStyle, type ThemeId } from "@dovli/theme";

const HEX = /^#[0-9a-f]{6}$/i;
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function StyleCard({ s, selected, onPick }: { s: PageStyle | null; selected: boolean; onPick: () => void }) {
  const name = s ? s.name : "Plain";
  return (
    <button type="button" onClick={onPick} aria-pressed={selected} className="flex min-w-0 flex-col gap-1.5 border-0 bg-transparent p-0 text-left text-ink">
      <span
        aria-hidden
        style={{ ...(s ? (styleVars(s) as any) : {}), background: s ? "var(--s-backdrop)" : "var(--d-well)", boxShadow: selected ? "0 0 0 2.5px var(--d-accent), 0 0 0 5px var(--d-accent-soft)" : "inset 0 0 0 1px rgba(0,0,0,0.07)" }}
        className="relative block aspect-[4/5] overflow-hidden rounded-[14px]"
      >
        <span
          className="absolute flex flex-col gap-1.5 rounded-[7px] p-2"
          style={{ left: "22%", right: "22%", top: "20%", bottom: "12%", background: s ? "var(--s-paper)" : "var(--d-panel)", color: s ? "var(--s-ink)" : "var(--d-ink)", boxShadow: "0 6px 16px rgba(0,0,0,0.18)" }}
        >
          <span className="text-[11px] leading-[1.1]" style={{ fontFamily: "var(--title-font, var(--d-font-display))", fontStyle: "var(--title-style, normal)" as any, fontWeight: "var(--title-weight, 600)" as any }}>
            {name}
          </span>
          <i className="block h-[3px] rounded-[2px] opacity-20" style={{ background: "currentColor" }} />
          <i className="block h-[3px] w-4/5 rounded-[2px] opacity-20" style={{ background: "currentColor" }} />
          <i className="block h-[3px] w-[55%] rounded-[2px] opacity-60" style={{ background: s ? "var(--s-accent)" : "var(--d-accent)" }} />
        </span>
        {selected && (
          <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full text-[11px] font-bold" style={{ background: "var(--d-accent)", color: "var(--d-accent-ink)" }}>
            ✓
          </span>
        )}
      </span>
      <span className={cx("truncate px-0.5 text-[13px] font-medium", selected && "text-accent")}>{name}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="m-0 mb-2 px-1 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{title}</h3>
      <div className="rounded-[18px] p-3" style={{ background: "var(--d-panel)", boxShadow: "0 0 0 1px var(--d-line)" }}>
        {children}
      </div>
    </section>
  );
}

function Tile({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx("flex items-center justify-center rounded-[12px] border-0 text-ink", className)}
      style={{ background: active ? "var(--d-accent-soft)" : "var(--d-well)", boxShadow: active ? "inset 0 0 0 1.5px var(--d-accent)" : "none", color: active ? "var(--d-accent)" : undefined }}
    >
      {children}
    </button>
  );
}

/** A colour: the swatch opens the phone's colour picker. */
function ColorRow({ label, value, shown, onPick, onReset }: { label: string; value: string; shown: string; onPick: (hex: string) => void; onReset?: () => void }) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      <span className="flex-1 text-[15px] text-ink">{label}</span>
      {onReset && (
        <button type="button" onClick={onReset} className="rounded-md border-0 bg-transparent px-2 py-1 text-[13px] text-ink-3">
          Reset
        </button>
      )}
      <label className="relative h-8 w-11 overflow-hidden rounded-[9px]" style={{ background: shown, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.14)" }}>
        <input type="color" value={value} aria-label={label} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

export default function StylePanelDom({
  styleId,
  look,
  cover,
  themeId,
  onSetStyle,
  onSetLook,
  onSetCover,
}: {
  styleId: string | null;
  look: PageLook | null;
  cover: string | null;
  themeId: ThemeId;
  onSetStyle: (id: string | null) => Promise<void>;
  /** The whole look after a change, or null when nothing is left. */
  onSetLook: (look: PageLook | null) => Promise<void>;
  onSetCover: (cover: string | null) => Promise<void>;
  dom?: DOMProps;
}) {
  // The app theme's colours and fonts, as in the editor.
  useEffect(() => {
    if (!document.getElementById("dovli-themes")) {
      const style = document.createElement("style");
      style.id = "dovli-themes";
      style.textContent = themeStylesheet();
      document.head.append(style);
      const fonts = document.createElement("link");
      fonts.rel = "stylesheet";
      fonts.href = FONT_STYLESHEET;
      document.head.append(fonts);
    }
    const t = getTheme(themeId);
    document.documentElement.dataset.theme = t.id;
    document.documentElement.dataset.scheme = t.scheme;
    document.documentElement.style.colorScheme = t.scheme;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
  }, [themeId]);

  const [q, setQ] = useState("");
  const [link, setLink] = useState("");
  const l: PageLook = look ?? {};
  const r = resolveLook(styleId, l);
  const shown = r.style;
  const base = getStyle(styleId) ?? PLAIN_BASE;
  const hex = (v: string | undefined, fallback: string) => (v && HEX.test(v) ? v : fallback);
  const setLook = (patch: Partial<PageLook>) => {
    const next: PageLook = { ...l, ...patch };
    for (const k of Object.keys(next) as (keyof PageLook)[]) if (next[k] === undefined) delete next[k];
    void onSetLook(Object.keys(next).length ? next : null);
  };

  const term = q.trim().toLowerCase();
  const list = PAGE_STYLES.filter((s) => !term || `${s.name} ${s.tags}`.toLowerCase().includes(term));
  const showPlain = !term || "plain original default white".includes(term);

  return (
    <div className="min-h-dvh w-full px-4 pb-10 pt-1 text-ink" style={{ fontFamily: "var(--d-font-sans)" }}>
      {/* The look at a glance: the backdrop with a little page on it. */}
      <div
        aria-label={`This page: ${lookName(r)}`}
        className="relative h-[132px] overflow-hidden rounded-[18px]"
        style={{ background: shown ? shown.backdrop : "var(--d-bg)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
      >
        <span
          className="absolute left-1/2 top-4 flex h-[150px] w-[118px] -translate-x-1/2 flex-col gap-1.5 rounded-[10px] p-2.5"
          style={{ background: shown ? shown.paper : "var(--d-panel)", color: shown ? shown.ink : "var(--d-ink)", boxShadow: "0 10px 26px rgba(0,0,0,0.22)" }}
        >
          <span className="truncate text-[13px] font-bold leading-tight" style={{ fontFamily: r.font ? PAGE_FONTS[r.font].family : "var(--title-font, var(--d-font-display))" }}>
            {lookName(r)}
          </span>
          <span className="h-1 w-4/5 rounded bg-current opacity-20" />
          <span className="h-1 w-3/5 rounded bg-current opacity-20" />
          <span className="h-1 w-2/3 rounded opacity-70" style={{ background: shown ? shown.accent : "var(--d-accent)" }} />
        </span>
      </div>

      <Section title="Page style">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search styles, like blue or flowers"
          aria-label="Search styles"
          className="mb-3 h-10 w-full rounded-[11px] border-0 px-3 text-[15px] text-ink outline-none"
          style={{ background: "var(--d-well)" }}
        />
        {showPlain || list.length ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-4">
            {showPlain && <StyleCard s={null} selected={!styleId} onPick={() => void onSetStyle(null)} />}
            {list.map((s) => (
              <StyleCard key={s.id} s={s} selected={styleId === s.id} onPick={() => void onSetStyle(s.id)} />
            ))}
          </div>
        ) : (
          <p className="m-0 py-6 text-center text-ink-3">No styles match “{q}”.</p>
        )}
      </Section>

      <Section title="Colour">
        <ColorRow label="Backdrop" value={hex(l.backdrop ?? base.backdrop, "#e9ebf1")} shown={shown ? shown.backdrop : "var(--d-bg)"} onPick={(v) => setLook({ backdrop: v })} onReset={l.backdrop ? () => setLook({ backdrop: undefined }) : undefined} />
        <ColorRow label="Paper" value={hex(l.paper ?? base.paper, "#ffffff")} shown={shown ? shown.paper : "var(--d-panel)"} onPick={(v) => setLook({ paper: v })} onReset={l.paper ? () => setLook({ paper: undefined }) : undefined} />
        <ColorRow label="Text" value={hex(l.ink ?? base.ink, "#15171d")} shown={shown ? shown.ink : "var(--d-ink)"} onPick={(v) => setLook({ ink: v })} onReset={l.ink ? () => setLook({ ink: undefined }) : undefined} />
        <ColorRow label="Accent" value={hex(l.accent ?? base.accent, "#5146d9")} shown={shown ? shown.accent : "var(--d-accent)"} onPick={(v) => setLook({ accent: v })} onReset={l.accent ? () => setLook({ accent: undefined }) : undefined} />
      </Section>

      <Section title="Cover">
        <div className="grid grid-cols-4 gap-2">
          {COVER_PRESETS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.name}
              aria-pressed={cover === `g:${c.id}`}
              onClick={() => void onSetCover(`g:${c.id}`)}
              className="h-12 rounded-[10px] border-0"
              style={{ background: c.css, boxShadow: cover === `g:${c.id}` ? "0 0 0 2px var(--d-panel), 0 0 0 4px var(--d-accent)" : "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
            />
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^https?:\/\//i.test(link.trim())) {
              void onSetCover(link.trim());
              setLink("");
            }
          }}
        >
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Or paste a picture link"
            aria-label="Picture address"
            className="h-10 min-w-0 flex-1 rounded-[11px] border-0 px-3 text-[15px] text-ink outline-none"
            style={{ background: "var(--d-well)" }}
          />
          <button type="submit" className="h-10 rounded-[11px] border-0 px-3 text-[14px] font-semibold" style={{ background: "var(--d-accent-soft)", color: "var(--d-accent)" }}>
            Use
          </button>
        </form>
        {cover && (
          <button type="button" onClick={() => void onSetCover(null)} className="mt-3 border-0 bg-transparent p-0 text-[14px] font-medium" style={{ color: "var(--d-danger)" }}>
            Remove cover{!coverPreset(cover) && !/^https?:/i.test(cover) ? " (a picture added on another device)" : ""}
          </button>
        )}
      </Section>

      <Section title="Dividers">
        <div className="grid grid-cols-3 gap-2">
          {DIVIDER_STYLES.map((d) => (
            <Tile key={d.id} active={r.divider === d.id} onClick={() => setLook({ divider: d.id === "line" ? undefined : (d.id as DividerStyle) })} className="h-14 flex-col gap-1">
              <span aria-hidden className={cx("block h-2.5 w-10", `dovli-divider-sample-${d.id}`)} />
              <span className="text-[13px]">{d.label}</span>
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="Font">
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(PAGE_FONTS) as PageFont[]).map((id) => (
            <Tile key={id} active={(r.font ?? "system") === id} className="h-16 flex-col gap-0.5" onClick={() => setLook({ font: id === "system" ? undefined : id })}>
              <span className="text-[20px] leading-none" style={{ fontFamily: PAGE_FONTS[id].family }}>
                {PAGE_FONTS[id].sample}
              </span>
              <span className="text-[12px] text-ink-2">{PAGE_FONTS[id].label}</span>
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="Advanced">
        <label className="flex min-h-11 items-center gap-2">
          <span className="flex-1 text-[15px] text-ink">Wide page</span>
          <span className="text-[13px] text-ink-3">Wider on tablets and the web</span>
          <input type="checkbox" checked={r.wide} onChange={(e) => setLook({ wide: e.target.checked || undefined })} className="size-5" style={{ accentColor: "var(--d-accent)" }} />
        </label>
      </Section>
    </div>
  );
}
