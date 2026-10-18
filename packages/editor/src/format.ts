// Formatting actions for the Aa panel (Craft-style): text styles, marks, lists, indent,
// alignment, colour, font, decorations, and turning blocks into a page or card.
// Each action works on the selected text when there is some, otherwise on the selected blocks
// (or the block with the cursor), so it does the obvious thing either way.

import { TextSelection } from "prosemirror-state";
import { inlineText } from "@dovli/core";
import type { EditorBridge } from "./bridge";
import type { DovliEditor } from "./schema";
import type { FontId } from "./blocks/textStyles";

export type TextStyleId = "title" | "subtitle" | "heading" | "strong" | "body" | "caption";
export type ListId = "checkListItem" | "toggleListItem" | "bulletListItem" | "numberedListItem";
export type MarkId = "bold" | "italic" | "strike" | "code";
export type AlignId = "left" | "center" | "right" | "justify";
export type DecorationId = "focus" | "box";

/** BlockNote's text colours, with the swatch shown for each. */
export const TEXT_COLORS: { id: string; label: string; swatch: string }[] = [
  { id: "default", label: "Default", swatch: "var(--d-ink)" },
  { id: "gray", label: "Grey", swatch: "#9b9a97" },
  { id: "brown", label: "Brown", swatch: "#8a5a44" },
  { id: "red", label: "Red", swatch: "#e03e3e" },
  { id: "orange", label: "Orange", swatch: "#d9730d" },
  { id: "yellow", label: "Yellow", swatch: "#dfab01" },
  { id: "green", label: "Green", swatch: "#4d8c5b" },
  { id: "blue", label: "Blue", swatch: "#2f6fdc" },
  { id: "purple", label: "Purple", swatch: "#8b4fd1" },
  { id: "pink", label: "Pink", swatch: "#d1458f" },
];

type AnyBlock = { id: string; type: string; props: Record<string, any>; content?: any; children: AnyBlock[] };

const TEXT_TYPES = new Set(["paragraph", "heading", "caption", "quote", "bulletListItem", "numberedListItem", "checkListItem", "toggleListItem", "callout"]);
const isText = (b: AnyBlock) => TEXT_TYPES.has(b.type) && Array.isArray(b.content);

/** The blocks the panel acts on: the selected ones, or the one with the cursor. */
export function targetBlocks(editor: DovliEditor): AnyBlock[] {
  const sel = editor.getSelection();
  if (sel?.blocks?.length) return sel.blocks as unknown as AnyBlock[];
  try {
    return [editor.getTextCursorPosition().block as unknown as AnyBlock];
  } catch {
    return [];
  }
}

/** True when some text (not just a cursor) is selected inside the editor. */
export function hasTextSelection(editor: DovliEditor): boolean {
  const view = editor.prosemirrorView;
  return !!view && !view.state.selection.empty;
}

/** Apply a change to the styles of every bit of text in a block (links included). */
function mapText(content: any[], fn: (styles: Record<string, any>) => Record<string, any>): any[] {
  return content.map((c) => {
    if (c.type === "text") return { ...c, styles: fn({ ...c.styles }) };
    if (c.type === "link") return { ...c, content: mapText(c.content ?? [], fn) };
    return c;
  });
}

const allText = (content: any[], test: (styles: Record<string, any>) => boolean): boolean =>
  content.every((c) => (c.type === "text" ? !c.text || test(c.styles ?? {}) : c.type === "link" ? allText(c.content ?? [], test) : true));

const keepProps = (b: AnyBlock) => {
  const { textColor, backgroundColor, textAlignment } = b.props ?? {};
  return { ...(textColor ? { textColor } : {}), ...(backgroundColor ? { backgroundColor } : {}), ...(textAlignment ? { textAlignment } : {}) };
};

function change(editor: DovliEditor, fn: (b: AnyBlock) => Partial<AnyBlock> | null) {
  const blocks = targetBlocks(editor);
  const view = editor.prosemirrorView;
  // Changing a block's type replaces it, which can stretch the selection over its neighbours.
  // When there was only a cursor, put it back where it was, so the next action hits the same line.
  const cursorAt = view && view.state.selection.empty ? view.state.selection.from : null;
  editor.transact(() => {
    for (const b of blocks) {
      const next = fn(b);
      if (next) editor.updateBlock(b.id, next as any);
    }
  });
  if (view && cursorAt !== null) {
    const { state } = view;
    const pos = Math.max(0, Math.min(cursorAt, state.doc.content.size));
    view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos))));
  }
  editor.focus();
}

/* ---------------- What the selection looks like now (for highlighting the panel's buttons) */

export interface FormatState {
  textStyle: TextStyleId | null;
  list: ListId | null;
  marks: Record<MarkId, boolean>;
  align: AlignId;
  color: string;
  font: FontId;
  decoration: DecorationId | null;
  canIndent: boolean;
  canOutdent: boolean;
  /** False when the cursor is in something that isn't text (a picture, a table). */
  textual: boolean;
}

export function formatState(editor: DovliEditor): FormatState {
  const b = targetBlocks(editor)[0];
  const active = (() => {
    try {
      return editor.getActiveStyles() as Record<string, any>;
    } catch {
      return {};
    }
  })();
  const content = b && Array.isArray(b.content) ? b.content : [];
  let textStyle: TextStyleId | null = null;
  if (b?.type === "heading") textStyle = b.props.level === 1 ? "title" : b.props.level === 2 ? "subtitle" : "heading";
  else if (b?.type === "caption") textStyle = "caption";
  else if (b?.type === "paragraph") textStyle = content.length && allText(content, (s) => !!s.bold) ? "strong" : "body";
  return {
    textStyle,
    list: b && ["checkListItem", "toggleListItem", "bulletListItem", "numberedListItem"].includes(b.type) ? (b.type as ListId) : null,
    marks: { bold: !!active.bold, italic: !!active.italic, strike: !!active.strike, code: !!active.code },
    align: (b?.props?.textAlignment as AlignId) ?? "left",
    color: (active.textColor as string) || b?.props?.textColor || "default",
    font: ((active.font as FontId) || "system") as FontId,
    decoration: b?.type === "quote" ? "focus" : b?.props?.backgroundColor && b.props.backgroundColor !== "default" ? "box" : null,
    canIndent: safe(() => editor.canNestBlock()),
    canOutdent: safe(() => editor.canUnnestBlock()),
    textual: !!b && isText(b),
  };
}

const safe = (fn: () => boolean) => {
  try {
    return fn();
  } catch {
    return false;
  }
};

/* ---------------- Actions */

export function setTextStyle(editor: DovliEditor, id: TextStyleId) {
  const strongNow = formatState(editor).textStyle === "strong";
  change(editor, (b) => {
    if (!isText(b)) return null;
    const props = keepProps(b);
    switch (id) {
      case "title":
        return { type: "heading", props: { ...props, level: 1 } };
      case "subtitle":
        return { type: "heading", props: { ...props, level: 2 } };
      case "heading":
        return { type: "heading", props: { ...props, level: 3 } };
      case "caption":
        return { type: "caption", props };
      case "strong":
        return { type: "paragraph", props, content: mapText(b.content, (s) => ({ ...s, bold: strongNow ? undefined : true })) };
      case "body":
        return { type: "paragraph", props, content: b.type === "paragraph" ? mapText(b.content, (s) => ({ ...s, bold: undefined })) : b.content };
    }
  });
}

export function toggleList(editor: DovliEditor, list: ListId) {
  const on = formatState(editor).list === list;
  change(editor, (b) => (isText(b) ? { type: on ? "paragraph" : list, props: keepProps(b) } : null));
}

export function toggleMark(editor: DovliEditor, mark: MarkId) {
  if (hasTextSelection(editor)) {
    editor.toggleStyles({ [mark]: true } as any);
    editor.focus();
    return;
  }
  // No text selected: the whole block, all on or all off.
  const b = targetBlocks(editor)[0];
  const allOn = b && Array.isArray(b.content) && b.content.length > 0 && allText(b.content, (s) => !!s[mark]);
  change(editor, (blk) => (isText(blk) ? { content: mapText(blk.content, (s) => ({ ...s, [mark]: allOn ? undefined : true })) } : null));
}

export function setAlign(editor: DovliEditor, align: AlignId) {
  change(editor, (b) => (b.props && "textAlignment" in b.props ? { props: { textAlignment: align } } : null));
}

export function indent(editor: DovliEditor, dir: "in" | "out") {
  if (dir === "in" ? safe(() => editor.canNestBlock()) : safe(() => editor.canUnnestBlock())) {
    if (dir === "in") editor.nestBlock();
    else editor.unnestBlock();
  }
  editor.focus();
}

export function setColor(editor: DovliEditor, color: string) {
  if (hasTextSelection(editor)) {
    if (color === "default") editor.removeStyles({ textColor: "" } as any);
    else editor.addStyles({ textColor: color } as any);
    editor.focus();
    return;
  }
  change(editor, (b) => (b.props && "textColor" in b.props ? { props: { textColor: color }, content: isText(b) ? mapText(b.content, (s) => ({ ...s, textColor: undefined })) : undefined } : null));
}

export function setFont(editor: DovliEditor, font: FontId) {
  if (hasTextSelection(editor)) {
    if (font === "system") editor.removeStyles({ font: "" } as any);
    else editor.addStyles({ font } as any);
    editor.focus();
    return;
  }
  change(editor, (b) => (isText(b) ? { content: mapText(b.content, (s) => ({ ...s, font: font === "system" ? undefined : font })) } : null));
}

export function toggleDecoration(editor: DovliEditor, d: DecorationId) {
  const now = formatState(editor).decoration;
  change(editor, (b) => {
    if (!isText(b)) return null;
    if (d === "focus") {
      if (now === "focus") return { type: "paragraph", props: keepProps(b) };
      return b.type === "paragraph" || b.type === "heading" || b.type === "caption" ? { type: "quote", props: keepProps(b) } : null;
    }
    return { props: { backgroundColor: now === "box" ? "default" : "gray" } };
  });
}

/**
 * Turn the selected blocks into their own page, inside this one. The first line becomes the
 * page title when it is text. "page" leaves a link in its place, "card" leaves a page card.
 */
export function turnIntoPage(editor: DovliEditor, bridge: EditorBridge, parentId: string, as: "page" | "card"): string | null {
  const blocks = targetBlocks(editor);
  if (!blocks.length) return null;
  const [first, ...rest] = blocks;
  const titled = isText(first) && inlineText(first.content).trim().length > 0;
  const title = titled ? inlineText(first.content).trim() : "";
  const body = (titled ? [...(first.children ?? []), ...rest] : blocks) as any[];
  const created = bridge.createPage({ parentId, kind: "doc", title });
  bridge.saveBlocks(created.id, body.length ? body : [{ type: "paragraph" }]);
  const replacement =
    as === "card"
      ? [{ type: "subpage", props: { pageId: created.id } }]
      : [{ type: "paragraph", content: [{ type: "pageLink", props: { pageId: created.id, title: title || "Untitled" } }, " "] }];
  editor.replaceBlocks(
    blocks.map((b) => b.id),
    replacement as any,
  );
  editor.focus();
  return created.id;
}
