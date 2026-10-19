// The assistant panel's state: conversations, sending messages, and applying the changes the AI
// suggests to the open page. Modelled on Craft's Assistant:
//   - a conversation beside the page, kept in history for 30 days (on this device);
//   - two modes: "suggest" shows the changes first and waits for Apply (Craft's Explore), "edit"
//     makes them straight away (Craft's Execute);
//   - every change the assistant makes is one step: ⌘Z in the page, or Undo in the chat, takes it back.
//
// The checking and applying itself is pure and tested (assistantCore.ts); this file does the I/O.

import { useSyncExternalStore } from "react";
import { blockToMarkdown, childrenOf, displayTitle, flattenBlocks, flowchartToMermaid, livePages, markdownToBlocks, mermaidScene, type Page } from "@dovli/core";
import { REVIEWS, applyChanges, describeChange, findLoose, flowchartSummary, pageListing, type Change, type Review, type ReviewFocus, type TextDiagram } from "./assistantCore";
import { aiHeaders, allowanceLeft, countUsage } from "./ai";
import { settings } from "./settings";
import { store } from "./store";
import { getActiveEditor, ui } from "./ui";
import { toast } from "@dovli/ui";

export type AssistantMode = "suggest" | "edit";

export interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  /** The changes the AI asked for (assistant turns). */
  changes?: Change[];
  /** Changes the person unticked before applying. */
  off?: number[];
  status?: "pending" | "applied" | "discarded" | "undone";
  /** What happened when applied, in plain words. */
  done?: string[];
  skipped?: string[];
  /** The page's block ids the AI saw, in order ("b1" is the first), so changes can be applied later. */
  ids?: string[];
  truncated?: boolean;
  /** A failed request: shown in red, never sent back to the AI. */
  error?: boolean;
  /** The answer is still arriving. */
  streaming?: boolean;
  /** How many changes are being written, while streaming. */
  preparing?: number;
  /** The text the person had selected when they sent this (user turns). */
  quote?: string;
  /** A document review: the findings, each with its fix (an index into changes). */
  review?: Review;
  /** What kind of request this answers, while it streams ("review" shows "Reviewing…"). */
  task?: "review";
}

/** Text selected in the open page, shown above the message box and sent with the next message. */
export interface PageSelection {
  pageId: string;
  /** What's selected, for the AI: the text, or a whole block written out (a flowchart as Mermaid). */
  text: string;
  blockIds: string[];
  /** Text, one whole block that isn't text (a flowchart, picture, table…), or several blocks. */
  kind?: "text" | "flowchart" | "block" | "blocks";
  /** For the chip: "Selected text · 12 words", "Selected flowchart". */
  label?: string;
  /** For the chip: a short, readable version of `text`. */
  preview?: string;
}

export interface Chat {
  id: string;
  /** The page the conversation is about. */
  pageId: string | null;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
}

interface State {
  chats: Chat[];
  /** The open conversation, or null for a fresh one. */
  current: string | null;
  /** The page "New conversation" was pressed on: it starts fresh instead of picking up the last chat. */
  fresh: string | null;
  busy: boolean;
  selection: PageSelection | null;
}

const KEY = "dovli.assistant.v1";
const KEEP_DAYS = 30;
const MAX_CHATS = 60;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

let state: State = { chats: [], current: null, fresh: null, busy: false, selection: null };
/** A chat left for less than this is picked up again when you come back to its page. */
const RESUME_MS = 30 * 60_000;
let loaded = false;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>, save = true) => {
  state = { ...state, ...patch };
  if (save) persist();
  listeners.forEach((l) => l());
};

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const since = Date.now() - KEEP_DAYS * 86_400_000;
    state = {
      ...state,
      chats: (Array.isArray(raw) ? raw : [])
        .filter((c: Chat) => c && Array.isArray(c.turns) && c.updatedAt > since)
        // An answer cut off by closing the tab: say so instead of waiting forever.
        .map((c: Chat) => ({ ...c, turns: c.turns.map((t) => (t.streaming ? { ...t, streaming: false, error: true, text: t.text || "This answer was interrupted." } : t)) })),
    };
  } catch {
    /* start fresh */
  }
}

function persist() {
  try {
    const keep = state.chats.filter((c) => c.turns.length).slice(0, MAX_CHATS);
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch {
    /* full or private mode: history lasts until the tab closes */
  }
}

/* Snapshots for Undo, kept in memory only (a page can be big). */
interface Snapshot {
  pageId: string | null;
  blocks: any[] | null;
  title: string | null;
  created: string[];
  /** The page's words right after the change, to tell whether it has been edited since. */
  after?: string;
}

/** A page's words and block order, ignoring settings (a flowchart drawing itself isn't an edit). */
const wordsOf = (blocks: any[]) => flattenBlocks(blocks).map(({ block }) => `${block.id}:${block.type}:${JSON.stringify(block.content ?? "")}`).join("|");
const snapshots = new Map<string, Snapshot>();

/* ---------------------------------------------------------------- reading */

export const assistant = {
  get: () => state,
  subscribe(l: () => void) {
    load();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  chat(): Chat | null {
    return state.chats.find((c) => c.id === state.current) ?? null;
  },
  /** The conversation to show for a page: the open one if it's about this page, else a recent one about it. */
  chatFor(pageId: string | null): Chat | null {
    const open = assistant.chat();
    if (open && open.pageId === pageId) return open;
    if (state.fresh === (pageId ?? "")) return null;
    return state.chats.find((c) => c.pageId === pageId && c.turns.length && Date.now() - c.updatedAt < RESUME_MS) ?? null;
  },
  /** Open or close the panel. */
  toggle(open = !ui.get().assistant) {
    load();
    ui.set({ assistant: open });
  },
  /** Open the drawer and send this message about the open page. */
  ask(text: string) {
    load();
    ui.set({ assistant: true });
    void send(text);
  },
  /** "Ask AI" over selected text: open the drawer with the selection attached, ready to type. */
  askAboutSelection() {
    load();
    const page = openPage();
    const editor = page ? editorFor(page.id) : null;
    const sel = editor && page ? readSelection(editor, page.id) : null;
    if (sel) set({ selection: sel }, false);
    ui.set({ assistant: true });
    window.dispatchEvent(new Event("dovli:assistant-focus"));
  },
  newChat() {
    set({ current: null, fresh: openPage()?.id ?? "" });
  },
  openChat(id: string) {
    set({ current: id, fresh: null });
  },
  deleteChat(id: string) {
    set({
      chats: state.chats.filter((c) => c.id !== id),
      current: state.current === id ? null : state.current,
    });
  },
  canUndo: (turnId: string) => snapshots.has(turnId),
  review: startReview,
  keepReviewNote,
  findQuote,
  drawDiagram,
  setSelection(sel: PageSelection | null) {
    const same = sel && state.selection && sel.pageId === state.selection.pageId && sel.text === state.selection.text && sel.blockIds.join() === state.selection.blockIds.join();
    if (!same && (sel || state.selection)) set({ selection: sel }, false);
  },
  send,
  apply,
  discard,
  undo,
  toggleChange,
};

export function useAssistant<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    assistant.subscribe,
    () => select(state),
    () => select(state),
  );
}

/* ---------------------------------------------------------------- the open page */

/** The page on screen, when it's a page the assistant can work on. */
function openPage(): Page | null {
  const s = store.get();
  const p = s.route.name === "page" ? s.pages[s.route.id] : undefined;
  return p && p.kind === "doc" && !p.deletedAt ? p : null;
}

/** The live editor of a page, when that page is on screen. */
function editorFor(pageId: string | null): any {
  const s = store.get();
  return pageId && s.route.name === "page" && s.route.id === pageId ? getActiveEditor() : null;
}

/** The page's blocks as they are right now: from the editor when it's open (it may hold unsaved typing). */
function currentBlocks(page: Page): any[] {
  const editor = editorFor(page.id);
  return (editor?.document as any[]) ?? page.blocks ?? [];
}

const findPage = (title: string) => {
  const t = title.trim().toLowerCase();
  const p = livePages(store.get().pages).find((x) => displayTitle(x).toLowerCase() === t);
  return p ? { id: p.id, title: displayTitle(p) } : null;
};

/* ---------------------------------------------------------------- talking to the AI */

function update(chatId: string, fn: (c: Chat) => Chat, save = true) {
  set({ chats: state.chats.map((c) => (c.id === chatId ? fn(c) : c)) }, save);
}

function patchTurn(chatId: string, turnId: string, patch: Partial<Turn>, save = true) {
  update(chatId, (c) => ({
    ...c,
    updatedAt: Date.now(),
    turns: c.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)),
  }), save);
}

/** An earlier assistant turn as the AI sees it again: its reply, plus what became of its changes. */
function asHistory(t: Turn): string {
  if (t.role === "user") return t.text;
  const n = t.changes?.length ?? 0;
  const what = !n
    ? ""
    : t.status === "applied"
      ? ` (Changes applied: ${(t.done ?? []).join(", ") || "none"}.)`
      : t.status === "pending"
        ? " (Changes suggested, not applied yet.)"
        : t.status === "undone"
          ? " (Changes applied, then undone.)"
          : " (Changes discarded.)";
  return JSON.stringify({ reply: t.text + what, changes: [] });
}

async function send(text: string, opts: { review?: ReviewFocus } = {}) {
  load();
  const message = text.trim();
  if (!message || state.busy) return;
  const page = openPage();
  const pageId = page?.id ?? null;

  // A conversation belongs to one page. Moving to another page starts a new one.
  let chat = assistant.chatFor(pageId);
  if (chat) set({ current: chat.id, fresh: null }, false);
  else {
    chat = {
      id: uid(),
      pageId,
      title: message.slice(0, 80),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turns: [],
    };
    set({ chats: [chat, ...state.chats], current: chat.id, fresh: null });
  }
  const chatId = chat.id;
  const selection = state.selection?.pageId === pageId ? state.selection : null;
  const userTurn: Turn = { id: uid(), role: "user", text: message, at: Date.now(), ...(selection ? { quote: (selection.preview ?? selection.text).slice(0, 400) } : {}) };
  update(chatId, (c) => ({ ...c, updatedAt: Date.now(), turns: [...c.turns, userTurn] }));
  set({ selection: null }, false);

  const answerId = uid();
  const fail = (msg: string) => {
    const turn: Turn = { id: answerId, role: "assistant", text: msg, at: Date.now(), error: true };
    update(chatId, (c) => ({ ...c, turns: c.turns.some((t) => t.id === answerId) ? c.turns.map((t) => (t.id === answerId ? turn : t)) : [...c.turns, turn] }));
    set({ busy: false }, false);
  };
  if (!allowanceLeft()) return fail("You've used this month's Dovli AI allowance. It resets on the 1st, or connect your own key in Settings → AI.");

  set({ busy: true }, false);

  // What the AI sees: the page as numbered blocks, what's selected, where the cursor is, and the pages inside it.
  const blocks = page ? currentBlocks(page) : [];
  const listing = pageListing(blocks);
  const short = (id: string) => {
    const i = listing.ids.indexOf(id);
    return i >= 0 ? `b${i + 1}` : null;
  };
  let selected = (selection?.blockIds ?? []).map(short).filter((x): x is string => !!x);
  let cursor: string | null = null;
  try {
    const editor = editorFor(pageId);
    if (!selected.length) selected = ((editor?.getSelection()?.blocks ?? []) as { id: string }[]).map((b) => short(b.id)).filter((x): x is string => !!x);
    cursor = editor ? short(editor.getTextCursorPosition().block.id) : null;
  } catch {
    /* no cursor in the page */
  }
  const history = (assistant.chat()?.turns ?? []).filter((t) => !t.error && !t.streaming);
  const prefs = settings.get();

  let res: Response;
  try {
    res = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: await aiHeaders(),
      body: JSON.stringify({
        ...(opts.review ? { task: { type: "review", focus: opts.review } } : {}),
        messages: history.map((t) => ({ role: t.role, content: asHistory(t) })),
        page: page
          ? {
              title: displayTitle(page),
              listing: listing.text,
              truncated: listing.truncated,
              selected,
              selectedText: selection?.text.slice(0, 4000) ?? "",
              cursor,
              children: childrenOf(store.get().pages, page.id).map((k) => displayTitle(k)),
            }
          : null,
        mode: prefs.assistantMode,
        preferences: prefs.assistantPrefs,
        today: (() => {
          const d = new Date();
          const day = d.toLocaleDateString("en", { weekday: "long" });
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${day}`;
        })(),
      }),
    });
  } catch {
    return fail("Couldn't reach the assistant. Check your connection and try again.");
  }
  if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
    const data = await res.json().catch(() => ({}));
    return fail(data.error ?? "The assistant isn't available right now. Please try again.");
  }

  // The answer arrives line by line: the reply as it's written, then the changes.
  update(chatId, (c) => ({ ...c, updatedAt: Date.now(), turns: [...c.turns, { id: answerId, role: "assistant", text: "", at: Date.now(), streaming: true, ...(opts.review ? { task: "review" as const } : {}) }] }), false);
  let final: any = null;
  try {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const handle = (line: string) => {
      if (!line.trim()) return;
      let ev: any;
      try {
        ev = JSON.parse(line);
      } catch {
        return;
      }
      if (ev.type === "reply") patchTurn(chatId, answerId, { text: String(ev.text ?? "") }, false);
      else if (ev.type === "progress") patchTurn(chatId, answerId, { preparing: Number(ev.changes) || 0 }, false);
      else if (ev.type === "done" || ev.type === "error") final = ev;
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      lines.forEach(handle);
    }
    handle(buf);
  } catch {
    /* cut off: handled below */
  }
  if (!final) return fail("The answer was cut off. Please try again.");
  if (final.type === "error") return fail(final.error ?? "The assistant couldn't finish that. Please try again.");

  countUsage(!!final.own, final.tokens ?? 0, final.used, final.limit);
  const changes: Change[] = Array.isArray(final.changes) ? final.changes : [];
  patchTurn(chatId, answerId, {
    text: String(final.reply ?? "").trim() || (changes.length ? "Here's what I'd change." : "Done."),
    streaming: false,
    preparing: undefined,
    changes,
    ids: listing.ids,
    truncated: listing.truncated,
    status: changes.length ? "pending" : undefined,
    ...(final.review && typeof final.review === "object" ? { review: final.review as Review } : {}),
  });
  set({ busy: false }, false);
  // Review fixes always wait for the person to pick them, even in Edit mode.
  if (changes.length && prefs.assistantMode === "edit" && !opts.review) apply(answerId);
}

/** Words in a list of inline content (text, links, page links). */
const inlineWords = (content: unknown): string =>
  (Array.isArray(content) ? content : [])
    .map((c: any) => (typeof c === "string" ? c : c.type === "text" ? c.text : c.type === "link" ? (c.content ?? []).map((x: any) => x.text).join("") : (c.props?.title ?? "")))
    .join("")
    .trim();

const TEXT_TYPES = new Set(["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "toggleListItem", "quote", "callout", "codeBlock", "small"]);
const KIND_NAMES: Record<string, string> = {
  flowchart: "flowchart",
  table: "table",
  codeBlock: "code block",
  image: "picture",
  video: "video",
  audio: "audio clip",
  file: "file",
  pdf: "PDF",
  embed: "link preview",
  subpage: "page card",
  dataTable: "data table",
};

/** One block written out for the AI (and a short version for the chip). */
function describeBlock(b: any): { text: string; preview: string } {
  if (TEXT_TYPES.has(b?.type)) {
    const t = inlineWords(b.content);
    return { text: t, preview: t };
  }
  if (b?.type === "flowchart") {
    const mermaid = flowchartToMermaid(String(b.props?.scene ?? ""));
    return mermaid
      ? { text: `Flowchart (as Mermaid):\n\`\`\`mermaid\n${mermaid}\n\`\`\``, preview: `Flowchart: ${flowchartSummary(mermaid) || "boxes and arrows"}` }
      : { text: "An empty flowchart", preview: "Empty flowchart" };
  }
  if (b?.type === "table") {
    const rows: any[] = b.content?.rows ?? [];
    const cell = (c: any) => inlineWords(Array.isArray(c) ? c : c?.content);
    const t = rows.map((r) => (r.cells ?? []).map(cell).join(" | ")).join("\n");
    return { text: `Table:\n${t}`, preview: t.replace(/\n/g, " · ") };
  }
  if (b?.type === "subpage") {
    const p = store.get().pages[b.props?.pageId];
    const t = `Page card: “${p ? displayTitle(p) : "a page"}”`;
    return { text: t, preview: t };
  }
  const name = KIND_NAMES[b?.type] ?? "block";
  const about = b?.props?.caption || b?.props?.name || b?.props?.title || b?.props?.url || "";
  const t = `${name[0].toUpperCase()}${name.slice(1)}${about ? `: ${about}` : ""}`;
  return { text: t, preview: t };
}

/**
 * What's selected in a page's editor, or null when nothing is: selected text, or whole blocks
 * (a flowchart or picture clicked on, blocks picked with their handle) written out for the AI.
 */
export function readSelection(editor: any, pageId: string): PageSelection | null {
  try {
    let picked: any[] = editor.getSelection()?.blocks ?? [];
    // A whole block selected (clicking a flowchart or picture, or its handle): the editor reports
    // no selection for these, so find the block from the selected node.
    const sel = editor.prosemirrorView?.state.selection;
    if (!picked.length && sel && "node" in sel && sel.node) {
      const dom = editor.prosemirrorView.nodeDOM(sel.from) as HTMLElement | null;
      const id = dom?.getAttribute?.("data-id") ?? dom?.closest?.("[data-id]")?.getAttribute("data-id");
      const block = id ? editor.getBlock(id) : null;
      if (block) picked = [block];
    }
    const typed = String(editor.getSelectedText() ?? "").trim();
    const allText = picked.every((b) => TEXT_TYPES.has(b.type));
    // Some text inside one text block.
    if (typed && allText && picked.length <= 1) {
      const blocks = picked.length ? picked : [editor.getTextCursorPosition().block];
      const words = typed.split(/\s+/).filter(Boolean).length;
      return { pageId, kind: "text", text: typed.slice(0, 4000), preview: typed, label: `Selected text · ${words} ${words === 1 ? "word" : "words"}`, blockIds: blocks.map((b: any) => b.id) };
    }
    if (!picked.length) return null;
    // Whole blocks, one line (or section) each.
    const parts = picked.map(describeBlock).filter((p) => p.text);
    if (!parts.length) return null;
    const text = parts.map((p) => p.text).join("\n");
    const one = picked.length === 1 && !TEXT_TYPES.has(picked[0].type);
    const words = text.split(/\s+/).filter(Boolean).length;
    return {
      pageId,
      kind: one ? (picked[0].type === "flowchart" ? "flowchart" : "block") : allText ? "text" : "blocks",
      text: text.slice(0, 6000),
      preview: parts.map((p) => p.preview).join("\n"),
      label: one ? `Selected ${KIND_NAMES[picked[0].type] ?? "block"}` : allText ? `Selected text · ${words} words` : `Selected · ${picked.length} blocks`,
      blockIds: picked.map((b: any) => b.id),
    };
  } catch {
    return null;
  }
}

/** Scroll the page to a block and make it glow for a moment. */
export function revealBlock(id: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`.bn-block-outer[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("dovli-assistant-flash");
    void (el as HTMLElement).offsetWidth; // restart the glow
    el.classList.add("dovli-assistant-flash");
    setTimeout(() => el.classList.remove("dovli-assistant-flash"), 1600);
  });
}

/* ---------------------------------------------------------------- changing the page */

function findTurn(turnId: string): { chat: Chat; turn: Turn } | null {
  for (const chat of state.chats) {
    const turn = chat.turns.find((t) => t.id === turnId);
    if (turn) return { chat, turn };
  }
  return null;
}

/** Put blocks into a page: through its editor when it's open (one ⌘Z step), else straight into the store. */
function writeBlocks(pageId: string, blocks: any[]) {
  const editor = editorFor(pageId);
  if (editor) {
    const next = blocks.length ? blocks : [{ type: "paragraph" }];
    const run = () => editor.replaceBlocks(editor.document, next);
    if (typeof editor.transact === "function") editor.transact(run);
    else run();
  } else {
    store.updatePage(pageId, { blocks });
  }
}

function toggleChange(turnId: string, index: number) {
  const found = findTurn(turnId);
  if (!found || found.turn.status !== "pending") return;
  const off = new Set(found.turn.off ?? []);
  if (off.has(index)) off.delete(index);
  else off.add(index);
  patchTurn(found.chat.id, turnId, { off: [...off] });
}

function apply(turnId: string) {
  const found = findTurn(turnId);
  if (!found) return;
  const { chat, turn } = found;
  const chosen = (turn.changes ?? []).filter((_, i) => !turn.off?.includes(i));
  if (!chosen.length) return discard(turnId);

  const pages = store.get().pages;
  const page = chat.pageId ? pages[chat.pageId] : null;
  if (chat.pageId && (!page || page.deletedAt)) {
    patchTurn(chat.id, turnId, {
      status: "discarded",
      skipped: ["The page isn't there any more."],
    });
    return;
  }
  const blocks = page ? currentBlocks(page) : [];
  const result = applyChanges(blocks, chosen, { ids: turn.ids ?? [], truncated: !!turn.truncated }, { findPage });
  const snap: Snapshot = {
    pageId: page?.id ?? null,
    blocks: page ? structuredClone(blocks) : null,
    title: page ? page.title : null,
    created: [],
  };

  // New pages go inside this one, with a card in the page that opens them.
  for (const p of result.pages) {
    const made = store.createPage({
      parentId: page?.id ?? null,
      kind: "doc",
      title: p.title,
      mark: p.icon || undefined,
      blocks: p.blocks,
    });
    snap.created.push(made.id);
    if (page) result.blocks.push({ type: "subpage", props: { pageId: made.id } });
    result.done.push(`Made the page “${p.title}”`);
  }

  if (page) {
    const changedBlocks = JSON.stringify(result.blocks) !== JSON.stringify(blocks);
    if (changedBlocks) writeBlocks(page.id, result.blocks);
    if (result.title && result.title !== page.title) store.updatePage(page.id, { title: result.title });
    const now = store.get().pages[page.id];
    if (now) snap.after = wordsOf(currentBlocks(now));
    // Put the cursor in what changed, so nothing else is left selected.
    const editor = editorFor(page.id);
    if (editor && result.focus) {
      try {
        editor.setTextCursorPosition(result.focus, "end");
      } catch {
        /* a block without text (a flowchart): leave the cursor */
      }
    }
  } else if (!page && result.pages.length && snap.created[0]) {
    store.navigate({ name: "page", id: snap.created[0] });
  }

  snapshots.set(turnId, snap);
  patchTurn(chat.id, turnId, {
    status: "applied",
    done: result.done,
    skipped: result.skipped,
  });

  if (result.focus) revealBlock(result.focus);
}

function discard(turnId: string) {
  const found = findTurn(turnId);
  if (found) patchTurn(found.chat.id, turnId, { status: "discarded" });
}

/** Take back everything one assistant reply changed: the page's blocks, its title, the pages it made. */
function undo(turnId: string) {
  const found = findTurn(turnId);
  const snap = snapshots.get(turnId);
  if (!found || !snap) return;
  const page = snap.pageId ? store.get().pages[snap.pageId] : null;
  // Undo puts the whole page back as it was, so it would also lose anything written since.
  if (page && snap.after && wordsOf(currentBlocks(page)) !== snap.after) {
    toast("The page has changed since, so Undo here would lose your newer edits. Use ⌘Z in the page instead.");
    return;
  }
  if (page && snap.blocks) {
    if (JSON.stringify(currentBlocks(page)) !== JSON.stringify(snap.blocks)) writeBlocks(page.id, snap.blocks);
    if (snap.title !== null && page.title !== snap.title) store.updatePage(page.id, { title: snap.title });
  }
  for (const id of snap.created) if (store.get().pages[id] && !store.get().pages[id].deletedAt) store.trashPage(id);
  snapshots.delete(turnId);
  patchTurn(found.chat.id, turnId, { status: "undone" });
}

export { describeChange };

/* ---------------------------------------------------------------- reviews */

/** Review the open page in the assistant panel. */
function startReview(focus: ReviewFocus = "full") {
  load();
  if (!openPage()) return;
  assistant.toggle(true);
  set({ selection: null }, false);
  void send(REVIEWS[focus].ask, { review: focus });
}

/** The block of the open page that holds these words, to show where a finding is. */
function findQuote(quote: string): string | null {
  const page = openPage();
  if (!page || !quote.trim()) return null;
  for (const { block } of flattenBlocks(currentBlocks(page))) {
    if (findLoose(blockToMarkdown(block).join("\n"), quote)) return block.id;
  }
  return null;
}

/** Keep a review at the top of the page as a note: the verdict, then each finding. */
function keepReviewNote(turnId: string) {
  const found = findTurn(turnId);
  const page = found?.chat.pageId ? store.get().pages[found.chat.pageId] : null;
  if (!found?.turn.review || !page) return;
  const { turn } = found;
  const r = turn.review!;
  const label = REVIEWS[r.focus]?.label ?? "Review";
  const one = (t: string) => t.replace(/\s+/g, " ").trim();
  const md = [
    `<callout tone="note" emoji="📝">**${label}${r.score ? ` · ${r.score}/10` : ""}:** ${one(turn.text)}</callout>`,
    ...r.findings.map((f) => `- [ ] **${one(f.title)}**${f.quote ? ` (“${one(f.quote).slice(0, 80)}”)` : ""}: ${one(f.why)}`),
  ].join("\n");
  const blocks = markdownToBlocks(md);
  const editor = editorFor(page.id);
  const first = editor?.document?.[0];
  if (editor && first) editor.insertBlocks(blocks, first.id, "before");
  else store.updatePage(page.id, { blocks: [...blocks, ...(page.blocks ?? [])] });
  const id = blocks[0]?.id;
  if (id) revealBlock(id);
}

/* ---------------------------------------------------------------- diagrams drawn as text */

const DISMISSED = "dovli.diagramHints.dismissed.v1";

export function dismissedDiagrams(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function dismissDiagram(id: string) {
  try {
    const all = [...dismissedDiagrams(), id].slice(-300);
    localStorage.setItem(DISMISSED, JSON.stringify(all));
  } catch {
    /* private mode: it shows again next time */
  }
  window.dispatchEvent(new Event("dovli:diagram-hints"));
}

/**
 * Turn a diagram written as text into a real flowchart. Mermaid is drawn straight away (no AI); a
 * diagram made of arrows and lines goes to the assistant, which redraws it as Mermaid.
 */
function drawDiagram(d: TextDiagram): boolean {
  const page = openPage();
  if (!page) return false;
  if (d.kind === "mermaid") {
    const editor = editorFor(page.id);
    const flow = { type: "flowchart", props: { scene: mermaidScene(d.code) } };
    if (editor?.getBlock(d.id)) editor.replaceBlocks([d.id], [flow]);
    else store.updatePage(page.id, { blocks: (page.blocks ?? []).map((b: any) => (b.id === d.id ? { ...flow, id: d.id, children: [] } : b)) });
    return true;
  }
  assistant.toggle(true);
  set({ selection: { pageId: page.id, text: d.code.slice(0, 4000), blockIds: [d.id] } }, false);
  void send("Turn this text diagram into a real flowchart and put it in place of the text version. Keep every step, label and branch.");
  return false;
}
