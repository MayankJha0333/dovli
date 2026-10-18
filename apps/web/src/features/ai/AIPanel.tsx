import { useEffect, useState } from "react";
import { pageText, type Page } from "@dovli/core";
import { Button, Dialog, Icon, Input, Spinner, cn, toast, type IconName } from "@dovli/ui";
import { runAI, useAIUsage, type AIAction } from "@/lib/ai";
import { store } from "@/lib/store";
import { getActiveEditor, ui, useUI } from "@/lib/ui";

const ACTIONS: { id: AIAction; label: string; icon: IconName }[] = [
  { id: "improve", label: "Improve writing", icon: "wand" },
  { id: "fix", label: "Fix spelling and grammar", icon: "check" },
  { id: "shorten", label: "Make shorter", icon: "minus" },
  { id: "longer", label: "Make longer", icon: "plus" },
  { id: "friendly", label: "Friendlier tone", icon: "user" },
  { id: "professional", label: "More professional", icon: "page" },
  { id: "continue", label: "Continue writing", icon: "arrowRight" },
];

const LANGUAGES = ["English", "Hindi", "Spanish", "French", "German", "Portuguese", "Japanese", "Chinese (Simplified)", "Arabic", "Bengali", "Marathi", "Tamil"];

/** Open the AI panel to summarise a whole page; the summary can go at the top as a callout. */
export function summarizePage(page: Page) {
  const text = pageText(page).trim();
  if (!text) return toast("This page has no text to summarise yet.");
  ui.set({
    ai: {
      mode: "summary",
      text,
      replace: () => {},
      insertAfter: (summary: string) => {
        const editor = getActiveEditor();
        const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
        const intro = lines.filter((l) => !l.startsWith("- ")).join(" ");
        const points = lines.filter((l) => l.startsWith("- ")).map((l) => ({ type: "bulletListItem", content: l.slice(2) }));
        const blocks = [{ type: "callout", props: { tone: "tip", emoji: "✨" }, content: `Summary: ${intro}` }, ...points, { type: "paragraph" }];
        if (editor && store.get().route.name === "page" && (store.get().route as any).id === page.id) {
          const first = editor.document[0];
          if (first) editor.insertBlocks(blocks, first.id, "before");
          else editor.replaceBlocks([], blocks);
        } else {
          store.updatePage(page.id, { blocks: [...(blocks as any[]), ...(page.blocks ?? [])] });
        }
      },
    },
  });
}

export function AIPanel() {
  const session = useUI((s) => s.ai);
  const usage = useAIUsage();
  const [busy, setBusy] = useState<AIAction | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("English");
  const [instruction, setInstruction] = useState("");
  const [last, setLast] = useState<AIAction | null>(null);

  const close = () => {
    ui.set({ ai: null });
    setResult("");
    setError("");
    setBusy(null);
    setInstruction("");
  };

  const run = async (action: AIAction) => {
    if (!session) return;
    setBusy(action);
    setError("");
    setLast(action);
    try {
      setResult(await runAI(action, session.text, { language, instruction }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI couldn't finish that.");
    } finally {
      setBusy(null);
    }
  };

  // Summaries start straight away.
  useEffect(() => {
    if (session?.mode === "summary") void run("summarize");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const pct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const summary = session?.mode === "summary";

  return (
    <Dialog
      open={!!session}
      onOpenChange={(o) => !o && close()}
      title={summary ? "Summary" : "Ask AI"}
      description={summary ? "A short summary of this page." : "Choose what to do with the selected text. You'll see the result before anything changes."}
      size="md"
      footer={
        <div className="mr-auto flex items-center gap-2 text-xs text-ink-3">
          <Icon name="sparkles" size={13} />
          {usage.limit ? `${pct}% of this month's AI used` : "AI usage"}
          <button type="button" className="text-accent hover:underline" onClick={() => ui.set({ ai: null, settings: "ai" })}>
            Details
          </button>
        </div>
      }
    >
      {!summary && session && (
        <blockquote className="m-0 mb-4 line-clamp-4 rounded-md border-l-[3px] border-line-strong bg-well px-3 py-2 text-sm text-ink-2">{session.text || "Nothing selected"}</blockquote>
      )}

      {!result && !summary && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1.5 max-[520px]:grid-cols-1">
            {ACTIONS.map((a) => (
              <Button key={a.id} variant="secondary" className="justify-start" icon={a.icon} disabled={!!busy || !session?.text} onClick={() => run(a.id)}>
                {busy === a.id ? "Working…" : a.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <select
              aria-label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border-0 bg-well px-2.5 text-base text-ink shadow-sm outline-none focus:shadow-[0_0_0_2px_var(--d-accent)]"
            >
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <Button icon="translate" disabled={!!busy || !session?.text} onClick={() => run("translate")}>
              {busy === "translate" ? "Translating…" : "Translate"}
            </Button>
          </div>
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (instruction.trim()) void run("custom");
            }}
          >
            <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Or tell AI what to do, like “turn into a list”" aria-label="Instruction for AI" />
            <Button type="submit" variant="primary" disabled={!!busy || !instruction.trim() || !session?.text}>
              Go
            </Button>
          </form>
        </div>
      )}

      {busy && (summary || result) && (
        <div className="flex items-center gap-2 py-6 text-sm text-ink-3">
          <Spinner /> Writing…
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {result && !busy && (
        <div className="flex flex-col gap-3">
          <div className={cn("max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-accent-soft px-3.5 py-3 text-base leading-relaxed text-ink")} aria-live="polite">
            {result}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!summary && (
              <Button
                variant="primary"
                icon="check"
                onClick={() => {
                  session?.replace(result);
                  toast("Replaced");
                  close();
                }}
              >
                Replace selection
              </Button>
            )}
            <Button
              variant={summary ? "primary" : "secondary"}
              icon="arrowDown"
              onClick={() => {
                session?.insertAfter(result);
                toast(summary ? "Summary added to the top" : "Added below");
                close();
              }}
            >
              {summary ? "Add to the top of the page" : "Insert below"}
            </Button>
            <Button
              variant="ghost"
              icon="copy"
              onClick={async () => {
                await navigator.clipboard.writeText(result).catch(() => {});
                toast("Copied");
              }}
            >
              Copy
            </Button>
            <Button variant="ghost" icon="restore" onClick={() => last && run(last)}>
              Try again
            </Button>
            {!summary && (
              <Button variant="ghost" onClick={() => setResult("")}>
                Back
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
