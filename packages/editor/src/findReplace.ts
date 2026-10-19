import type { DovliEditor } from "./schema";

// Find and replace, as in Craft's sidebar Find: plain text or a regular expression, with Match case,
// Whole words and Ignore accents (Craft's "Diacritics Insensitive"). Matches in the open page are
// found in the ProseMirror document (so they can span bold/italic runs) and drawn with the CSS
// Custom Highlight API, which paints text without changing the document. The same matcher also
// searches pages that aren't open (their saved blocks), for "this page and pages inside".

export interface FindOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  ignoreAccents?: boolean;
}

/** One match: where it is in the open page, which block holds it, and the text around it. */
export interface Match {
  from: number;
  to: number;
  blockId?: string;
  snippet?: Snippet;
}

export interface Snippet {
  before: string;
  hit: string;
  after: string;
}

export type Matcher = { re: RegExp; ignoreAccents: boolean } | { error: string } | null;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const strip = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "");

/** Turn what was typed into a matcher. Null for an empty query; { error } for a broken pattern. */
export function buildMatcher(query: string, opts: FindOptions = {}): Matcher {
  if (!query) return null;
  const q = opts.ignoreAccents ? strip(query) : query;
  let body = opts.regex ? q : escape(q);
  if (opts.wholeWord) body = `(?<![\\p{L}\\p{N}_])(?:${body})(?![\\p{L}\\p{N}_])`;
  try {
    return { re: new RegExp(body, `g${opts.caseSensitive ? "" : "i"}u`), ignoreAccents: !!opts.ignoreAccents };
  } catch {
    return { error: "That pattern isn't a valid regular expression." };
  }
}

/** Where a matcher hits in a piece of text, as [start, end) offsets into the original text. */
export function matchText(text: string, m: Exclude<Matcher, null | { error: string }>): [number, number][] {
  let hay = text;
  let back: number[] | null = null;
  if (m.ignoreAccents) {
    // Search a copy without accents, remembering where each of its letters came from.
    hay = "";
    back = [];
    for (let i = 0; i < text.length; i++) {
      const n = strip(text[i]);
      for (let k = 0; k < n.length; k++) back.push(i);
      hay += n;
    }
    back.push(text.length);
  }
  const out: [number, number][] = [];
  m.re.lastIndex = 0;
  for (const hit of hay.matchAll(m.re)) {
    if (!hit[0].length) continue;
    const s = hit.index ?? 0;
    const e = s + hit[0].length;
    out.push(back ? [back[s], back[e - 1] + 1] : [s, e]);
    if (out.length >= 2000) break;
  }
  return out;
}

/** The words around a match, for the results list. */
export function snippetOf(text: string, start: number, end: number): Snippet {
  const lead = 28;
  let a = Math.max(0, start - lead);
  if (a > 0) {
    const space = text.lastIndexOf(" ", start - 1);
    if (space > a - 8 && space < start) a = space + 1;
  }
  return { before: (a > 0 ? "…" : "") + text.slice(a, start), hit: text.slice(start, end), after: text.slice(end, end + 90) };
}

export function findMatches(editor: DovliEditor, query: string, opts: FindOptions = {}): Match[] {
  const m = buildMatcher(query, opts);
  if (!m || "error" in m) return [];
  const doc = editor.prosemirrorState.doc;
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
    const hits = matchText(text, m);
    if (!hits.length) return false;
    // The block this text belongs to (BlockNote keeps the id on the block's container).
    const $pos = doc.resolve(pos);
    let blockId: string | undefined;
    for (let d = $pos.depth; d >= 0; d--) {
      const n = $pos.node(d);
      if (n.type.name === "blockContainer") {
        blockId = n.attrs.id;
        break;
      }
    }
    for (const [s, e] of hits) out.push({ from: map[s], to: map[e - 1] + 1, blockId, snippet: snippetOf(text, s, e) });
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

/** Bring a match into view, in the middle of the page, unless it is already comfortably visible. */
export function scrollToMatch(editor: DovliEditor, m: Match | undefined) {
  if (!m) return;
  const r = rangeFor(editor, m);
  const rect = r?.getBoundingClientRect();
  const el = (r?.startContainer instanceof Element ? r.startContainer : r?.startContainer.parentElement) as HTMLElement | null;
  if (!rect || !el) return;
  if (rect.top < 120 || rect.bottom > window.innerHeight - 80) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** What a match becomes. With a regular expression, $1, $2… in the replacement bring back its groups. */
function replacementFor(editor: DovliEditor, m: Match, text: string, matcher?: Matcher): string {
  if (!matcher || "error" in matcher || !/\$[\d&<]/.test(text)) return text;
  const found = editor.prosemirrorState.doc.textBetween(m.from, m.to, "", "\uFFFC");
  const one = new RegExp(matcher.re.source, matcher.re.flags.replace("g", ""));
  return found.replace(one, text);
}

export function replaceOne(editor: DovliEditor, m: Match, text: string, matcher?: Matcher) {
  const view = editor.prosemirrorView;
  view.dispatch(view.state.tr.insertText(replacementFor(editor, m, text, matcher), m.from, m.to));
}

export function replaceAll(editor: DovliEditor, matches: Match[], text: string, matcher?: Matcher) {
  if (!matches.length) return 0;
  const view = editor.prosemirrorView;
  let tr = view.state.tr;
  for (const m of [...matches].sort((a, b) => b.from - a.from)) tr = tr.insertText(replacementFor(editor, m, text, matcher), m.from, m.to);
  view.dispatch(tr);
  return matches.length;
}
