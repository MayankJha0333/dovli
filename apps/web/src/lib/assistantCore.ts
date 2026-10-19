// The assistant's page logic, with no React, editor or server in it (tested in assistantCore.test.ts).
//
//   pageListing    the open page as numbered blocks ([b1] # Title, [b2] text…) for the AI to read.
//                  Short numbers instead of real block ids: fewer tokens, and nothing to misspell.
//   parseReply     the AI's answer: a JSON object { reply, changes }. Anything that isn't valid is
//                  dropped, and a reply that isn't JSON at all is still shown as text.
//   applyChanges   the changes, on a copy of the page's blocks. The app then puts the result in the
//                  editor in one step, so one ⌘Z undoes the whole thing (like Craft's Assistant).
//
// Changes the AI can ask for (Craft's Assistant can do the same kinds of edit):
//   insert        new Markdown at the start/end, or before/after/inside a block
//   update        rewrite one block (and keep what's nested inside it unless the new text has its own)
//   replace_text  swap some words inside one block (review fixes: several can touch the same block)
//   delete        remove blocks
//   move          reorder blocks
//   replace_page  restructure the whole page (refused when the page was too long to read in full)
//   set_title     rename the page
//   create_page   a new page inside this one, with its own content

import { blockToMarkdown, flattenBlocks, markdownToBlocks } from "@dovli/core";

export type Position = "start" | "end" | "after" | "before" | "inside";

export type Change =
  | { op: "insert"; position: Position; block_id?: string; markdown: string }
  | { op: "update"; block_id: string; markdown: string }
  | { op: "replace_text"; block_id: string; find: string; replace: string }
  | { op: "delete"; block_ids: string[] }
  | { op: "move"; block_ids: string[]; position: Position; block_id?: string }
  | { op: "replace_page"; markdown: string }
  | { op: "set_title"; title: string }
  | { op: "create_page"; title: string; markdown: string; icon?: string };

export interface PageListing {
  /** The page as numbered blocks, one per line (continuation lines indented). */
  text: string;
  /** Real block ids, in listing order: [b1] is ids[0]. */
  ids: string[];
  /** True when the page was too long and the listing stops early. */
  truncated: boolean;
}

export const MAX_LISTING = 24_000; // characters, about 6,000 tokens
const MAX_CHANGES = 25;
const MAX_MARKDOWN = 60_000;
const POSITIONS: Position[] = ["start", "end", "after", "before", "inside"];

/* ---------------------------------------------------------------- reading a page */

export function pageListing(blocks: any[] | undefined, maxChars = MAX_LISTING): PageListing {
  const out: string[] = [];
  const ids: string[] = [];
  let size = 0;
  let truncated = false;
  for (const { block, depth } of flattenBlocks(blocks ?? [])) {
    const tag = `[b${ids.length + 1}] `;
    const pad = "  ".repeat(depth);
    const md = blockToMarkdown(block);
    const text = md.length ? md : [""];
    const line = text.map((l, i) => (i === 0 ? tag + pad + l : " ".repeat(tag.length) + pad + l)).join("\n");
    if (size + line.length > maxChars) {
      truncated = true;
      break;
    }
    out.push(line);
    ids.push(block.id);
    size += line.length + 1;
  }
  // A blank page is one empty line: say nothing, so the AI sees "(The page is empty.)" rather than "[b1]".
  const blank = out.every((l) => /^\[b\d+\]\s*$/.test(l));
  return { text: blank ? "" : out.join("\n"), ids, truncated };
}

/* ---------------------------------------------------------------- reading the AI's answer */

const str = (v: unknown, max = MAX_MARKDOWN) => (typeof v === "string" ? v.slice(0, max) : null);
/**
 * Markdown from the AI, minus things it sometimes copies from what it was shown: the
 * <page title="…"> wrapper around the page, and the [b12] numbers at the start of lines.
 */
export function cleanMarkdown(md: string): string {
  return md
    .split("\n")
    .filter((l) => !/^\s*<page title="[^"]*">\s*$/.test(l) && !/^\s*<\/page>\s*$/.test(l))
    .map((l) => l.replace(/^(\s*)\[b\d+\] ?/, "$1"))
    .join("\n")
    .trim();
}
const markdownOf = (v: unknown) => {
  const s = str(v);
  return s === null ? null : cleanMarkdown(s);
};
const idList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : []);

function cleanChange(c: any): Change | null {
  if (!c || typeof c !== "object") return null;
  const position = POSITIONS.includes(c.position) ? (c.position as Position) : "end";
  const block_id = str(c.block_id ?? c.block, 40) ?? undefined;
  switch (c.op) {
    case "insert": {
      const markdown = markdownOf(c.markdown);
      return markdown?.trim() ? { op: "insert", position, block_id, markdown } : null;
    }
    case "update": {
      const markdown = markdownOf(c.markdown);
      return block_id && markdown !== null ? { op: "update", block_id, markdown } : null;
    }
    case "replace_text": {
      const find = str(c.find, 2_000);
      const replace = str(c.replace, 4_000);
      return block_id && find?.trim() && replace !== null && find !== replace ? { op: "replace_text", block_id, find, replace } : null;
    }
    case "delete": {
      const block_ids = idList(c.block_ids ?? c.blocks);
      return block_ids.length ? { op: "delete", block_ids } : null;
    }
    case "move": {
      const block_ids = idList(c.block_ids ?? c.blocks);
      return block_ids.length ? { op: "move", block_ids, position, block_id } : null;
    }
    case "replace_page": {
      const markdown = markdownOf(c.markdown);
      return markdown !== null ? { op: "replace_page", markdown } : null;
    }
    case "set_title": {
      const title = str(c.title, 200)?.trim();
      return title ? { op: "set_title", title } : null;
    }
    case "create_page": {
      const title = str(c.title, 200)?.trim();
      if (!title) return null;
      const icon = str(c.icon, 8)?.trim();
      return { op: "create_page", title, markdown: markdownOf(c.markdown) ?? "", ...(icon ? { icon: [...icon].slice(0, 2).join("") } : {}) };
    }
    default:
      return null;
  }
}

/** The reply and raw changes in a parsed answer: an object, or (some models) a list mixing the object and stray changes. */
function collect(v: any): { reply: string; raw: any[] } | null {
  if (Array.isArray(v)) {
    let reply = "";
    const raw: any[] = [];
    let found = false;
    for (const x of v) {
      if (!x || typeof x !== "object") continue;
      if (typeof x.op === "string") {
        raw.push(x);
        found = true;
        continue;
      }
      const inner = collect(x);
      if (inner) {
        reply ||= inner.reply;
        raw.push(...inner.raw);
        found = true;
      }
    }
    return found ? { reply, raw } : null;
  }
  if (!v || typeof v !== "object") return null;
  if (typeof v.op === "string") return { reply: "", raw: [v] };
  const reply = typeof v.reply === "string" ? v.reply.trim() : typeof v.message === "string" ? v.message.trim() : "";
  const raw = Array.isArray(v.changes) ? v.changes : [];
  return reply || raw.length || "changes" in v ? { reply, raw } : null;
}

/** Every way the AI's answer might hold JSON: as it is, inside a code fence, or with chatter around it. */
function jsonCandidates(raw: string): unknown[] {
  const text = raw.trim();
  const tries = [text, text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")];
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const first = text.indexOf(open);
    const last = text.lastIndexOf(close);
    if (first >= 0 && last > first) tries.push(text.slice(first, last + 1));
  }
  const out: unknown[] = [];
  for (const t of tries) {
    try {
      out.push(JSON.parse(t));
    } catch {
      /* not this shape */
    }
  }
  return out;
}

/** Pull { reply, changes } out of the AI's answer, however it was wrapped. */
export function parseReply(raw: string): { reply: string; changes: Change[] } {
  const text = raw.trim();
  for (const value of jsonCandidates(text)) {
    {
      const got = collect(value);
      if (got) {
        const changes = got.raw.slice(0, MAX_CHANGES).map(cleanChange).filter((x: Change | null): x is Change => !!x);
        return { reply: got.reply || (changes.length ? "Done." : "I'm not sure how to help with that."), changes };
      }
    }
  }
  // Broken JSON: show its reply if one can be found, never the raw JSON, and change nothing.
  const m = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  if (m) {
    try {
      return { reply: JSON.parse(`"${m[1]}"`), changes: [] };
    } catch {
      /* fall through */
    }
  }
  if (/^\s*[[{]/.test(text)) return { reply: "Sorry, my answer came out garbled. Please ask again.", changes: [] };
  return { reply: text || "I'm not sure how to help with that.", changes: [] };
}

/* ---------------------------------------------------------------- changing a page */

export interface Applied {
  blocks: any[];
  /** A new title, when the AI renamed the page. */
  title?: string;
  /** Pages to make inside this one. */
  pages: { title: string; icon?: string; blocks: any[] }[];
  /** What happened, in plain words, for the chat. */
  done: string[];
  /** What couldn't be done, and why. */
  skipped: string[];
  /** The first block that changed, to scroll to. */
  focus?: string;
}

const clipText = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

/**
 * Where `find` is in `text`, forgiving the small differences an AI makes when it quotes:
 * curly vs straight quotes and apostrophes, dashes, extra spaces, and Markdown marks
 * (**, *, _, ~~, ==, `) inside the quoted words.
 */
export function findLoose(text: string, find: string): { start: number; end: number } | null {
  const exact = text.indexOf(find);
  if (exact >= 0) return { start: exact, end: exact + find.length };
  const marks = "(?:\\*\\*|\\*|__|_|~~|==|`)*"; // Markdown marks that may sit between the words
  const pattern = find
    .trim()
    .replace(/\s+/g, " ")
    .split("")
    .map((ch) => {
      if (ch === " ") return "\\s+";
      if (/['‘’]/.test(ch)) return "['‘’]";
      if (/["“”]/.test(ch)) return '["“”]';
      if (/[-–—]/.test(ch)) return "[-–—]";
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join(marks);
  if (!pattern) return null;
  try {
    const m = new RegExp(pattern).exec(text) ?? new RegExp(pattern, "i").exec(text);
    return m ? { start: m.index, end: m.index + m[0].length } : null;
  } catch {
    return null;
  }
}

/** Blocks Markdown can't hold. A full rewrite must never lose these; they're kept at the end if the AI left them out. */
const KEEP_TYPES = new Set(["subpage", "flowchart", "dataTable", "image", "file", "video", "audio", "pdf", "excalidraw", "embed"]);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function applyChanges(
  blocks: any[] | undefined,
  changes: Change[],
  listing: Pick<PageListing, "ids" | "truncated">,
  opts: { findPage?: (title: string) => { id: string; title: string } | null } = {},
): Applied {
  let doc: any[] = structuredClone(blocks ?? []);
  const result: Applied = { blocks: doc, pages: [], done: [], skipped: [] };
  const counts = { added: 0, updated: 0, removed: 0, moved: 0, fixed: 0 };

  const realId = (id: string | undefined) => {
    if (!id) return undefined;
    const m = /^\[?b(\d+)\]?$/i.exec(id.trim());
    return m ? listing.ids[Number(m[1]) - 1] : id;
  };
  const existing = () => new Map(flattenBlocks(doc).map(({ block }) => [block.id, block] as const));
  const toBlocks = (md: string) => markdownToBlocks(md, { existing: existing(), findPage: opts.findPage });
  const locate = (id: string | undefined) => {
    const real = realId(id);
    if (!real) return null;
    for (const { block, parent } of flattenBlocks(doc)) if (block.id === real) return { list: parent, index: parent.indexOf(block), block };
    return null;
  };
  const mark = (id?: string) => {
    result.focus ??= id;
  };
  const insertAt = (items: any[], position: Position, at?: string): boolean => {
    if (position === "end") doc.push(...items);
    else if (position === "start") doc.unshift(...items);
    else {
      const t = locate(at);
      if (!t) return false;
      if (position === "inside") (t.block.children ??= []).push(...items);
      else t.list.splice(t.index + (position === "after" ? 1 : 0), 0, ...items);
    }
    return true;
  };

  for (const c of changes) {
    switch (c.op) {
      case "insert": {
        const items = toBlocks(c.markdown);
        if (!items.length) break;
        if (!insertAt(items, c.position, c.block_id)) {
          result.skipped.push(`Couldn't find where to add text (${c.block_id}).`);
          break;
        }
        counts.added += flattenBlocks(items).length;
        mark(items[0].id);
        break;
      }
      case "update": {
        const t = locate(c.block_id);
        if (!t) {
          result.skipped.push(`Couldn't find a block to change (${c.block_id}).`);
          break;
        }
        const items = toBlocks(c.markdown);
        if (!items.length) {
          t.list.splice(t.index, 1);
          counts.removed++;
          break;
        }
        const [first, ...more] = items;
        first.id = t.block.id;
        if (!first.children?.length && t.block.children?.length) first.children = t.block.children;
        t.list.splice(t.index, 1, first, ...more);
        counts.updated++;
        counts.added += more.length;
        mark(first.id);
        break;
      }
      case "replace_text": {
        const t = locate(c.block_id);
        const md = t ? blockToMarkdown(t.block).join("\n") : "";
        const at = t ? findLoose(md, c.find) : null;
        if (!t || !at) {
          result.skipped.push(`Couldn't find “${clipText(c.find, 60)}” in the page any more.`);
          break;
        }
        const items = toBlocks(md.slice(0, at.start) + c.replace + md.slice(at.end));
        if (!items.length) break;
        const [first, ...more] = items;
        first.id = t.block.id;
        if (!first.children?.length && t.block.children?.length) first.children = t.block.children;
        t.list.splice(t.index, 1, first, ...more);
        counts.fixed++;
        mark(first.id);
        break;
      }
      case "delete": {
        let n = 0;
        for (const id of c.block_ids) {
          const t = locate(id);
          if (t) {
            t.list.splice(t.index, 1);
            n++;
          }
        }
        counts.removed += n;
        if (n < c.block_ids.length) result.skipped.push(`${plural(c.block_ids.length - n, "block")} to remove weren't found.`);
        break;
      }
      case "move": {
        const moving: any[] = [];
        for (const id of c.block_ids) {
          const t = locate(id);
          if (t) moving.push(...t.list.splice(t.index, 1));
        }
        if (!moving.length) break;
        if (!insertAt(moving, c.position, c.block_id)) {
          doc.push(...moving); // never lose what was being moved
          result.skipped.push("Couldn't find where to move the blocks, so they went to the end.");
        }
        counts.moved += moving.length;
        mark(moving[0].id);
        break;
      }
      case "replace_page": {
        if (listing.truncated) {
          result.skipped.push("The page is too long to rewrite in one go. Ask for changes to one part at a time.");
          break;
        }
        const before = flattenBlocks(doc).filter(({ block }) => KEEP_TYPES.has(block.type)).map(({ block }) => block);
        const next = toBlocks(c.markdown);
        const after = new Set(flattenBlocks(next).map(({ block }) => block.id));
        const kept = before.filter((b) => !after.has(b.id) && !(b.type === "subpage" && next.some((x: any) => x.type === "subpage" && x.props?.pageId === b.props?.pageId)));
        doc = [...next, ...kept];
        result.done.push("Rewrote the page");
        if (kept.length) result.done.push(`Kept ${plural(kept.length, "block")} the rewrite left out (pages, files, sketches) at the end`);
        mark(doc[0]?.id);
        break;
      }
      case "set_title":
        result.title = c.title;
        result.done.push(`Renamed the page to “${c.title}”`);
        break;
      case "create_page":
        result.pages.push({ title: c.title, icon: c.icon, blocks: c.markdown.trim() ? toBlocks(c.markdown) : [] });
        result.done.push(`Made a page inside this one: “${c.title}”`);
        break;
    }
  }

  if (counts.added) result.done.push(`Added ${plural(counts.added, "block")}`);
  if (counts.updated) result.done.push(`Changed ${plural(counts.updated, "block")}`);
  if (counts.fixed) result.done.push(`Fixed ${plural(counts.fixed, "place")} in the wording`);
  if (counts.removed) result.done.push(`Removed ${plural(counts.removed, "block")}`);
  if (counts.moved) result.done.push(`Moved ${plural(counts.moved, "block")}`);
  result.blocks = doc;
  return result;
}

/** What a change does, for its icon in the card. */
export type ChangeKind = "add" | "edit" | "remove" | "move" | "restructure" | "title" | "page" | "flowchart";

const MERMAID = /```mermaid\s*\n([\s\S]*?)(?:```|$)/i;

/** "Client → Server → Database": the boxes of a Mermaid flowchart, in order. */
export function flowchartSummary(code: string): string {
  const seen: string[] = [];
  // A box is a node id followed by its text in [square], (round), ((circle)), ([stadium]), {diamond} or >flag].
  const box = /(?<=\w)(?:\[\[?"?([^\]"]+)"?\]\]?|\(\[?\(?"?([^)\]"]+)"?\)?\]?\)|\{\{?"?([^}"]+)"?\}\}?|>"?([^\]"]+)"?\])/g;
  for (const m of code.matchAll(box)) {
    const label = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "")
      .replace(/^\((.*)\)$/, "$1") // [(database)]
      .replace(/<br\s*\/?>/gi, " ")
      .trim();
    if (label && !seen.includes(label)) seen.push(label);
  }
  return seen.slice(0, 6).join(" → ") + (seen.length > 6 ? " → …" : "");
}

/** Markdown as one short line of plain text: no #, -, |, ** or fences. */
export function plainPreview(md: string, max = 160): string {
  const flow = MERMAID.exec(md);
  const text = md
    .replace(MERMAID, "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s*(\[![A-Z]+\]\s*)?)/, "")
        .replace(/^\s*\|?\s*-{3,}.*$/, "")
        .replace(/^\s*```.*$/, "")
        .replace(/\s*\|\s*/g, " · ")
        .replace(/<\/?[a-z][^>]*>/gi, "")
        .replace(/(\*\*|__|~~|==|`)/g, "")
        .replace(/^\s*·\s*|\s*·\s*$/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" · ");
  const all = [flow ? `Flowchart: ${flowchartSummary(flow[1]) || "boxes and arrows"}` : "", text].filter(Boolean).join(" · ");
  return all.length > max ? `${all.slice(0, max).trimEnd()}…` : all;
}

const hasFlowchart = (md: string) => MERMAID.test(md);

/** One line per change, for the "review before applying" card. */
export function describeChange(c: Change): { label: string; preview?: string; kind: ChangeKind } {
  const preview = (md: string) => plainPreview(md) || undefined;
  switch (c.op) {
    case "insert": {
      const where = c.position === "start" ? "at the top" : c.position === "end" ? "at the end" : c.position === "inside" ? "inside a block" : `${c.position} a block`;
      if (hasFlowchart(c.markdown) && !plainPreview(c.markdown.replace(MERMAID, ""))) return { label: `Add a flowchart ${where}`, preview: preview(c.markdown), kind: "flowchart" };
      return { label: `Add ${where}`, preview: preview(c.markdown), kind: hasFlowchart(c.markdown) ? "flowchart" : "add" };
    }
    case "update":
      return { label: hasFlowchart(c.markdown) ? "Turn a block into a flowchart" : "Rewrite a block", preview: preview(c.markdown), kind: hasFlowchart(c.markdown) ? "flowchart" : "edit" };
    case "replace_text":
      return { label: "Fix the wording", preview: `“${clipText(c.find, 70)}” → “${clipText(c.replace, 70)}”`, kind: "edit" };
    case "delete":
      return { label: `Remove ${plural(c.block_ids.length, "block")}`, kind: "remove" };
    case "move":
      return { label: `Move ${plural(c.block_ids.length, "block")}`, kind: "move" };
    case "replace_page":
      return { label: "Restructure the whole page", preview: preview(c.markdown), kind: "restructure" };
    case "set_title":
      return { label: `Rename to “${c.title}”`, kind: "title" };
    case "create_page":
      return { label: `New page inside: “${c.title}”`, preview: c.markdown ? preview(c.markdown) : undefined, kind: "page" };
  }
}

/** The blocks a change points at, as page block ids (for "show me where"). */
export function changeTargets(c: Change, ids: string[]): string[] {
  const real = (id?: string) => {
    const m = id ? /^\[?b(\d+)\]?$/i.exec(id.trim()) : null;
    return m ? ids[Number(m[1]) - 1] : undefined;
  };
  const list = c.op === "delete" || c.op === "move" ? c.block_ids : c.op === "update" || c.op === "insert" || c.op === "replace_text" ? [c.block_id] : [];
  return list.map(real).filter((x): x is string => !!x);
}

/* ---------------------------------------------------------------- streaming */

/**
 * Follows the AI's answer as it arrives, so the reply can be shown word by word. The answer is
 * JSON ({"reply": "...", "changes": [...]}): this reads the "reply" string before the JSON is
 * complete. An answer that isn't JSON at all is shown as it comes.
 */
/** `count` names the key that starts each item being written: "op" for changes, "severity" for review findings. */
export function replyStream(count = "op") {
  const counter = new RegExp(`"${count}"\\s*:`, "g");
  let buf = "";
  let start = -1; // where the reply's text begins in buf
  let plain: boolean | null = null;
  return {
    push(chunk: string): { reply: string; changes: number } {
      buf += chunk;
      if (plain === null) {
        const first = buf.trimStart()[0];
        if (first) plain = !"{[`".includes(first);
      }
      if (plain) return { reply: buf.trim(), changes: 0 };
      if (start < 0) {
        const m = /"(?:reply|message)"\s*:\s*"/.exec(buf);
        if (m) start = m.index + m[0].length;
      }
      let reply = "";
      if (start >= 0) {
        for (let i = start; i < buf.length; i++) {
          const ch = buf[i];
          if (ch === '"') break;
          if (ch !== "\\") {
            reply += ch;
            continue;
          }
          const next = buf[i + 1];
          if (next === undefined) break; // the rest of this escape hasn't arrived yet
          if (next === "u") {
            const hex = buf.slice(i + 2, i + 6);
            if (hex.length < 4) break;
            reply += String.fromCharCode(parseInt(hex, 16) || 32);
            i += 5;
            continue;
          }
          reply += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "" : next;
          i += 1;
        }
      }
      return { reply, changes: (buf.match(counter) ?? []).length };
    },
  };
}

/* ---------------------------------------------------------------- question or change? */

// Words that ask for the page to change. Anything without one is a question, answered in chat
// with no changes card. "Yes" / "go ahead" count, so a follow-up to "Want me to add this?" works.
const CHANGE_WORDS = new RegExp(
  "\\b(" +
    [
      "add", "insert", "put", "write", "rewrite", "make", "create", "change", "update", "edit", "fix", "correct (?:the|this|that|it|these|my|any|all)",
      "replace", "delete", "remove", "cut", "move", "rename", "retitle", "title it", "turn", "convert", "attach",
      "shorten", "lengthen", "expand", "improve", "polish", "simplify", "translate", "format", "reformat",
      "organi[sz]e", "restructure", "reorder", "sort", "split", "merge", "combine", "draft", "append", "prepend",
      "clean", "tidy", "bold", "highlight", "indent", "outline", "fill", "draw", "redraw", "plan", "generate",
      "paste", "save", "note it", "apply", "undo",
      "yes", "yeah", "yep", "sure", "ok", "okay", "do it", "go ahead", "please do", "sounds good",
      "here", "into", "in the page", "to the page", "on the page", "at the top", "at the end", "below", "above", "under", "after it", "before it",
    ].join("|") +
    ")\\b",
  "i",
);

/** Takes the AI's internal block ids out of a reply: "after block **b3**" → "after that block". */
export function hideIds(reply: string): string {
  return reply
    .replace(/\b(blocks?)\s+\*{0,2}\[?b\d{1,5}\]?\*{0,2}((?:\s*(?:,|and)\s*\*{0,2}\[?b\d{1,5}\]?\*{0,2})*)/gi, (_, w: string, more: string) =>
      more || /s$/i.test(w) ? "those blocks" : "that block",
    )
    .replace(/\[b\d{1,5}\]\s?/g, "");
}

/** True when the person's message asks for the page to change; false for a plain question. */
export function wantsChange(message: string): boolean {
  return CHANGE_WORDS.test(message.replace(/\s+/g, " "));
}

/* ---------------------------------------------------------------- document review */

export type Severity = "high" | "medium" | "low";
export type ReviewFocus = "full" | "grammar" | "clarity" | "structure" | "tone";

export interface Finding {
  severity: Severity;
  /** A few words: "Passive, vague opening". */
  title: string;
  /** Why it matters, in a sentence. */
  why: string;
  /** The exact words in the page it's about. */
  quote?: string;
  /** Its fix: an index into the turn's changes. Advice only has no fix. */
  change?: number;
}

export interface Review {
  focus: ReviewFocus;
  /** 1–10, how ready the page is for its reader. */
  score?: number;
  findings: Finding[];
}

/** The kinds of review, with the message the person sees in the chat. */
export const REVIEWS: Record<ReviewFocus, { label: string; ask: string }> = {
  full: { label: "Document review", ask: "Review this page" },
  grammar: { label: "Spelling and grammar", ask: "Check the spelling and grammar" },
  clarity: { label: "Clarity", ask: "What's hard to follow in this page?" },
  structure: { label: "Structure", ask: "Give me feedback on the structure" },
  tone: { label: "Tone of voice", ask: "Check the tone of this page" },
};

const SEVERITIES: Severity[] = ["high", "medium", "low"];
const MAX_FINDINGS = 20;

/**
 * Read a document review: { reply (the verdict), score, findings: [{ severity, title, why, quote, fix }] }.
 * Each fix is a change like any other, so the person can tick the ones they want and apply them in
 * one step. Findings are sorted most serious first. Falls back to a normal reply when it isn't a review.
 */
export function parseReview(raw: string, focus: ReviewFocus): { reply: string; changes: Change[]; review: Review } {
  for (const v of jsonCandidates(raw)) {
    const o: any = Array.isArray(v) ? v.find((x) => x && typeof x === "object" && Array.isArray(x.findings)) : v;
    if (!o || typeof o !== "object" || !Array.isArray(o.findings)) continue;
    const changes: Change[] = [];
    const findings: Finding[] = [];
    for (const f of o.findings.slice(0, MAX_FINDINGS)) {
      if (!f || typeof f !== "object") continue;
      const title = typeof f.title === "string" ? f.title.trim().slice(0, 120) : "";
      const why = typeof f.why === "string" ? f.why.trim().slice(0, 400) : "";
      if (!title && !why) continue;
      const fix = cleanChange(f.fix ?? f.change);
      const quote = typeof f.quote === "string" && f.quote.trim() ? f.quote.trim().slice(0, 300) : fix?.op === "replace_text" ? fix.find : undefined;
      const finding: Finding = { severity: SEVERITIES.includes(f.severity) ? f.severity : "medium", title: title || clipText(why, 60), why, ...(quote ? { quote } : {}) };
      if (fix) finding.change = changes.push(fix) - 1;
      findings.push(finding);
    }
    findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
    const n = Math.round(Number(o.score));
    const reply = typeof o.reply === "string" && o.reply.trim() ? o.reply.trim() : findings.length ? "Here's what I'd improve." : "This page reads well. Nothing important to fix.";
    return { reply, changes, review: { focus, ...(n >= 1 && n <= 10 ? { score: n } : {}), findings } };
  }
  const plain = parseReply(raw);
  return { ...plain, review: { focus, findings: [] } };
}

/* ---------------------------------------------------------------- text diagrams */

export interface TextDiagram {
  /** The code block holding it. */
  id: string;
  /** mermaid: Dovli can draw it straight away. text: arrows drawn with characters; the AI redraws it. */
  kind: "mermaid" | "text";
  code: string;
}

const inlineText = (content: unknown): string =>
  typeof content === "string" ? content : Array.isArray(content) ? content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("") : "";

const PLAIN_LANGS = new Set(["", "text", "plaintext", "plain", "txt", "ascii", "diagram", "flow", "flowchart", "none"]);
const ARROW_LINE = /[▼▲►◄▶◀↓↑→←⇒⇓]|-->|->|=>|<-|──|^\s*[|│┃]\s*(\S.*)?$|^\s*v\s*$|[┌┐└┘├┤┬┴]/;
const MERMAID_START = /^\s*(flowchart|graph)\s+(TD|TB|LR|RL|BT)\b|^\s*(sequenceDiagram|stateDiagram|classDiagram)\b/;

/** Code blocks that hold a diagram drawn with text (arrows and boxes), or Mermaid that isn't drawn yet. */
export function findTextDiagrams(blocks: any[] | undefined): TextDiagram[] {
  const out: TextDiagram[] = [];
  for (const { block } of flattenBlocks(blocks ?? [])) {
    if (block?.type !== "codeBlock") continue;
    const code = inlineText(block.content).replace(/\s+$/, "");
    if (!code.trim()) continue;
    const lang = String(block.props?.language ?? "").toLowerCase();
    if (lang === "mermaid" || MERMAID_START.test(code)) {
      out.push({ id: block.id, kind: "mermaid", code });
      continue;
    }
    if (!PLAIN_LANGS.has(lang)) continue; // real code: an arrow there is just code
    const lines = code.split("\n").filter((l) => l.trim());
    const arrows = lines.filter((l) => ARROW_LINE.test(l)).length;
    const words = lines.filter((l) => /[A-Za-zऀ-ॿ]{2,}/.test(l)).length;
    if (lines.length >= 3 && arrows >= 2 && words >= 2) out.push({ id: block.id, kind: "text", code });
  }
  return out;
}
