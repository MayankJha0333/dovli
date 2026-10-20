// The side panel: a Dovli page beside the website. Write notes, edit blocks, tick to-dos, clip the
// tab or have AI write notes from it, and add what you select. Changes made elsewhere (the Dovli app,
// a phone) appear on their own: every few seconds it asks the server whether the page changed.

import { DEFAULT_SERVER, DovliError, activeTab, api, appUrl, connection, explainTabError, runInTab, today } from "./api.js";
import { capturePage, captureSelection } from "./capture.js";
import { renderBlocks } from "./render.js";
import { icon, toast } from "./ui.js";

const $ = (id) => document.getElementById(id);
const POLL_MS = 4000;
const state = { conn: null, overview: null, page: null, cursor: null, editing: null, working: false };

/* ---------- Starting ---------- */

// Storage can change twice in quick succession (while connecting), so only the newest start counts.
let starts = 0;
async function start() {
  const run = ++starts;
  const conn = await connection();
  if (run !== starts) return;
  state.conn = conn;
  if (!conn.secret) return showConnect();
  await showApp(run);
}

function showConnect(note = "") {
  closeSheets();
  state.page = null;
  $("app-view").hidden = true;
  $("connect-view").hidden = false;
  $("connect-note").textContent = note;
}

async function showApp(run) {
  $("connect-view").hidden = true;
  $("app-view").hidden = false;
  try {
    state.overview = await api("hello");
  } catch (e) {
    return run === starts && handleError(e);
  }
  const { pageId } = await chrome.storage.local.get("pageId");
  if (run !== starts) return;
  if (pageId) await openPage(pageId);
  else showEmpty("start");
}

function handleError(e) {
  if (e instanceof DovliError && e.status === 401 && e.code === "disconnected") return showConnect("The extension was disconnected. Connect it again.");
  showStatus(e?.message || "Something went wrong. Please try again.", "error");
}

/* ---------- The page ---------- */

async function openPage(id) {
  state.editing = null;
  if (id !== state.page?.id) showLoading();
  try {
    const r = await api("read", { pageId: id });
    state.page = r.page;
    state.cursor = r.cursor;
    await chrome.storage.local.set({ pageId: id, pageTitle: r.page.title });
    // A page chosen elsewhere (the popup, a right-click clip) answers the open picker too.
    $("picker").hidden = true;
    render();
  } catch (e) {
    // Deleted, or in the trash: let them pick another.
    if (e instanceof DovliError && e.status === 400) {
      await chrome.storage.local.remove(["pageId", "pageTitle"]);
      state.page = null;
      showEmpty("gone");
      return;
    }
    handleError(e);
  }
}

async function refresh() {
  if (!state.page) return;
  const r = await api("read", { pageId: state.page.id });
  state.page = r.page;
  state.cursor = r.cursor;
  if (!state.editing) render();
  chrome.storage.local.set({ pageTitle: r.page.title });
}

const EMPTY = {
  start: { icon: "drawer", title: "Pick a page to write in", text: "Notes you write here and selections you add go into it. Or save this tab with AI notes or Article above.", action: "Choose a page" },
  gone: { icon: "alert", title: "That page isn't there any more", text: "It was deleted or moved to the trash. Choose another page to write in.", action: "Choose a page" },
  blank: { icon: "page", title: "This page is empty", text: "Write below, or select text on the website and click Add selection." },
  board: { icon: "page", title: "This is a whiteboard", text: "Whiteboards open in Dovli, where you can draw." },
};

/** A friendly message in the paper: what's going on, and what to do next. */
function emptyState(kind) {
  const e = EMPTY[kind];
  const box = Object.assign(document.createElement("div"), { className: "empty" });
  const tile = Object.assign(document.createElement("span"), { className: "tile accent" });
  tile.append(icon(e.icon));
  box.append(tile, Object.assign(document.createElement("h2"), { textContent: e.title }), Object.assign(document.createElement("p"), { textContent: e.text }));
  if (e.action) {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "btn primary", textContent: e.action });
    b.addEventListener("click", openPicker);
    box.append(b);
  }
  return box;
}

function showEmpty(kind) {
  $("page-icon").textContent = "¶";
  $("page-title").textContent = "Choose a page";
  $("open").href = appUrl(state.conn.server);
  applyStyle(null);
  $("paper-title").hidden = true;
  $("blocks").replaceChildren(emptyState(kind));
}

function showLoading() {
  const sk = Object.assign(document.createElement("div"), { className: "skeleton", ariaLabel: "Loading the page" });
  for (let i = 0; i < 4; i++) sk.append(document.createElement("span"));
  $("paper-title").hidden = true;
  $("blocks").replaceChildren(sk);
}

// How each page style writes its title (packages/theme/src/pageStyles.ts).
const TITLE_FONTS = {
  serif: ["var(--serif)", "normal", "700"],
  italic: ["var(--serif)", "italic", "500"],
  sans: ["var(--font)", "normal", "700"],
  mono: ["var(--mono)", "normal", "500"],
  display: ["var(--font)", "normal", "800"],
};

/** Dress the drawer in the page's own style: its backdrop art, paper, ink, accent and title font. */
function applyStyle(style) {
  const root = document.body;
  const [family, fontStyle, weight] = TITLE_FONTS[style?.title] ?? TITLE_FONTS.serif;
  for (const [k, v] of [
    ["--paper", style?.paper],
    ["--page-ink", style?.ink],
    ["--page-accent", style?.accent],
    ["--title-font", family],
    ["--title-style", fontStyle],
    ["--title-weight", weight],
  ])
    v ? root.style.setProperty(k, v) : root.style.removeProperty(k);
  $("page").style.colorScheme = style ? (style.dark ? "dark" : "light") : "";
  const canvas = $("canvas");
  canvas.style.background = style?.backdrop ?? "";
  canvas.classList.toggle("styled", !!style?.backdrop);
}

function render() {
  const p = state.page;
  if (!p) return;
  const server = state.conn.server;
  $("page-icon").textContent = p.icon || "¶";
  $("page-title").textContent = p.title;
  $("open").href = appUrl(server, p.id);
  applyStyle(p.style);
  $("paper-title").textContent = p.title;
  $("paper-title").hidden = false;
  const box = $("blocks");
  const y = window.scrollY;
  box.replaceChildren();
  if (p.kind === "board") box.append(emptyState("board"));
  else if (!p.blocks.length) box.append(emptyState("blank"));
  box.append(renderBlocks(p.blocks, document, { appUrl: (id) => appUrl(server, id), pageHref: appUrl(server, p.id) }));
  for (const row of box.querySelectorAll(".block")) {
    const del = Object.assign(document.createElement("button"), { className: "del", type: "button", title: "Delete" });
    del.append(icon("close"));
    del.dataset.action = "delete";
    del.setAttribute("aria-label", "Delete this block");
    row.append(del);
  }
  if (p.more) box.append(Object.assign(document.createElement("p"), { className: "more", textContent: `…and ${p.more} more blocks. Open the page in Dovli to see them all.` }));
  window.scrollTo(0, y);
}

const blockOf = (id) => state.page?.blocks.find((b) => b.id === id);

$("page").addEventListener("click", (e) => {
  const target = e.target;
  const row = target.closest?.(".block");
  if (!row || state.editing) return;
  const id = row.dataset.id;
  if (target.dataset.action === "toggle") return void toggle(id, target.checked);
  if (target.closest("[data-action=delete]")) return void remove(id);
  if (target.closest("a") || row.dataset.editable !== "true") return;
  startEdit(id, row);
});

/* ---------- Editing ---------- */

function grow(ta) {
  ta.style.height = "auto";
  ta.style.height = `${ta.scrollHeight + 2}px`;
}

function startEdit(id, row) {
  const block = blockOf(id);
  if (!block) return;
  state.editing = id;
  const ta = Object.assign(document.createElement("textarea"), { className: "edit", value: block.markdown });
  ta.setAttribute("aria-label", "Edit this block (Enter saves, Esc cancels)");
  row.replaceChildren(ta);
  grow(ta);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  const multiline = block.type === "codeBlock" || block.type === "table";
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    state.editing = null;
    if (save && ta.value !== block.markdown) void saveBlock(block, ta.value);
    else render();
  };
  ta.addEventListener("input", () => grow(ta));
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    } else if (e.key === "Enter" && !e.isComposing && (e.metaKey || e.ctrlKey || (!e.shiftKey && !multiline))) {
      e.preventDefault();
      finish(true);
    }
  });
  ta.addEventListener("blur", () => finish(true));
}

async function saveBlock(block, value) {
  showStatus("Saving…", "busy");
  try {
    if (!value.trim()) await api("delete", { pageId: state.page.id, blockIds: [block.id] });
    else await api("update", { pageId: state.page.id, blockId: block.id, markdown: value });
    await refresh();
    hideStatus();
  } catch (e) {
    render();
    handleError(e);
  }
}

async function toggle(id, done) {
  const block = blockOf(id);
  if (block) block.props = { ...block.props, checked: done };
  render();
  try {
    await api("task", { pageId: state.page.id, blockId: id, done });
    await refresh();
  } catch (e) {
    handleError(e);
    await refresh().catch(() => {});
  }
}

async function remove(id) {
  const blocks = state.page.blocks;
  const at = blocks.findIndex((b) => b.id === id);
  const block = blocks[at];
  if (!block) return;
  const nested = blocks[at + 1]?.depth > block.depth;
  if (nested && !confirm("Delete this block and everything inside it?")) return;
  // The block above at the same level, to put it back after (Undo).
  const before = blocks.slice(0, at).reverse().find((b) => b.depth === block.depth);
  try {
    await api("delete", { pageId: state.page.id, blockIds: [id] });
    await refresh();
    showStatus("Deleted.", "ok", {
      label: "Undo",
      run: async () => {
        await api("add", { pageId: state.page.id, markdown: block.markdown, ...(before && block.depth === 0 ? { position: "after", blockId: before.id } : { position: "end" }) });
        await refresh();
        hideStatus();
      },
    });
  } catch (e) {
    handleError(e);
  }
}

/* ---------- Writing a note ---------- */

const noteBox = $("note");
noteBox.addEventListener("input", () => {
  grow(noteBox);
  $("send").disabled = !noteBox.value.trim();
});
noteBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    void addNote();
  }
});
$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  void addNote();
});

async function addNote() {
  const markdown = noteBox.value.trim();
  if (!markdown) return;
  if (!state.page) {
    showStatus("Choose a page to write in first.", "error");
    return openPicker();
  }
  noteBox.disabled = true;
  try {
    await api("add", { pageId: state.page.id, markdown });
    noteBox.value = "";
    grow(noteBox);
    $("send").disabled = true;
    await refresh();
    window.scrollTo(0, document.body.scrollHeight);
  } catch (e) {
    handleError(e);
  } finally {
    noteBox.disabled = false;
    noteBox.focus();
  }
}

/* ---------- From the tab ---------- */

async function fromTab(func) {
  const tab = await activeTab();
  if (!tab?.id) throw new DovliError("There's no tab to read.");
  try {
    return await runInTab(tab.id, func);
  } catch (e) {
    const why = explainTabError(e);
    $("permission").hidden = !why.ask;
    throw new DovliError(why.text);
  }
}

/** While a job runs the tools wait, and the one clicked shows a spinner. */
function setTools(on, working = "") {
  state.working = !on;
  for (const id of ["clip", "notes", "add-selection"]) {
    $(id).disabled = !on;
    $(id).classList.toggle("working", !on && id === working);
  }
}

async function clip(mode) {
  if (state.working) return;
  setTools(false, mode === "notes" ? "notes" : "clip");
  showStatus(mode === "notes" ? "Reading the page and writing notes. This can take up to a minute." : "Clipping this page…", "busy");
  try {
    const page = await fromTab(capturePage);
    const made = await api("clip", { url: page.url, html: page.html, mode, today: today(), locale: navigator.language });
    await openPage(made.pageId);
    const look = state.page?.style?.name;
    showStatus(`${mode === "notes" ? "Notes ready" : "Clipped"}: “${made.title}”${look ? `, in the ${look} style` : ""}.`, "ok");
  } catch (e) {
    handleError(e);
  } finally {
    setTools(true);
  }
}

async function addSelection() {
  if (state.working) return;
  if (!state.page) {
    showStatus("Choose a page to add to first.", "error");
    return openPicker();
  }
  setTools(false, "add-selection");
  try {
    const sel = await fromTab(captureSelection);
    if (!sel) return showStatus("Select some text on the website first, then click Add selection.", "error");
    await api("addClip", { pageId: state.page.id, kind: "selection", pageUrl: sel.url, pageTitle: sel.title, html: sel.html, text: sel.text });
    await refresh();
    window.scrollTo(0, document.body.scrollHeight);
    showStatus("Added.", "ok");
  } catch (e) {
    handleError(e);
  } finally {
    setTools(true);
  }
}

$("clip").addEventListener("click", () => void clip("article"));
$("notes").addEventListener("click", () => void clip("notes"));
$("add-selection").addEventListener("click", () => void addSelection());
$("allow").addEventListener("click", async () => {
  const ok = await chrome.permissions.request({ origins: ["https://*/*", "http://*/*"] }).catch(() => false);
  $("permission").hidden = ok;
  if (ok) showStatus("Thanks. Click the button again.", "ok");
});

/* ---------- Following changes made elsewhere ---------- */

let polling = false;
async function poll() {
  if (polling || !state.page || state.editing || state.cursor === null || document.visibilityState !== "visible") return;
  polling = true;
  try {
    const r = await api("follow", { pageId: state.page.id, cursor: state.cursor });
    state.cursor = r.cursor;
    if (r.changed && !state.editing) await refresh();
  } catch (e) {
    if (e instanceof DovliError && e.status === 401) handleError(e);
    // Otherwise stay quiet: it tries again in a few seconds.
  } finally {
    polling = false;
  }
}
setInterval(poll, POLL_MS);
document.addEventListener("visibilitychange", poll);
window.addEventListener("focus", poll);

/* ---------- Status line ---------- */

function showStatus(text, tone = "", action) {
  toast($("status"), text, tone, action && { label: action.label, run: () => void action.run().catch(handleError) });
}
function hideStatus() {
  $("status").hidden = true;
}

/* ---------- Choosing a page ---------- */

let searchTimer = 0;
let searchSeq = 0;

function openPicker() {
  closeSheets();
  $("picker").hidden = false;
  $("pick").setAttribute("aria-expanded", "true");
  $("search").value = "";
  showResults(null);
  $("search").focus();
  // Recent pages change as you work, so look again.
  api("hello")
    .then((o) => {
      state.overview = o;
      if (!$("picker").hidden && !$("search").value.trim()) showResults(null);
    })
    .catch(() => {});
}

function closeSheets() {
  $("picker").hidden = true;
  $("settings").hidden = true;
  $("pick").setAttribute("aria-expanded", "false");
}

function item(page, extra = "") {
  const b = Object.assign(document.createElement("button"), { type: "button", className: "page-row" });
  b.append(Object.assign(document.createElement("span"), { className: "mark", textContent: page.icon || "¶" }), Object.assign(document.createElement("span"), { className: "t", textContent: page.title }));
  if (extra) b.append(Object.assign(document.createElement("span"), { className: "p", textContent: extra }));
  b.addEventListener("click", () => {
    closeSheets();
    void openPage(page.id);
  });
  return b;
}

function section(title, pages, extra) {
  const frag = document.createDocumentFragment();
  if (!pages?.length) return frag;
  frag.append(Object.assign(document.createElement("h3"), { textContent: title }));
  for (const p of pages) frag.append(item(p, extra?.(p)));
  return frag;
}

function showResults(found) {
  const box = $("results");
  const q = $("search").value.trim();
  box.replaceChildren();
  if (q) {
    const make = Object.assign(document.createElement("button"), { type: "button", className: "page-row new" });
    const mark = Object.assign(document.createElement("span"), { className: "mark" });
    mark.append(icon("page-plus", "i-sm"));
    make.append(mark, Object.assign(document.createElement("span"), { className: "t", textContent: `New page “${q}”` }));
    make.addEventListener("click", async () => {
      closeSheets();
      try {
        const made = await api("create", { title: q });
        await openPage(made.page_id);
      } catch (e) {
        handleError(e);
      }
    });
    box.append(make);
  }
  if (found) {
    box.append(section("Pages", found, (p) => p.path?.join(" / ") ?? ""));
    if (!found.length) box.append(Object.assign(document.createElement("p"), { className: "none", textContent: "No pages match. Press the row above to make one." }));
    return;
  }
  const o = state.overview ?? {};
  box.append(section("Recent", o.recent), section("Favourites", o.favorites));
  if (!o.recent?.length && !o.favorites?.length) box.append(Object.assign(document.createElement("p"), { className: "none", textContent: "Type a name to make your first page." }));
}

$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = $("search").value.trim();
  if (!q) return showResults(null);
  showResults(null);
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    try {
      const r = await api("search", { query: q });
      if (seq === searchSeq) showResults(r.results ?? []);
    } catch (e) {
      handleError(e);
    }
  }, 250);
});
$("pick").addEventListener("click", openPicker);
$("picker-close").addEventListener("click", closeSheets);
for (const id of ["picker", "settings"]) {
  $(id).addEventListener("click", (e) => e.target === $(id) && closeSheets());
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (!$("picker").hidden || !$("settings").hidden)) closeSheets();
});

/* ---------- Settings ---------- */

function openSettings() {
  closeSheets();
  const a = state.conn?.account;
  $("who-name").textContent = state.conn?.secret ? a?.name || "Connected" : "Not connected";
  $("who").textContent = state.conn?.secret ? (a?.email ?? state.conn.server) : "Connect to save into your Dovli.";
  $("server").value = state.conn?.server ?? DEFAULT_SERVER;
  $("disconnect").hidden = !state.conn?.secret;
  $("settings").hidden = false;
}

$("more").addEventListener("click", openSettings);
$("connect-settings").addEventListener("click", openSettings);
$("settings-close").addEventListener("click", closeSheets);

$("save-server").addEventListener("click", () => {
  let origin;
  try {
    origin = new URL($("server").value.trim() || DEFAULT_SERVER).origin;
  } catch {
    return showStatus("That isn't a web address.", "error");
  }
  if (origin === state.conn.server) return closeSheets();
  // Chrome only asks for a permission in direct answer to a click, so this comes first.
  const asked = origin === new URL(DEFAULT_SERVER).origin ? Promise.resolve(true) : chrome.permissions.request({ origins: [`${origin}/*`] });
  asked.then(async (ok) => {
    if (!ok) return;
    // A connection belongs to one Dovli, so a new address means connecting again.
    await chrome.storage.local.remove(["secret", "account", "pageId", "pageTitle"]);
    await chrome.storage.local.set({ server: origin });
    closeSheets();
  });
});

$("disconnect").addEventListener("click", async () => {
  await chrome.storage.local.remove(["secret", "account", "pageId", "pageTitle"]);
  closeSheets();
});

/* ---------- Connect ---------- */

$("connect").addEventListener("click", async () => {
  $("connect").disabled = true;
  const r = await chrome.runtime.sendMessage({ type: "start-connect", server: state.conn?.server }).catch(() => null);
  $("connect").disabled = false;
  $("connect-note").textContent = r?.ok ? "Finish in the Dovli tab that just opened: sign in if asked, then click Connect." : (r?.error ?? "Couldn't open Dovli. Please try again.");
});

/* ---------- Messages from the rest of the extension ---------- */

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    // A new address always comes with the secret removed, so the secret alone decides.
    if ("secret" in changes) return void start();
    if (changes.server && state.conn) state.conn.server = changes.server.newValue ?? DEFAULT_SERVER;
    const next = changes.pageId?.newValue;
    if (next && next !== state.page?.id && state.conn?.secret) void openPage(next);
  }
  if (area === "session" && changes.status?.newValue) {
    const s = changes.status.newValue;
    showStatus(s.text, s.tone);
  }
});
chrome.runtime.onMessage.addListener((m) => {
  if (m?.type === "refresh") void refresh().catch(() => {});
});

void start();
