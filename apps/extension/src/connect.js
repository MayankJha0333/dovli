// Injected into Dovli's own app page while the extension is connecting (see background.js). When the
// person approves, the page posts the connection here; this passes it to the extension and tells the
// page how it went.

if (!window.__dovliConnect) {
  window.__dovliConnect = true;
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (e.source !== window || e.origin !== location.origin || d?.source !== "dovli" || d.type !== "extension-connect") return;
    chrome.runtime.sendMessage({ type: "connected", nonce: d.nonce, secret: d.secret, account: d.account }, (res) => {
      const error = res?.error ?? (chrome.runtime.lastError ? "The extension didn't answer. Reload it and try again." : undefined);
      window.postMessage({ source: "dovli-extension", nonce: d.nonce, ok: !!res?.ok, error }, location.origin);
    });
  });
}
