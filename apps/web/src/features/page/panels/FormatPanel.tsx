// The Aa panel: text styles, turning blocks into pages, marks, lists, indent, alignment,
// decorations, colour and font. Works on the selected text, or else on the block with the cursor.

import { useEffect, useReducer } from "react";
import {
  TEXT_COLORS,
  formatState,
  getBridge,
  indent,
  setAlign,
  setColor,
  setFont,
  setTextStyle,
  toggleDecoration,
  toggleList,
  toggleMark,
  turnIntoPage,
  type DovliEditor,
  type FontId,
  type TextStyleId,
} from "@dovli/editor";
import { PAGE_FONTS } from "@dovli/theme";
import { Icon, cn, toast } from "@dovli/ui";
import type { Page } from "@dovli/core";
import { store } from "@/lib/store";
import { IconRow, IconRowButton, PanelTitle, Section, Tile, keepSelection } from "./kit";

const TITLES: { id: TextStyleId; label: string; cls: string }[] = [
  { id: "title", label: "Title", cls: "font-display text-lg font-bold" },
  { id: "subtitle", label: "Subtitle", cls: "font-display text-md font-bold" },
  { id: "heading", label: "Heading", cls: "font-display text-base font-bold" },
];
const CONTENT: { id: TextStyleId; label: string; cls: string }[] = [
  { id: "strong", label: "Strong", cls: "font-bold" },
  { id: "body", label: "Body", cls: "" },
  { id: "caption", label: "Caption", cls: "text-sm text-ink-3" },
];

/** Re-draw the panel whenever the selection or the page changes. */
function useEditorTick(editor: DovliEditor | null) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const offs = [editor.onSelectionChange(tick), editor.onChange(tick)];
    return () => offs.forEach((off) => (typeof off === "function" ? off() : undefined));
  }, [editor]);
}

export function FormatPanel({ page, editor }: { page: Page; editor: DovliEditor | null }) {
  useEditorTick(editor);
  if (!editor) return <p className="m-0 p-2 text-sm text-ink-3">Opening the page…</p>;
  const f = formatState(editor);
  const off = !f.textual;
  const run = (fn: () => void) => () => fn();

  return (
    <div>
      <PanelTitle>Format</PanelTitle>
      {off && <p className="m-0 mb-2 rounded-md bg-well px-3 py-2 text-sm text-ink-3">Put the cursor in some text to format it.</p>}

      <Section title="Titles">
        <div className="grid grid-cols-3 gap-1.5">
          {TITLES.map((t) => (
            <Tile key={t.id} {...keepSelection} active={f.textStyle === t.id} disabled={off} className={t.cls} onClick={run(() => setTextStyle(editor, t.id))}>
              {t.label}
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="Content">
        <div className="grid grid-cols-3 gap-1.5">
          {CONTENT.map((t) => (
            <Tile key={t.id} {...keepSelection} active={f.textStyle === t.id} disabled={off} className={t.cls} onClick={run(() => setTextStyle(editor, t.id))}>
              {t.label}
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="Groups">
        <div className="grid grid-cols-2 gap-1.5">
          {(["page", "card"] as const).map((as) => (
            <Tile
              key={as}
              {...keepSelection}
              onClick={() => {
                const bridge = getBridge();
                const id = bridge && turnIntoPage(editor, bridge, page.id, as);
                if (id)
                  toast(as === "card" ? "Turned into a page card" : "Turned into a page", {
                    action: { label: "Open", onClick: () => store.navigate({ name: "page", id }) },
                  });
              }}
            >
              <span
                aria-hidden="true"
                className={cn("grid h-6 w-5 place-items-start rounded-[4px] p-[3px] shadow-sm", as === "card" ? "w-7 bg-panel" : "bg-panel")}
              >
                <span className="h-0.5 w-full rounded bg-ink-4" />
              </span>
              {as === "page" ? "Page" : "Card"}
            </Tile>
          ))}
        </div>
        <p className="m-0 mt-1.5 text-xs text-ink-3">Moves the selected blocks into a new page inside this one.</p>
      </Section>

      <Section title="Text">
        <div className="flex flex-col gap-1.5">
          <IconRow>
            <IconRowButton {...keepSelection} icon="bold" label="Bold" active={f.marks.bold} disabled={off} onClick={run(() => toggleMark(editor, "bold"))} />
            <IconRowButton {...keepSelection} icon="italic" label="Italic" active={f.marks.italic} disabled={off} onClick={run(() => toggleMark(editor, "italic"))} />
            <IconRowButton {...keepSelection} icon="strike" label="Strikethrough" active={f.marks.strike} disabled={off} onClick={run(() => toggleMark(editor, "strike"))} />
            <IconRowButton {...keepSelection} icon="code" label="Code" active={f.marks.code} disabled={off} onClick={run(() => toggleMark(editor, "code"))} />
          </IconRow>
          <IconRow>
            <IconRowButton {...keepSelection} icon="checkbox" label="To-do" active={f.list === "checkListItem"} disabled={off} onClick={run(() => toggleList(editor, "checkListItem"))} />
            <IconRowButton {...keepSelection} icon="toggle" label="Toggle" active={f.list === "toggleListItem"} disabled={off} onClick={run(() => toggleList(editor, "toggleListItem"))} />
            <IconRowButton {...keepSelection} icon="bulletList" label="Bullet list" active={f.list === "bulletListItem"} disabled={off} onClick={run(() => toggleList(editor, "bulletListItem"))} />
            <IconRowButton {...keepSelection} icon="numberList" label="Numbered list" active={f.list === "numberedListItem"} disabled={off} onClick={run(() => toggleList(editor, "numberedListItem"))} />
          </IconRow>
          <div className="grid grid-cols-[2fr_4fr] gap-1.5">
            <IconRow>
              <IconRowButton {...keepSelection} icon="outdent" label="Move left (outdent)" disabled={!f.canOutdent} onClick={run(() => indent(editor, "out"))} />
              <IconRowButton {...keepSelection} icon="indent" label="Move right (indent)" disabled={!f.canIndent} onClick={run(() => indent(editor, "in"))} />
            </IconRow>
            <IconRow>
              {(
                [
                  ["left", "alignLeft", "Align left"],
                  ["center", "alignCenter", "Centre"],
                  ["right", "alignRight", "Align right"],
                  ["justify", "alignJustify", "Justify"],
                ] as const
              ).map(([a, icon, label]) => (
                <IconRowButton key={a} {...keepSelection} icon={icon} label={label} active={f.align === a} disabled={off} onClick={run(() => setAlign(editor, a))} />
              ))}
            </IconRow>
          </div>
        </div>
      </Section>

      <Section title="Decorations">
        <div className="grid grid-cols-2 gap-1.5">
          <Tile {...keepSelection} active={f.decoration === "focus"} disabled={off} onClick={run(() => toggleDecoration(editor, "focus"))}>
            <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-accent" />
            Focus
          </Tile>
          <Tile {...keepSelection} active={f.decoration === "box"} disabled={off} onClick={run(() => toggleDecoration(editor, "box"))}>
            <span aria-hidden="true" className="h-4 w-6 rounded-[4px] bg-line-strong" />
            Box
          </Tile>
        </div>
      </Section>

      <Section title="Colour">
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Text colour">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={f.color === c.id}
              aria-label={c.label}
              title={c.label}
              disabled={off}
              {...keepSelection}
              onClick={run(() => setColor(editor, c.id))}
              className={cn(
                "mx-auto grid size-9 place-items-center rounded-full transition-transform hover:scale-105 disabled:opacity-40",
                f.color === c.id ? "shadow-[0_0_0_2px_var(--d-panel),0_0_0_4px_var(--d-ink)]" : "",
              )}
              style={{ background: c.swatch }}
            >
              {f.color === c.id && <Icon name="check" size={14} className="text-[var(--d-panel)] mix-blend-difference" />}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Font">
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(PAGE_FONTS) as FontId[]).map((id) => (
            <Tile key={id} {...keepSelection} active={f.font === id} disabled={off} className="h-14 flex-col gap-0" onClick={run(() => setFont(editor, id))}>
              <span className="text-lg leading-none" style={{ fontFamily: PAGE_FONTS[id].family }}>
                {PAGE_FONTS[id].sample}
              </span>
              <span className="text-xs text-ink-2">{PAGE_FONTS[id].label}</span>
            </Tile>
          ))}
        </div>
      </Section>
    </div>
  );
}
