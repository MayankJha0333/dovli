"use client";

import { useEffect, useRef, useState } from "react";
import { getStyle } from "@dovli/theme";
import { Button, Dialog, Field, Input, Segmented, Spinner, toast, type IconName } from "@dovli/ui";
import { aiLabel, allowanceLeft, useAIUsage } from "@/lib/ai";
import { useAuth } from "@/lib/auth";
import { makePageFromLink, type LinkNotesMode } from "@/lib/linkNotes";
import { store } from "@/lib/store";
import { ui, useUI } from "@/lib/ui";

const MODES: Record<LinkNotesMode, { label: string; icon: IconName; hint: string; action: string; busy: string }> = {
  notes: {
    label: "Notes",
    icon: "sparkles",
    hint: "AI reads the page and writes notes: the gist, the key points, and the details under headings.",
    action: "Make notes",
    busy: "Reading the page and writing notes. This can take up to a minute.",
  },
  article: {
    label: "Full article",
    icon: "page",
    hint: "The page's own text, cleaned up: no menus, ads or comments. No AI.",
    action: "Save article",
    busy: "Reading the page…",
  },
};

/** "Notes from a link": paste a web page's address, and get a page of notes (or the article itself). */
export function LinkNotesDialog() {
  const target = useUI((s) => s.linkNotes);
  const usage = useAIUsage();
  const signedOut = useAuth((a) => a.status === "signed-out");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<LinkNotesMode>("notes");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!target) return;
    setUrl(target.url ?? "");
    setFocus("");
    setError("");
  }, [target]);

  const close = () => {
    running.current?.abort();
    ui.set({ linkNotes: null });
  };

  // From sign-in itself, not the AI status, which can be older than the sign-in.
  const needsSignIn = signedOut;
  const aiProblem =
    // reason "sign-in" while signed in is an answer from before sign-in finished; a fresh one is on its way.
    mode !== "notes" || !usage.loaded || needsSignIn || usage.reason === "sign-in"
      ? ""
      : !usage.available
        ? "AI isn't set up here yet. Connect your own AI key, or choose Full article."
        : !allowanceLeft()
          ? "You've used this month's Dovli AI allowance. It resets on the 1st. You can still save the full article."
          : "";

  async function submit() {
    if (busy || needsSignIn || aiProblem) return;
    if (!url.trim()) return setError("Paste a link first.");
    const ctrl = new AbortController();
    running.current = ctrl;
    setBusy(true);
    setError("");
    try {
      const page = await makePageFromLink(url.trim(), { mode, focus: mode === "notes" ? focus : "", parentId: target?.parentId ?? null, signal: ctrl.signal });
      ui.set({ linkNotes: null });
      store.navigate({ name: "page", id: page.id });
      const look = getStyle(page.style)?.name;
      toast(`${mode === "notes" ? "Notes ready" : "Saved"}: “${page.title}”${look ? `, in the ${look} style` : ""}`, {
        action: { label: "Change style", onClick: () => ui.set({ styleFor: page.id }) },
      });
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      if (running.current === ctrl) running.current = null;
      setBusy(false);
    }
  }

  const m = MODES[mode];
  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => !o && close()}
      title="Notes from a link"
      description="Paste the address of a web page. Dovli reads it and makes a page from it."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="link-notes-form" icon={m.icon} disabled={busy || needsSignIn || !!aiProblem || !url.trim()}>
            {busy ? "Working…" : m.action}
          </Button>
        </>
      }
    >
      <form
        id="link-notes-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Link">
          {(p) => (
            <Input
              {...p}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              placeholder="https://…"
              value={url}
              disabled={busy}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <Segmented<LinkNotesMode>
            label="What to make"
            value={mode}
            onValueChange={(v) => {
              setMode(v);
              setError("");
            }}
            className="self-start"
            options={(Object.keys(MODES) as LinkNotesMode[]).map((k) => ({ value: k, label: MODES[k].label, icon: MODES[k].icon }))}
          />
          <p className="m-0 text-sm text-ink-3">
            {m.hint}
            {mode === "notes" && usage.loaded && usage.available && <> Uses {aiLabel(usage)}.</>}
          </p>
        </div>

        {mode === "notes" && (
          <Field label="Anything to focus on?" hint="Optional. The notes still only use what the page says.">
            {(p) => <Input {...p} maxLength={300} placeholder="e.g. the setup steps, the main arguments, the prices" value={focus} disabled={busy} onChange={(e) => setFocus(e.target.value)} />}
          </Field>
        )}

        {needsSignIn && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-well p-3 text-sm text-ink-2">
            <span className="min-w-0 flex-1">Sign in to make pages from links.</span>
            <Button variant="primary" size="sm" onClick={() => ui.set({ linkNotes: null, signIn: true })}>
              Sign in
            </Button>
          </div>
        )}
        {aiProblem && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-well p-3 text-sm text-ink-2">
            <span className="min-w-0 flex-1">{aiProblem}</span>
            {!usage.available && (
              <Button size="sm" onClick={() => ui.set({ linkNotes: null, settings: "ai" })}>
                Set up AI
              </Button>
            )}
          </div>
        )}

        {busy && (
          <p className="m-0 flex items-center gap-2 text-sm text-ink-3">
            <Spinner label="Working" />
            {m.busy}
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
