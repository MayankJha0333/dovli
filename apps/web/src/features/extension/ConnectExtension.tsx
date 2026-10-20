"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Icon, Spinner } from "@dovli/ui";
import { aiApps } from "@/lib/aiApps";
import { useAuth } from "@/lib/auth";
import { ui, useUI } from "@/lib/ui";

// The browser extension's Connect button opens /app?connect=extension&nonce=…. Approving here makes
// (or re-keys) its connection, the same kind AI apps use, and hands the secret to the extension's
// script on this page. The nonce proves the hand-over answers that extension's own request.
const NAME = "Dovli for Chrome";
const NONCE = /^[A-Za-z0-9_-]{16,64}$/;

/** Opens the Connect window when the page was opened by the extension's Connect button. */
export function takeConnectRequest() {
  const q = new URLSearchParams(location.search);
  const nonce = q.get("nonce") ?? "";
  if (q.get("connect") !== "extension" || !NONCE.test(nonce)) return;
  q.delete("connect");
  q.delete("nonce");
  history.replaceState(history.state, "", `${location.pathname}${q.size ? `?${q}` : ""}${location.hash}`);
  ui.set({ connectExtension: nonce });
}

type Step = "ask" | "working" | "done" | "no-extension" | "error";

export function ConnectExtensionDialog() {
  const nonce = useUI((s) => s.connectExtension);
  const status = useAuth((a) => a.status);
  const account = useAuth((a) => a.account);
  const [step, setStep] = useState<Step>("ask");
  const [error, setError] = useState("");
  const wait = useRef<number | null>(null);

  useEffect(() => {
    if (!nonce) return;
    setStep("ask");
    setError("");
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (e.source !== window || e.origin !== location.origin || d?.source !== "dovli-extension" || d.nonce !== nonce) return;
      if (wait.current) window.clearTimeout(wait.current);
      if (d.ok) setStep("done");
      else {
        setError(typeof d.error === "string" ? d.error : "The extension couldn't save the connection.");
        setStep("error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (wait.current) window.clearTimeout(wait.current);
    };
  }, [nonce]);

  async function connect() {
    setStep("working");
    setError("");
    try {
      // Re-key the extension's connection if there is one, so connecting again doesn't use up another.
      const { connections } = await aiApps.list();
      const mine = connections.find((x) => x.name === NAME);
      const { url } = mine ? await aiApps.rotate(mine.id) : await aiApps.create({ name: NAME, app: "other", scope: "all", permission: "edit" });
      if (mine && (!mine.enabled || mine.scope !== "all" || mine.permission !== "edit")) await aiApps.update(mine.id, { enabled: true, scope: "all", permission: "edit" });
      const secret = url.split("/api/mcp/")[1] ?? "";
      window.postMessage({ source: "dovli", type: "extension-connect", nonce, secret, account: { name: account?.name ?? null, email: account?.email ?? null } }, location.origin);
      wait.current = window.setTimeout(() => setStep("no-extension"), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  const close = () => ui.set({ connectExtension: null });
  const signedIn = status === "signed-in";

  return (
    <Dialog
      open={!!nonce}
      onOpenChange={(o) => !o && close()}
      title="Connect the Dovli extension"
      size="sm"
      footer={
        step === "done" ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {signedIn && (
              <Button variant="primary" icon="plug" onClick={() => void connect()} disabled={step === "working"}>
                {step === "working" ? "Connecting…" : step === "ask" ? "Connect" : "Try again"}
              </Button>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-3 text-sm text-ink-2">
        {step === "done" ? (
          <p className="m-0 flex items-start gap-2">
            <Icon name="check" size={18} className="mt-px flex-none text-accent" />
            <span>
              Connected. You can close this tab and go back to the page you were on: the Dovli side panel is ready.
            </span>
          </p>
        ) : !signedIn ? (
          status === "loading" ? (
            <Spinner label="Checking your sign-in" />
          ) : (
            <p className="m-0">The extension saves into your Dovli account, so it needs you to be signed in{status === "local-only" ? ", and this copy of Dovli runs without accounts" : ""}.</p>
          )
        ) : (
          <>
            <p className="m-0">
              The extension will be able to <strong>read your pages and add to them</strong>, as {account?.email ?? "you"}. You can clip web pages, make AI notes, and write in a page beside the website you're on.
            </p>
            <p className="m-0 text-ink-3">It shows in Settings → AI apps as “{NAME}”, where you can switch it off or remove it any time.</p>
          </>
        )}
        {step === "working" && (
          <p className="m-0 flex items-center gap-2 text-ink-3">
            <Spinner label="Connecting" /> Connecting…
          </p>
        )}
        {step === "no-extension" && (
          <p role="alert" className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-danger">
            The extension didn't answer. Check it's installed and switched on in Chrome, then click Connect in the extension again.
          </p>
        )}
        {step === "error" && error && (
          <p role="alert" className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
