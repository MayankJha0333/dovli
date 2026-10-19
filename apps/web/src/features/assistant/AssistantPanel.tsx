// The assistant panel: a conversation beside the page, like Craft's Assistant.
// Ask about the page, or ask it to write, restructure or tidy it. In Suggest mode the changes
// appear as a card to check and apply; in Edit mode they're made straight away. Either way one
// Undo (or ⌘Z in the page) takes the whole change back.

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { displayTitle, timeAgo } from "@dovli/core";
import { Button, Icon, IconButton, Segmented, cn, modKey, type IconName } from "@dovli/ui";
import { assistant, revealBlock, useAssistant, type Chat, type PageSelection, type Turn } from "@/lib/assistant";
import { changeTargets, describeChange, type ChangeKind } from "@/lib/assistantCore";
import { aiLabel, useAIUsage } from "@/lib/ai";
import { settings, useSettings } from "@/lib/settings";
import { store, useStore } from "@/lib/store";
import { useActiveEditor, useUI } from "@/lib/ui";

/* ---------------------------------------------------------------- a little Markdown for replies */

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**"))
      out.push(
        <strong key={m.index} className="font-semibold text-ink">
          {t.slice(2, -2)}
        </strong>,
      );
    else if (t.startsWith("`"))
      out.push(
        <code key={m.index} className="rounded-xs bg-well px-1 py-px font-mono text-[0.92em]">
          {t.slice(1, -1)}
        </code>,
      );
    else out.push(<em key={m.index}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Paragraphs, bullet and numbered lists, headings as bold lines. Never HTML. */
function Rich({ text }: { text: string }) {
  const groups: { kind: "p" | "ul" | "ol"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const kind = bullet ? "ul" : num ? "ol" : "p";
    const body = bullet?.[1] ?? num?.[1] ?? line.replace(/^#{1,6}\s+/, "");
    if (!line.trim()) {
      groups.push({ kind: "p", lines: [] });
      continue;
    }
    const prev = groups[groups.length - 1];
    if (prev && prev.kind === kind && (kind !== "p" || prev.lines.length)) prev.lines.push(/^#{1,6}\s/.test(line) ? `**${body}**` : body);
    else
      groups.push({
        kind,
        lines: [/^#{1,6}\s/.test(line) ? `**${body}**` : body],
      });
  }
  return (
    <div className="flex flex-col gap-2">
      {groups
        .filter((g) => g.lines.length)
        .map((g, i) =>
          g.kind === "p" ? (
            <p key={i} className="m-0">
              {g.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          ) : (
            (() => {
              const L = g.kind === "ul" ? "ul" : "ol";
              return (
                <L key={i} className={cn("m-0 flex flex-col gap-1 pl-5", g.kind === "ul" ? "list-disc" : "list-decimal")}>
                  {g.lines.map((l, j) => (
                    <li key={j}>{inline(l)}</li>
                  ))}
                </L>
              );
            })()
          ),
        )}
    </div>
  );
}

/* ---------------------------------------------------------------- the changes card */

const KIND: Record<ChangeKind, { icon: IconName; tone: string }> = {
  add: { icon: "plus", tone: "bg-accent-soft text-accent" },
  edit: { icon: "pencil", tone: "bg-well text-ink-2" },
  remove: { icon: "trash", tone: "bg-danger-soft text-danger" },
  move: { icon: "move", tone: "bg-well text-ink-2" },
  restructure: { icon: "outline", tone: "bg-accent-soft text-accent" },
  title: { icon: "textSize", tone: "bg-well text-ink-2" },
  page: { icon: "pagePlus", tone: "bg-accent-soft text-accent" },
  flowchart: { icon: "board", tone: "bg-accent-soft text-accent" },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Tick({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "mt-1.5 grid size-[18px] flex-none place-items-center rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        on ? "bg-accent text-accent-ink" : "bg-well text-transparent shadow-[inset_0_0_0_1.5px_var(--d-line-strong)]",
      )}
    >
      <Icon name="check" size={12} />
    </button>
  );
}

/** While the AI is still writing its changes: one placeholder row per change so far. */
function PreparingCard({ count }: { count: number }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[14px] bg-panel shadow-sm" role="status">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span className="grid size-7 flex-none place-items-center rounded-[9px] bg-accent-soft text-accent">
          <Icon name="wand" size={14} />
        </span>
        <span className="flex-1 text-sm font-semibold text-ink">Writing {plural(count, "change")}…</span>
      </div>
      <div className="flex flex-col gap-2 px-3.5 pb-3.5">
        {Array.from({ length: Math.min(count, 4) }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="size-7 flex-none animate-pulse rounded-[8px] bg-well" />
            <span className="h-3 flex-1 animate-pulse rounded-full bg-well" style={{ maxWidth: `${88 - i * 14}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangesCard({ turn }: { turn: Turn }) {
  const changes = turn.changes ?? [];
  const pending = turn.status === "pending";
  const off = new Set(turn.off ?? []);
  const chosen = changes.length - off.size;
  const [open, setOpen] = useState(pending);
  useEffect(() => setOpen(pending), [pending]);
  const canUndo = turn.status === "applied" && assistant.canUndo(turn.id);

  const head =
    turn.status === "applied"
      ? { title: "Changes made", chip: { icon: "check" as const, text: "Applied", tone: "text-ok" } }
      : turn.status === "undone"
        ? { title: "Changes undone", chip: { icon: "restore" as const, text: "Undone", tone: "text-ink-3" } }
        : turn.status === "discarded"
          ? { title: "Suggested changes", chip: { icon: "close" as const, text: "Not applied", tone: "text-ink-3" } }
          : { title: "Suggested changes", chip: null };

  return (
    <div className="mt-3 overflow-hidden rounded-[14px] bg-panel shadow-sm">
      <button
        type="button"
        onClick={() => !pending && setOpen((o) => !o)}
        aria-expanded={open}
        disabled={pending}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left enabled:hover:bg-hover"
      >
        <span className="grid size-7 flex-none place-items-center rounded-[9px] bg-accent-soft text-accent">
          <Icon name="wand" size={14} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-ink">{head.title}</span>
          <span className="text-xs text-ink-3">{pending ? `${plural(changes.length, "change")} · check them, then apply` : plural(changes.length, "change")}</span>
        </span>
        {head.chip && (
          <span className={cn("flex items-center gap-1 text-xs font-semibold", head.chip.tone)}>
            <Icon name={head.chip.icon} size={12} />
            {head.chip.text}
          </span>
        )}
        {!pending && <Icon name="chevronDown" size={14} className={cn("text-ink-3 transition-transform", open && "rotate-180")} />}
      </button>

      {open && (
        <ul className="m-0 flex list-none flex-col gap-0.5 px-1.5 pb-1.5">
          {changes.map((c, i) => {
            const d = describeChange(c);
            const k = KIND[d.kind];
            const on = !off.has(i);
            const target = changeTargets(c, turn.ids ?? [])[0];
            return (
              <li key={i} className={cn("group/change flex items-start gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-hover", !on && "opacity-55")}>
                {pending && <Tick on={on} label={`Include: ${d.label}`} onToggle={() => assistant.toggleChange(turn.id, i)} />}
                <span className={cn("mt-0.5 grid size-7 flex-none place-items-center rounded-[8px]", k.tone)} aria-hidden="true">
                  <Icon name={k.icon} size={14} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col py-0.5">
                  <span className="text-sm font-medium leading-snug text-ink">{d.label}</span>
                  {d.preview && <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-3">{d.preview}</span>}
                </span>
                {target && (
                  <IconButton
                    icon="eye"
                    label="Show in the page"
                    size="sm"
                    className="opacity-0 focus-visible:opacity-100 group-hover/change:opacity-100 [@media(hover:none)]:opacity-100"
                    onClick={() => revealBlock(target)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {turn.status !== "pending" && (turn.done?.length || turn.skipped?.length) ? (
        <ul className="m-0 flex list-none flex-col gap-1 px-3.5 pb-3 pt-1 text-xs">
          {turn.done?.map((t, i) => (
            <li key={`d${i}`} className="flex items-start gap-1.5 text-ink-2">
              <Icon name="check" size={12} className="mt-0.5 flex-none text-ok" />
              {t}
            </li>
          ))}
          {turn.skipped?.map((t, i) => (
            <li key={`s${i}`} className="flex items-start gap-1.5 text-warn">
              <Icon name="alert" size={12} className="mt-0.5 flex-none" />
              {t}
            </li>
          ))}
        </ul>
      ) : null}

      {pending && (
        <div className="flex items-center gap-2 border-t border-line px-3.5 py-2.5">
          <Button size="sm" variant="accent" icon="check" disabled={!chosen} onClick={() => assistant.apply(turn.id)}>
            {chosen === changes.length ? (changes.length > 1 ? "Apply all" : "Apply") : `Apply ${chosen}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => assistant.discard(turn.id)}>
            Discard
          </Button>
          {chosen !== changes.length && <span className="ml-auto text-xs text-ink-3">{chosen} of {changes.length}</span>}
        </div>
      )}
      {canUndo && (
        <div className="flex items-center gap-2 border-t border-line px-3.5 py-2.5">
          <Button size="sm" variant="secondary" icon="restore" onClick={() => assistant.undo(turn.id)}>
            Undo
          </Button>
          <span className="text-xs text-ink-3">or {modKey()}Z in the page</span>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- messages */

function Dots() {
  return (
    <span className="inline-flex gap-1 py-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="assistant-dot size-1.5 rounded-full bg-ink-3" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}

function Message({ turn }: { turn: Turn }) {
  if (turn.role === "user")
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] break-words rounded-[16px] rounded-br-[6px] bg-accent-soft px-3.5 py-2 text-base text-ink">
          {turn.quote && (
            <div className="mb-1.5 flex gap-1.5 border-l-2 border-accent pl-2 text-xs text-ink-2">
              <span className="line-clamp-3 whitespace-pre-wrap">{turn.quote}</span>
            </div>
          )}
          <span className="whitespace-pre-wrap">{turn.text}</span>
        </div>
      </div>
    );
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden="true"
        className={cn("mt-0.5 grid size-6 flex-none place-items-center rounded-full", turn.error ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent")}
      >
        <Icon name={turn.error ? "alert" : "sparkles"} size={13} />
      </span>
      <div className={cn("min-w-0 flex-1 break-words text-base leading-relaxed", turn.error ? "text-danger" : "text-ink-2")}>
        {turn.text ? <Rich text={turn.text} /> : turn.streaming ? <Dots /> : null}
        {turn.streaming ? (turn.preparing ? <PreparingCard count={turn.preparing} /> : turn.text ? <Dots /> : null) : turn.changes?.length ? <ChangesCard turn={turn} /> : null}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2.5" role="status" aria-label="The assistant is working">
      <span aria-hidden="true" className="grid size-6 flex-none place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name="sparkles" size={13} />
      </span>
      <Dots />
    </div>
  );
}

/* ---------------------------------------------------------------- the selection */

/** A block's words, without formatting. */
const blockText = (b: any): string =>
  (Array.isArray(b?.content) ? b.content : [])
    .map((c: any) => (c.type === "text" ? c.text : c.type === "link" ? (c.content ?? []).map((x: any) => x.text).join("") : (c.props?.title ?? "")))
    .join("")
    .trim();

/** Keep the assistant told about the text selected in the open page. */
function useTrackSelection(open: boolean) {
  const { editor, pageId } = useActiveEditor<any>();
  useEffect(() => {
    if (!open || !editor || !pageId) return;
    const read = () => {
      try {
        const picked: any[] = editor.getSelection()?.blocks ?? [];
        // Across several blocks, one line each (the editor would run them together).
        const text = picked.length > 1 ? picked.map(blockText).filter(Boolean).join("\n") : String(editor.getSelectedText() ?? "").trim();
        if (text) {
          const blocks = picked.length ? picked : [editor.getTextCursorPosition().block];
          assistant.setSelection({ pageId, text: text.slice(0, 4000), blockIds: blocks.map((b: any) => b.id) });
        } else if (editor.isFocused?.()) {
          assistant.setSelection(null); // clicked somewhere else in the page
        }
      } catch {
        /* the editor is changing pages */
      }
    };
    read();
    return editor.onSelectionChange(read);
  }, [open, editor, pageId]);
}

const FOR_SELECTION = [
  { label: "Flowchart", icon: "board", text: "Make this into a flowchart and put it right after it" },
  { label: "Rewrite", icon: "wand", text: "Rewrite this more clearly" },
  { label: "To-dos", icon: "checkbox", text: "Turn this into a to-do list" },
  { label: "Summarise", icon: "summary", text: "Summarise this in a few bullet points, right after it" },
] as const;

function SelectionChip({ selection, onAsk }: { selection: PageSelection; onAsk: (text: string) => void }) {
  const words = selection.text.split(/\s+/).filter(Boolean).length;
  return (
    <div className="mx-2 mt-2 rounded-[10px] bg-accent-soft px-2.5 pb-2 pt-1.5">
      <div className="flex items-center gap-1.5">
        <Icon name="alignLeft" size={12} className="text-accent" />
        <span className="flex-1 text-xs font-semibold text-accent">Selected text · {plural(words, "word")}</span>
        <IconButton icon="close" label="Don't use the selection" size="xs" onClick={() => assistant.setSelection(null)} />
      </div>
      <p className="m-0 mt-0.5 line-clamp-2 whitespace-pre-wrap border-l-2 border-accent pl-2 text-xs text-ink-2">{selection.text}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {FOR_SELECTION.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onAsk(a.text)}
            className="flex h-6 items-center gap-1 rounded-full bg-panel px-2 text-xs font-medium text-ink-2 shadow-sm transition-colors hover:text-ink"
          >
            <Icon name={a.icon} size={11} className="text-accent" />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- starting points */

const FOR_TEXT = [
  { icon: "summary", text: "Summarise this page at the top" },
  { icon: "outline", text: "Tidy up the structure with clear headings" },
  { icon: "check", text: "Fix spelling and grammar" },
  { icon: "checkbox", text: "Pull out the action items as to-dos" },
  { icon: "minus", text: "Make it shorter and clearer" },
  { icon: "translate", text: "Translate this page to Hindi" },
] as const;

const FOR_EMPTY = [
  { icon: "page", text: "Write a meeting notes template" },
  {
    icon: "outline",
    text: "Draft a project plan with goals, timeline and risks",
  },
  { icon: "checkbox", text: "Make a weekly planner with to-dos for each day" },
  { icon: "pencil", text: "Outline a blog post about " },
] as const;

function Start({ onPick }: { onPick: (text: string) => void }) {
  const page = useStore((s) => (s.route.name === "page" ? s.pages[s.route.id] : undefined));
  const empty = !page?.blocks?.some((b: any) => (Array.isArray(b.content) ? b.content.length : b.type !== "paragraph"));
  const list = !page || page.kind !== "doc" ? [] : empty ? FOR_EMPTY : FOR_TEXT;
  return (
    <div className="flex flex-col gap-5 px-1 pt-6">
      <div className="flex flex-col items-start gap-3">
        <span className="grid size-10 place-items-center rounded-[14px] bg-accent-soft text-accent">
          <Icon name="sparkles" size={20} />
        </span>
        <div>
          <h2 className="m-0 text-xl font-semibold tracking-tight text-ink">
            {!page || page.kind !== "doc" ? "Open a page to start" : empty ? "What should this page be?" : "How can I help with this page?"}
          </h2>
          <p className="m-0 mt-1 text-base text-ink-3">
            {!page || page.kind !== "doc"
              ? "The assistant works on the page you have open. You can still ask it anything."
              : "Ask a question, or tell it what to write, change or reorganise."}
          </p>
        </div>
      </div>
      {list.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {list.map((s) => (
            <li key={s.text}>
              <button
                type="button"
                onClick={() => onPick(s.text)}
                className="flex w-full items-center gap-2.5 rounded-md bg-panel px-3 py-2.5 text-left text-base text-ink shadow-sm transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-card"
              >
                <Icon name={s.icon} size={15} className="flex-none text-accent" />
                <span className="flex-1">{s.text.trim()}</span>
                <Icon name="arrowRight" size={13} className="text-ink-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- history */

function History({ onClose }: { onClose: () => void }) {
  const chats = useAssistant((s) => s.chats.filter((c) => c.turns.length));
  const current = useAssistant((s) => s.current);
  const pages = useStore((s) => s.pages);
  return (
    <div className="flex flex-col gap-1 py-2">
      <p className="m-0 px-1 pb-2 text-sm text-ink-3">Conversations from the last 30 days, kept on this device.</p>
      {!chats.length && <p className="m-0 px-1 text-base text-ink-3">No conversations yet.</p>}
      {chats.map((c: Chat) => {
        const page = c.pageId ? pages[c.pageId] : null;
        return (
          <div key={c.id} className={cn("group/chat flex items-center gap-1 rounded-md", c.id === current ? "bg-active" : "hover:bg-hover")}>
            <button
              type="button"
              onClick={() => {
                assistant.openChat(c.id);
                if (page && !page.deletedAt) store.navigate({ name: "page", id: page.id });
                onClose();
              }}
              className="flex min-w-0 flex-1 flex-col px-2.5 py-2 text-left"
            >
              <span className="truncate text-base font-medium text-ink">{c.title}</span>
              <span className="truncate text-xs text-ink-3">
                {page ? `${page.mark} ${displayTitle(page)}` : "No page"} · {timeAgo(c.updatedAt)}
              </span>
            </button>
            <IconButton
              icon="trash"
              label="Delete conversation"
              size="sm"
              className="mr-1 opacity-0 focus-visible:opacity-100 group-hover/chat:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={() => assistant.deleteChat(c.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- the panel */

export function AssistantPanel() {
  const open = useUI((s) => s.assistant);

  const busy = useAssistant((s) => s.busy);
  const mode = useSettings((s) => s.assistantMode);
  const usage = useAIUsage();
  const page = useStore((s) => (s.route.name === "page" ? s.pages[s.route.id] : undefined));
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // A conversation is about one page: each page shows its own recent one, or a fresh start.
  const pageId = page?.kind === "doc" && !page.deletedAt ? page.id : null;
  const shown = useAssistant(() => assistant.chatFor(pageId));
  const turns = shown?.turns ?? [];
  const selection = useAssistant((s) => s.selection);
  const sel = selection && selection.pageId === pageId ? selection : null;
  useTrackSelection(open);
  const streaming = turns.some((t) => t.streaming);
  const tail = turns[turns.length - 1];
  const tailKey = tail ? `${tail.id}:${tail.text.length}:${tail.preparing ?? 0}:${tail.status ?? ""}` : "";

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
    else setShowHistory(false);
  }, [open]);

  // Keep the newest message in view: jump for a new message, follow along while an answer streams
  // in, but leave the scroll alone when the person has scrolled up to read.
  const count = useRef(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const added = turns.length !== count.current;
    count.current = turns.length;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (added || near) el.scrollTo({ top: el.scrollHeight, behavior: added && turns.length > 1 ? "smooth" : "auto" });
  }, [turns.length, tailKey, busy, showHistory]);

  // Grow the box with the text, up to a point.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft, open]);

  if (!open) return null;

  const send = (text = draft) => {
    if (!text.trim() || busy) return;
    void assistant.send(text);
    setDraft("");
    setShowHistory(false);
  };
  const pick = (text: string) => {
    if (text.endsWith(" ")) {
      setDraft(text);
      requestAnimationFrame(() => {
        const el = input.current;
        el?.focus();
        el?.setSelectionRange(text.length, text.length);
      });
    } else send(text);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <aside
      aria-label="Assistant"
      data-print="hide"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          assistant.toggle(false);
        }
      }}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-shell shadow-shell surface-sidebar animate-assistant-in",
        // Narrower windows: the panel floats over the page instead of taking a column.
        "max-[1180px]:fixed max-[1180px]:bottom-[var(--d-shell-gap)] max-[1180px]:right-[var(--d-shell-gap)] max-[1180px]:top-[var(--d-shell-gap)] max-[1180px]:z-40 max-[1180px]:w-[min(380px,calc(100vw-24px))] max-[1180px]:shadow-pop max-[1180px]:[background:linear-gradient(var(--d-sidebar),var(--d-sidebar)),var(--d-bg)]",
        // Phones: the whole screen.
        "max-[860px]:inset-0 max-[860px]:z-50 max-[860px]:w-full max-[860px]:rounded-none max-[860px]:pb-[env(safe-area-inset-bottom)] max-[860px]:pt-[env(safe-area-inset-top)]",
      )}
    >
      <header className="flex h-14 flex-none items-center gap-1 pl-4 pr-2">
        <Icon name="sparkles" size={16} className="text-accent" />
        <h2 className="m-0 flex-1 text-md font-semibold text-ink">{showHistory ? "History" : "Assistant"}</h2>
        <IconButton icon="history" label="Conversation history" aria-pressed={showHistory} onClick={() => setShowHistory((h) => !h)} />
        <IconButton
          icon="pencil"
          label="New conversation"
          onClick={() => {
            assistant.newChat();
            setShowHistory(false);
            input.current?.focus();
          }}
        />
        <IconButton icon="close" label="Close assistant" shortcut={`${modKey()}J`} onClick={() => assistant.toggle(false)} />
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" aria-live="polite">
        {showHistory ? (
          <History onClose={() => setShowHistory(false)} />
        ) : turns.length ? (
          <div className="flex flex-col gap-5 pt-2">
            {turns.map((t) => (
              <Message key={t.id} turn={t} />
            ))}
            {busy && !streaming && <Thinking />}
          </div>
        ) : busy ? (
          <div className="pt-4">
            <Thinking />
          </div>
        ) : (
          <Start onPick={pick} />
        )}
      </div>

      <div className="flex-none px-3 pb-3">
        {page?.kind === "doc" && !page.deletedAt && (
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs text-ink-3">
            <span className="font-serif text-ink-4">{page.mark}</span>
            <span className="truncate">Working on “{displayTitle(page)}”</span>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="rounded-md bg-panel shadow-sm transition-shadow focus-within:shadow-[0_0_0_2px_var(--d-accent)]"
        >
          {sel && <SelectionChip selection={sel} onAsk={(text) => send(text)} />}
          <label htmlFor="assistant-input" className="sr-only">
            Message the assistant
          </label>
          <textarea
            id="assistant-input"
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            maxLength={4000}
            placeholder={sel ? "Ask about the selected text…" : page?.kind === "doc" ? "Ask or tell it what to change…" : "Ask anything…"}
            className="block max-h-[180px] w-full resize-none border-0 bg-transparent px-3 pb-1 pt-2.5 text-base text-ink outline-none placeholder:text-ink-4"
          />
          <div className="flex items-center gap-2 px-2 pb-2">
            <Segmented
              label="Assistant mode"
              value={mode}
              onValueChange={(v) => settings.set({ assistantMode: v })}
              options={[
                { value: "suggest", label: "Suggest" },
                { value: "edit", label: "Edit" },
              ]}
              className="[&_button]:h-6 [&_button]:px-2 [&_button]:text-xs"
            />
            <span className="flex-1" />
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              aria-label="Send"
              className="grid size-8 place-items-center rounded-full bg-accent text-accent-ink transition-[filter,opacity] hover:brightness-110 disabled:opacity-40"
            >
              <Icon name="arrowUp" size={16} />
            </button>
          </div>
        </form>
        <p className="m-0 mt-1.5 flex items-center gap-1 px-1 text-xs text-ink-4">
          <span className="truncate">{mode === "suggest" ? "You check changes before they're made." : "Changes are made straight away. Undo any time."}</span>
          <span className="ml-auto flex-none">{usage.loaded ? aiLabel(usage) : ""}</span>
        </p>
      </div>
    </aside>
  );
}
