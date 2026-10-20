// The toolbar popup: Dovli's clipper. Clip the tab as AI notes, its article, the whole page, the
// selection or a bookmark; give it a title, a place, tags and a remark; highlight on the page first.
// While the popup is open, the page outlines the part a clip takes (src/page.js). The background
// does the saving, so closing the popup doesn't stop it.

import { DovliError, activeTab, appUrl, api, connection, explainTabError, inPage, runInTab } from "./api.js";
import { captureSelection, pageDetails } from "./capture.js";
import { icon, toast } from "./ui.js";

const $ = (id) => document.getElementById(id);
const state = { conn: null, tab: null, selection: null, mode: "article", tags: [], busy: false };

// `small` clips go into the page chosen in "Save in"; the others become a new page inside it.
const KINDS = {
  notes: { about: "AI reads the outlined part and writes the gist, key points and details.", save: "Make AI notes", area: "region" },
  article: { about: "The main text, outlined on the page. No menus or ads.", save: "Save article", area: "region" },
  page: { about: "Everything on the page, sidebars and all.", save: "Save page", area: "page" },
  selection: { about: "", save: "Save selection", small: true },
  bookmark: { about: "A link card with the page's own summary of itself.", save: "Save bookmark", small: true },
};

async function start() {
  state.conn = await connection();
  if (!state.conn.secret) {
    $("connect-view").hidden = false;
    return;
  }
  $("app-view").hidden = false;
  $("who").textContent = state.conn.account?.email ?? "";
  $("open-app").href = appUrl(state.conn.server);
  void showShortcut();

  state.tab = await activeTab();
  showTab(state.tab, null);
  const fill = fillWhere();
  // Pages the browser keeps to itself (settings, the Web Store, new tabs) can't be read by any extension.
  let details = null;
  if (/^https?:/i.test(state.tab?.url ?? "")) {
    try {
      details = await runInTab(state.tab.id, pageDetails);
      state.selection = await runInTab(state.tab.id, captureSelection);
    } catch (e) {
      details = null;
      showStatus(explainTabError(e).text, "error");
    }
  } else showStatus("Chrome doesn't let extensions read this kind of page. Open a website to clip it.");
  if (!details) {
    $("clipper").inert = true;
    $("clipper").classList.add("busy");
    return;
  }
  showTab(state.tab, details);
  // The background tidies the page up (the outline) when the popup closes.
  chrome.runtime.connect({ name: "popup" }).postMessage({ tabId: state.tab.id });

  modeInput("selection").disabled = !state.selection;
  const text = state.selection?.text.replace(/\s+/g, " ").trim() ?? "";
  $("sel-preview").textContent = text.length > 280 ? `${text.slice(0, 280)}…` : text;
  const { mode } = await chrome.storage.local.get("mode");
  if (!(await fill)) return;
  void choose(state.selection ? "selection" : KINDS[mode] && mode !== "selection" ? mode : "article");
  void showHighlights();
  $("save").focus();
}

function showTab(tab, details) {
  let host = "";
  try {
    host = new URL(tab.url).hostname.replace(/^www\./, "");
  } catch {
    /* not a web address */
  }
  $("tab-host").textContent = host;
  $("title").value = tidyTitle(details?.title || tab?.title || "", details?.siteName ?? "", host);
  if (/^https:/i.test(tab?.favIconUrl ?? "")) {
    $("fav").src = tab.favIconUrl;
    $("fav").hidden = false;
    $("fav-fallback").hidden = true;
  }
}

/** "How to bake bread | The Kitchen" → "How to bake bread", like the server's cleanTitle. */
function tidyTitle(title, siteName, host) {
  let t = title.replace(/\s+/g, " ").trim();
  for (const name of [siteName, host].filter(Boolean)) {
    const site = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cut = t.replace(new RegExp(`\\s+[|\\-–—·•:]\\s+${site}$`, "i"), "").replace(new RegExp(`^${site}\\s+[|\\-–—·•:]\\s+`, "i"), "");
    if (cut) t = cut;
  }
  return t.slice(0, 200);
}

/* ---------- Clip as ---------- */

const modeInput = (mode) => document.querySelector(`input[name="mode"][value="${mode}"]`);

async function choose(mode) {
  state.mode = mode;
  modeInput(mode).checked = true;
  const kind = KINDS[mode];
  $("about").textContent = kind.about;
  $("about").hidden = !kind.about;
  $("sel-preview").hidden = mode !== "selection";
  $("focus").hidden = mode !== "notes";
  $("area").hidden = kind.area !== "region";
  update();
  if (mode !== "selection") chrome.storage.local.set({ mode }).catch(() => {});
  const area = await inPage(state.tab.id, "preview", kind.area ?? "none").catch(() => null);
  if (state.mode === mode) showArea(area);
}

function showArea(a) {
  $("area-words").textContent = a ? `${a.words.toLocaleString()} words outlined on the page` : "The outlined part of the page";
  $("shrink").disabled = !a?.canShrink;
  $("grow").disabled = !a?.canGrow;
}

for (const input of document.querySelectorAll('input[name="mode"]')) input.addEventListener("change", () => void choose(input.value));
$("shrink").addEventListener("click", async () => showArea(await inPage(state.tab.id, "shrink").catch(() => null)));
$("grow").addEventListener("click", async () => showArea(await inPage(state.tab.id, "grow").catch(() => null)));

/* ---------- Save in ---------- */

async function fillWhere() {
  const select = $("where");
  const { saveIn } = await chrome.storage.local.get("saveIn");
  const option = (p) => {
    const o = Object.assign(document.createElement("option"), { value: p.id, textContent: `${p.icon || "¶"} ${p.title}` });
    Object.assign(o.dataset, { title: p.title, icon: p.icon || "" });
    return o;
  };
  select.replaceChildren(Object.assign(document.createElement("option"), { value: "", textContent: "Top level" }));
  try {
    const o = await api("hello");
    const seen = new Set();
    for (const [name, pages] of [["Favorites", o.favorites ?? []], ["Recent", o.recent ?? []]]) {
      const group = Object.assign(document.createElement("optgroup"), { label: name });
      for (const p of pages) if (!seen.has(p.id) && seen.add(p.id)) group.append(option(p));
      if (group.children.length) select.append(group);
    }
    // The last place used, even when it's no longer recent.
    if (saveIn?.id && !seen.has(saveIn.id)) select.append(option(saveIn));
  } catch (e) {
    if (e instanceof DovliError && e.code === "disconnected") {
      $("app-view").hidden = true;
      $("connect-view").hidden = false;
      $("connect-note").textContent = e.message;
      return false;
    }
    showStatus(e.message, "error");
  }
  select.value = saveIn?.id ?? "";
  if (select.selectedIndex < 0) select.value = "";
  update();
  return true;
}

function target() {
  const o = $("where").selectedOptions[0];
  return o?.value ? { id: o.value, title: o.dataset.title, icon: o.dataset.icon } : null;
}

$("where").addEventListener("change", async () => {
  const t = target();
  if (t) await chrome.storage.local.set({ saveIn: t });
  else await chrome.storage.local.remove("saveIn");
  update();
});

/** What Save will do, in words, and the button to match. */
function update() {
  const t = target();
  const kind = KINDS[state.mode];
  const adding = !!t && kind.small;
  $("title").disabled = adding;
  $("where-hint").textContent = !t ? "A new page, at the top level." : adding ? `Added at the end of “${t.title}”.` : `A new page inside “${t.title}”.`;
  if (!state.busy) $("save").textContent = adding ? (state.mode === "selection" ? "Add selection" : "Add bookmark") : kind.save;
}

/* ---------- Tags ---------- */

function addTag(raw) {
  const tag = raw.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
  if (tag && !state.tags.includes(tag) && state.tags.length < 10) state.tags.push(tag);
  drawTags();
}

function drawTags() {
  const box = $("tags");
  const input = $("tag-input");
  box.querySelectorAll(".chip").forEach((c) => c.remove());
  for (const tag of state.tags) {
    const chip = Object.assign(document.createElement("span"), { className: "chip", textContent: `#${tag}` });
    const remove = Object.assign(document.createElement("button"), { type: "button", title: `Remove #${tag}` });
    remove.setAttribute("aria-label", `Remove tag ${tag}`);
    remove.append(icon("close"));
    remove.addEventListener("click", () => {
      state.tags = state.tags.filter((t) => t !== tag);
      drawTags();
      input.focus();
    });
    chip.append(remove);
    box.insertBefore(chip, input);
  }
  input.placeholder = state.tags.length ? "" : "Add tags";
}

$("tag-input").addEventListener("keydown", (e) => {
  const input = e.currentTarget;
  if ((e.key === "Enter" || e.key === "," || e.key === " ") && input.value.trim()) {
    e.preventDefault();
    addTag(input.value);
    input.value = "";
  } else if (e.key === "Backspace" && !input.value && state.tags.length) {
    state.tags.pop();
    drawTags();
  }
});
$("tag-input").addEventListener("blur", (e) => {
  if (!e.currentTarget.value.trim()) return;
  addTag(e.currentTarget.value);
  e.currentTarget.value = "";
});
$("tags").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) $("tag-input").focus();
});
$("remark").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    $("clipper").requestSubmit();
  }
});

/* ---------- Highlighter ---------- */

async function showHighlights() {
  const n = (await inPage(state.tab.id, "highlights").catch(() => 0)) ?? 0;
  $("highlight-label").textContent = n ? `Highlight · ${n}` : "Highlight";
  $("highlight").classList.toggle("on", n > 0);
}

// Highlighting happens on the page, which a click there would close the popup for anyway.
$("highlight").addEventListener("click", async () => {
  await inPage(state.tab.id, "clear").catch(() => null);
  await inPage(state.tab.id, "highlighter", true).catch(() => null);
  window.close();
});

/* ---------- Save ---------- */

$("clipper").addEventListener("submit", (e) => {
  e.preventDefault();
  void save();
});

async function save() {
  if (state.busy) return;
  if ($("tag-input").value.trim()) {
    addTag($("tag-input").value);
    $("tag-input").value = "";
  }
  busy(true);
  showStatus(state.mode === "notes" ? "Writing notes… You can close this: Dovli keeps going, and the drawer shows the page when it's ready." : "Saving…", "busy");
  const r = await chrome.runtime
    .sendMessage({
      type: "clip",
      tabId: state.tab.id,
      mode: state.mode,
      title: $("title").disabled ? "" : $("title").value.trim(),
      focus: state.mode === "notes" ? $("focus").value.trim() : "",
      tags: state.tags,
      remark: $("remark").value.trim(),
      where: target(),
    })
    .catch(() => null);
  busy(false);
  if (!r?.ok) return showStatus(r?.error ?? "Couldn't reach the extension. Please try again.", "error");
  hideStatus();
  $("clipper").hidden = true;
  $("result-text").textContent = r.added ? `Added to “${r.title}”` : `${state.mode === "notes" ? "Notes ready" : "Saved"}: “${r.title}”`;
  $("result-app").href = appUrl(state.conn.server, r.pageId);
  $("result").hidden = false;
  $("result-drawer").focus();
}

function busy(on) {
  state.busy = on;
  $("clipper").inert = on;
  $("clipper").classList.toggle("busy", on);
  if (on) $("save").replaceChildren(Object.assign(document.createElement("span"), { className: "spinner" }), "Saving…");
  else update();
}

// Chrome lets the drawer open only in direct answer to a click, so nothing is awaited first.
function openDrawer() {
  chrome.sidePanel.open({ windowId: state.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT }).then(() => window.close(), () => {});
}
$("drawer").addEventListener("click", openDrawer);
$("result-drawer").addEventListener("click", openDrawer);

async function showShortcut() {
  const cmd = (await chrome.commands.getAll()).find((c) => c.name === "open-drawer");
  $("drawer-key").textContent = cmd?.shortcut ?? "";
}

/* ---------- Connect ---------- */

$("connect").addEventListener("click", async () => {
  $("connect").disabled = true;
  const r = await chrome.runtime.sendMessage({ type: "start-connect", server: state.conn?.server }).catch(() => null);
  $("connect").disabled = false;
  $("connect-note").textContent = r?.ok ? "Finish in the Dovli tab that just opened." : (r?.error ?? "Couldn't open Dovli. Please try again.");
});

/* ---------- Status ---------- */

function showStatus(text, tone = "") {
  toast($("status"), text, tone);
}
function hideStatus() {
  $("status").hidden = true;
}

void start();
