// Talking to Dovli (POST /api/extension on the Dovli server). The server's address and this
// extension's connection secret live in chrome.storage.local, set when the person clicks Connect.

export const DEFAULT_SERVER = "https://dovli.in";

export async function connection() {
  const { server = DEFAULT_SERVER, secret = null, account = null } = await chrome.storage.local.get(["server", "secret", "account"]);
  return { server, secret, account };
}

export class DovliError extends Error {
  constructor(message, status = 0, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(action, params = {}) {
  const { server, secret } = await connection();
  if (!secret) throw new DovliError("Connect the extension to Dovli first.", 401, "disconnected");
  let res;
  try {
    res = await fetch(`${server}/api/extension`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ action, ...params }),
    });
  } catch {
    throw new DovliError("Couldn't reach Dovli. Check your internet connection.", 0, "offline");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401: the secret was rotated or deleted, so it's useless now. (403 only means switched off for a while.)
    if (res.status === 401 && data.code === "disconnected") await chrome.storage.local.remove(["secret", "account"]);
    throw new DovliError(data.error || "Something went wrong in Dovli. Please try again.", res.status, data.code || "");
  }
  return data;
}

/** The address of a page in the Dovli app. */
export const appUrl = (server, pageId) => `${server}/app${pageId ? `#p-${pageId}` : ""}`;

/** Today on this device, as YYYY-MM-DD (the server writes "saved 20 Oct 2026" from it). */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The tab the person is looking at, in the window this page belongs to. */
export async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

/** Run a function inside a tab and return what it returns. */
export async function runInTab(tabId, func, args = []) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result?.result;
}

/** Ask Dovli's helper inside a tab (src/page.js: the clip area, the highlighter) to do something. */
export async function inPage(tabId, command, arg = null) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["src/page.js"] });
  return runInTab(tabId, (c, a) => globalThis.__dovli?.[c]?.(a) ?? null, [command, arg]);
}

/** Why a tab couldn't be read, in words, and whether asking for permission would help. */
export function explainTabError(e) {
  const msg = String(e?.message ?? e);
  if (/chrome:\/\/|chrome-extension:|edge:\/\/|webstore|extensions gallery|devtools/i.test(msg)) return { text: "Chrome doesn't let extensions read this kind of page.", ask: false };
  if (/permission|Cannot access contents/i.test(msg)) return { text: "Dovli needs your permission to read this page.", ask: true };
  if (/Frame with ID 0 was removed|No tab with id/i.test(msg)) return { text: "That tab closed or changed. Try again.", ask: false };
  return { text: "Dovli couldn't read this page. Reload it and try again.", ask: false };
}
