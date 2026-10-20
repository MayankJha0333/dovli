// The extension's background: it does the clipping and adding for every surface (the toolbar popup,
// the right-click menu, the keyboard shortcut), so a long job like AI notes carries on even after
// the popup closes. It also finishes Connect, and greets people on install.

import { DEFAULT_SERVER, DovliError, api, connection, explainTabError, inPage, runInTab, today } from "./api.js";
import { capturePage, captureSelection, pageDetails } from "./capture.js";

// The toolbar button opens the popup (see manifest); the drawer opens from there, the shortcut, or
// the icon's own right-click menu. Set explicitly: Chrome remembers this setting across versions.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    const add = (id, title, contexts) => chrome.contextMenus.create({ id, title, contexts });
    add("selection", "Add selection to Dovli", ["selection"]);
    add("highlight", "Highlight with Dovli", ["selection"]);
    add("image", "Add image to Dovli", ["image"]);
    add("link", "Add link to Dovli", ["link"]);
    add("clip", "Clip this page to Dovli", ["page"]);
    add("notes", "Make AI notes of this page", ["page"]);
    add("drawer", "Open the Dovli drawer", ["action", "page"]);
  });
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});

// Known before any click, because Chrome only lets the drawer open in direct answer to one.
let connected = null;
connection().then((c) => (connected = !!c.secret));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "secret" in changes) connected = !!changes.secret.newValue;
});

function openDrawer(tab) {
  if (tab?.id) chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  else if (tab?.windowId) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-drawer") openDrawer(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "drawer") return openDrawer(tab);
  // Highlights live on the page until it reloads, and go into whatever is clipped from it.
  if (info.menuItemId === "highlight") return void inPage(tab.id, "highlightSelection").catch(() => {});
  const clipping = info.menuItemId === "clip" || info.menuItemId === "notes";
  // A new page shows in the drawer; small additions only get a tick on the icon.
  if (clipping || !connected) openDrawer(tab);
  if (connected === false) return; // the drawer asks them to connect
  void fromMenu(info, tab);
});

async function fromMenu(info, tab) {
  try {
    if (info.menuItemId === "clip" || info.menuItemId === "notes") {
      const made = await clipTab(tab.id, { mode: info.menuItemId === "notes" ? "notes" : "article" });
      return done(tab.id, `${info.menuItemId === "notes" ? "Notes ready" : "Clipped"}: “${made.title}”`);
    }
    let clip;
    if (info.menuItemId === "selection") {
      // The selection as HTML keeps its links and lists; Chrome's plain text is the fallback.
      const sel = await runInTab(tab.id, captureSelection).catch(() => null);
      clip = { kind: "selection", html: sel?.html ?? "", text: sel?.text || info.selectionText || "" };
    } else if (info.menuItemId === "image") clip = { kind: "image", src: info.srcUrl };
    else clip = { kind: "link", href: info.linkUrl, linkText: info.selectionText ?? "" };
    const title = await addToTarget({ ...clip, pageUrl: info.pageUrl || tab.url || "", pageTitle: tab.title || "" });
    done(tab.id, `Added to “${title}”`);
  } catch (e) {
    done(tab.id, problem(e).text, "error");
  }
}

/* ---------- The work ---------- */

function problem(e) {
  if (e instanceof DovliError) return { text: e.message, ask: false };
  if (/Cannot|permission|chrome:\/\//i.test(String(e?.message))) return explainTabError(e);
  return { text: "Couldn't do that. Please try again.", ask: false };
}

/**
 * Clip a tab (see KINDS in popup.js for the modes). Selections and bookmarks go at the end of the
 * page chosen in `where`; everything else becomes a new page, inside `where` when there is one.
 * The page it went to becomes the drawer's page. Returns { pageId, title, added }.
 */
async function clipTab(tabId, { mode, title = "", focus = "", tags = [], remark = "", where = null }) {
  status(mode === "notes" ? "Reading the page and writing notes. This can take up to a minute." : "Clipping the page…", "busy");
  badge(tabId, "…", "#6a55e8");
  let from;
  if (mode === "selection") {
    const sel = await runInTab(tabId, captureSelection);
    if (!sel) throw new DovliError("Select some text on the page first.");
    from = { url: sel.url, pageTitle: sel.title, html: sel.html, text: sel.text };
  } else if (mode === "bookmark") {
    const d = await runInTab(tabId, pageDetails);
    from = { url: d.url, pageTitle: d.title, siteName: d.siteName, description: d.description };
  } else {
    const page = await runInTab(tabId, capturePage, [mode === "page" ? "page" : "region"]);
    from = { url: page.url, html: page.html, region: page.region };
  }
  void runInTab(tabId, () => globalThis.__dovli?.clear()).catch(() => {});

  let result;
  if (where?.id && (mode === "selection" || mode === "bookmark")) {
    await api("addClip", { pageId: where.id, kind: mode, pageUrl: from.url, pageTitle: from.pageTitle, html: from.html, text: from.text, href: from.url, description: from.description, remark, tags });
    result = { pageId: where.id, title: where.title, added: true };
  } else {
    const made = await api("clip", { mode, ...from, title, focus, tags, remark, parentId: where?.id, today: today(), locale: navigator.language });
    result = { pageId: made.pageId, title: made.title, added: false };
  }
  await chrome.storage.local.set({ pageId: result.pageId, pageTitle: result.title });
  if (result.added) chrome.runtime.sendMessage({ type: "refresh" }).catch(() => {});
  return result;
}

/** Add to the page in the drawer, or to a "Web clips" page made the first time. Returns its title. */
async function addToTarget(clip) {
  const { pageId } = await chrome.storage.local.get("pageId");
  if (pageId) {
    try {
      await api("addClip", { pageId, ...clip });
      chrome.runtime.sendMessage({ type: "refresh" }).catch(() => {});
      return (await chrome.storage.local.get("pageTitle")).pageTitle || "your page";
    } catch (e) {
      // The page was deleted or moved to the trash meanwhile: fall through and make a new one.
      if (!(e instanceof DovliError && e.status === 400 && /no page|trash/i.test(e.message))) throw e;
    }
  }
  const made = await api("create", { title: "Web clips", icon: "📎" });
  await chrome.storage.local.set({ pageId: made.page_id, pageTitle: "Web clips" });
  await api("addClip", { pageId: made.page_id, ...clip });
  return "Web clips";
}

function done(tabId, text, tone = "ok") {
  status(text, tone);
  badge(tabId, tone === "ok" ? "✓" : "!", tone === "ok" ? "#2f9e44" : "#e03131");
}

function status(text, tone) {
  chrome.storage.session.set({ status: { text, tone, at: Date.now() } }).catch(() => {});
}

function badge(tabId, text, color) {
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (text !== "…") setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {}), 2500);
}

/* ---------- Messages: the popup asks for work, the Dovli page finishes Connect ---------- */

// The popup outlines the part of the page a clip takes; when it closes, the outline goes too.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "popup") return;
  let tabId = null;
  port.onMessage.addListener((m) => (tabId = m?.tabId ?? null));
  port.onDisconnect.addListener(() => {
    if (tabId) runInTab(tabId, () => globalThis.__dovli?.clear()).catch(() => {});
  });
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const answer = (work) => {
    work.then(reply, (e) => {
      const p = problem(e);
      reply({ ok: false, error: p.text, ask: p.ask });
    });
    return true;
  };
  switch (msg?.type) {
    case "clip":
      return answer(
        clipTab(msg.tabId, msg).then((made) => {
          done(msg.tabId, made.added ? `Added to “${made.title}”` : `${msg.mode === "notes" ? "Notes ready" : "Clipped"}: “${made.title}”`);
          return { ok: true, ...made };
        }).catch((e) => {
          done(msg.tabId, problem(e).text, "error");
          throw e;
        }),
      );
    case "start-connect":
      return answer(startConnect(msg.server).then(() => ({ ok: true })));
    case "connected":
      finishConnect(msg, sender).then(reply);
      return true;
  }
});

/* ---------- Connect ---------- */

// Connect opens Dovli at /app?connect=extension&nonce=…; once signed in, the person approves there,
// and Dovli's page hands the connection's secret to src/connect.js, which this injects into that tab.
// The nonce, kept only in this browser session, proves the answer belongs to this request.

async function startConnect(server) {
  const origin = new URL(server || DEFAULT_SERVER).origin;
  const nonce = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await chrome.storage.session.set({ pending: { nonce, origin, at: Date.now() } });
  // Only when it changed: the drawer starts over whenever the address is written.
  if ((await chrome.storage.local.get("server")).server !== origin) await chrome.storage.local.set({ server: origin });
  await chrome.tabs.create({ url: `${origin}/app?connect=extension&nonce=${nonce}` });
}

// Sign-in may pass through other pages first, so every Dovli app page that loads while connecting gets the script.
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== "complete" || !tab.url) return;
  const { pending } = await chrome.storage.session.get("pending");
  if (!pending || Date.now() - pending.at > 15 * 60_000) return;
  let url;
  try {
    url = new URL(tab.url);
  } catch {
    return;
  }
  if (url.origin !== pending.origin || !url.pathname.startsWith("/app")) return;
  chrome.scripting.executeScript({ target: { tabId }, files: ["src/connect.js"] }).catch(() => {});
});

async function finishConnect(msg, sender) {
  const { pending } = await chrome.storage.session.get("pending");
  if (!pending || msg.nonce !== pending.nonce || sender.origin !== pending.origin)
    return { ok: false, error: "The extension didn't ask for this connection. Click Connect in the extension again." };
  if (typeof msg.secret !== "string" || !/^dvl_[A-Za-z0-9_-]{20,64}$/.test(msg.secret)) return { ok: false, error: "Dovli sent something the extension didn't understand." };
  const account = { name: typeof msg.account?.name === "string" ? msg.account.name : null, email: typeof msg.account?.email === "string" ? msg.account.email : null };
  await chrome.storage.local.set({ server: pending.origin, secret: msg.secret, account });
  await chrome.storage.session.remove("pending");
  // Back to the page they were reading: the Dovli tab has done its job.
  if (sender.tab?.id) setTimeout(() => chrome.tabs.remove(sender.tab.id).catch(() => {}), 1800);
  return { ok: true };
}
