import type { DovliEditor } from "./schema";

// Find and replace inside one page, plus #tag highlighting.
// Matches are found in the ProseMirror document (so they can span bold/italic runs) and drawn with
// the CSS Custom Highlight API, which paints text without changing the document.

export interface Match {
  from: number;
  to: number;
}

export interface FindOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function findMatches(editor: DovliEditor, query: string, opts: FindOptions = {}): Match[] {
  if (!query) return [];
  const doc = editor.prosemirrorState.doc;
  const re = new RegExp(opts.wholeWord ? `(?<![\\p{L}\\p{N}_])${escape(query)}(?![\\p{L}\\p{N}_])` : escape(query), `g${opts.caseSensitive ? "" : "i"}u`);
  const out: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    const map: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) map.push(pos + 1 + offset + i);
        text += child.text;
      } else {
        // Inline things without text (page links): a placeholder that never matches.
        map.push(pos + 1 + offset);
        text += "￼";
      }
    });
    for (const m of text.matchAll(re)) {
      if (!m[0].length) continue;
      const start = m.index ?? 0;
      out.push({ from: map[start], to: map[start + m[0].length - 1] + 1 });
    }
    return false;
  });
  return out;
}

function rangeFor(editor: DovliEditor, m: Match): Range | null {
  try {
    const view = editor.prosemirrorView;
    const a = view.domAtPos(m.from);
    const b = view.domAtPos(m.to);
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    return r;
  } catch {
    return null;
  }
}

const highlights = () => (typeof CSS !== "undefined" && "highlights" in CSS ? (CSS as any).highlights : null);

export function paintMatches(editor: DovliEditor, matches: Match[], current: number) {
  const reg = highlights();
  if (!reg) return;
  const all = matches.map((m) => rangeFor(editor, m)).filter(Boolean) as Range[];
  const cur = matches[current] ? rangeFor(editor, matches[current]) : null;
  reg.set("dovli-find", new (window as any).Highlight(...all));
  if (cur) reg.set("dovli-find-current", new (window as any).Highlight(cur));
  else reg.delete("dovli-find-current");
}

export function clearMatches() {
  const reg = highlights();
  reg?.delete("dovli-find");
  reg?.delete("dovli-find-current");
}

export function scrollToMatch(editor: DovliEditor, m: Match | undefined) {
  if (!m) return;
  const r = rangeFor(editor, m);
  const rect = r?.getBoundingClientRect();
  const el = (r?.startContainer instanceof Element ? r.startContainer : r?.startContainer.parentElement) as HTMLElement | null;
  if (!rect || !el) return;
  if (rect.top < 80 || rect.bottom > window.innerHeight - 80) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function replaceOne(editor: DovliEditor, m: Match, text: string) {
  const view = editor.prosemirrorView;
  view.dispatch(view.state.tr.insertText(text, m.from, m.to));
}

export function replaceAll(editor: DovliEditor, matches: Match[], text: string) {
  if (!matches.length) return 0;
  const view = editor.prosemirrorView;
  let tr = view.state.tr;
  for (const m of [...matches].sort((a, b) => b.from - a.from)) tr = tr.insertText(text, m.from, m.to);
  view.dispatch(tr);
  return matches.length;
}
