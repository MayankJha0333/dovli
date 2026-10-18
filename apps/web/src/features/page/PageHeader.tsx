import { useEffect, useRef, useState } from "react";
import type { Page } from "@dovli/core";
import { COVER_PRESETS, coverPreset } from "@dovli/theme";
import { Button, Input, PopoverContent, PopoverRoot, PopoverTrigger, Segmented, cn, toast } from "@dovli/ui";
import { resolveFileUrl, saveFile } from "@/lib/files";
import { store } from "@/lib/store";
import { defaultMark, hasOwnIcon, isEmoji } from "./PageIcon";

export { PageIconGlyph, defaultMark, hasOwnIcon, isEmoji } from "./PageIcon";

export const MARKS = ["¶", "§", "✦", "✳", "⁂", "❡", "◐", "☾", "◇", "△", "○", "☐", "⌘", "✎", "★", "☼", "⚑", "∞", "♪", "✿", "❖", "✧", "◆", "⌂"];
export const EMOJI = [
  "📝", "📌", "📎", "📚", "📖", "🗂️", "🗓️", "✅", "💡", "🎯", "🚀", "⭐", "🔥", "✨", "🌱", "🌿",
  "🌸", "🍀", "🌊", "☀️", "🌙", "☕", "🍳", "🍕", "🏠", "✈️", "🧭", "🗺️", "🏝️", "⛰️", "💼", "📈",
  "📊", "💰", "🧾", "🛒", "🎁", "🎨", "🎵", "🎬", "📷", "🎮", "💻", "📱", "🧪", "🔬", "🧠", "🩺",
  "❤️", "😊", "🙌", "👋", "🤝", "🎉", "🏃", "🧘", "🏋️", "⚽", "🐶", "🐱", "🦊", "🐝", "🔒", "🔑",
];

/* ------------------------------------------------------------------ */
/* Icon                                                                */
/* ------------------------------------------------------------------ */

/** The icon picker: emoji or marks, any emoji you paste, or no icon. */
export function IconPicker({ page, trigger }: { page: Page; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "marks">(isEmoji(page.mark) || !hasOwnIcon(page) ? "emoji" : "marks");
  const [typed, setTyped] = useState("");
  const pick = (m: string) => {
    store.updatePage(page.id, { mark: m });
    setOpen(false);
    setTyped("");
  };
  const cell = "grid size-9 place-items-center rounded-sm text-[22px] leading-none transition-colors hover:bg-hover aria-selected:bg-active";
  const list = tab === "emoji" ? EMOJI : MARKS;
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[340px] p-2.5" align="start">
        <div className="mb-2 flex items-center gap-2">
          <Segmented
            label="Icon kind"
            value={tab}
            onValueChange={setTab}
            options={[
              { value: "emoji", label: "Emoji" },
              { value: "marks", label: "Marks" },
            ]}
          />
          {hasOwnIcon(page) && (
            <Button size="sm" variant="ghost" icon="trash" className="ml-auto text-ink-3" onClick={() => pick(defaultMark(page.kind))}>
              Remove icon
            </Button>
          )}
        </div>
        <div role="listbox" aria-label={tab === "emoji" ? "Emoji" : "Marks"} className="grid max-h-[232px] grid-cols-8 gap-0.5 overflow-y-auto">
          {list.map((m) => (
            <button key={m} type="button" role="option" aria-selected={m === page.mark} aria-label={m} className={cn(cell, tab === "marks" && "font-serif text-lg text-accent")} onClick={() => pick(m)}>
              {m}
            </button>
          ))}
        </div>
        {tab === "emoji" && (
          <form
            className="mt-2.5 flex gap-1.5 border-t border-line pt-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              const first = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(typed.trim())][0]?.segment ?? "";
              if (first && isEmoji(first)) pick(first);
              else toast("Paste or type one emoji, like 🪴", { tone: "danger" });
            }}
          >
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or paste any emoji" aria-label="Any emoji" className="h-9" />
            <Button type="submit" size="sm" variant="secondary" className="h-9">
              Use
            </Button>
          </form>
        )}
      </PopoverContent>
    </PopoverRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Cover                                                               */
/* ------------------------------------------------------------------ */

export function useCoverSrc(cover: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!cover || cover.startsWith("g:")) return setSrc(null);
    const url = cover.startsWith("file:") ? `dovli-file://${cover.slice(5)}` : cover;
    void resolveFileUrl(url).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [cover]);
  return src;
}

export function CoverPicker({ page, trigger }: { page: Page; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const set = (cover: string | null) => {
    store.updatePage(page.id, { cover });
    setOpen(false);
  };
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[340px]" align="start">
        <p className="label-text m-0 pb-2">Gradients</p>
        <div className="grid grid-cols-4 gap-2">
          {COVER_PRESETS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.name}
              title={c.name}
              onClick={() => set(`g:${c.id}`)}
              className={cn("h-12 rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-transform hover:scale-[1.03]", page.cover === `g:${c.id}` && "ring-2 ring-[var(--d-accent)] ring-offset-2 ring-offset-[var(--d-raised)]")}
              style={{ background: c.css }}
            />
          ))}
        </div>
        <p className="label-text m-0 pb-2 pt-4">Your own picture</p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const url = await saveFile(f);
              set(`file:${url.replace("dovli-file://", "")}`);
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn't add that picture.", { tone: "danger" });
            }
          }}
        />
        <div className="flex gap-2">
          <Button icon="upload" onClick={() => input.current?.click()}>
            Upload
          </Button>
          <form
            className="flex min-w-0 flex-1 gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^https?:\/\//i.test(link.trim())) set(link.trim());
              else toast("Paste a full image address starting with https://", { tone: "danger" });
            }}
          >
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste a link" aria-label="Image address" className="h-9" />
          </form>
        </div>
        {page.cover && (
          <Button variant="dangerGhost" size="sm" className="mt-3" icon="trash" onClick={() => set(null)}>
            Remove cover
          </Button>
        )}
      </PopoverContent>
    </PopoverRoot>
  );
}

/**
 * The cover: a full-width banner along the top of the page. "full" spans the whole page area;
 * "sheet" sits on the top edge of a styled page's paper. Hover (or tap) shows Change and Remove.
 */
export function Cover({ page, variant = "full", editable = true }: { page: Page; variant?: "full" | "sheet"; editable?: boolean }) {
  const preset = coverPreset(page.cover);
  const src = useCoverSrc(page.cover);
  if (!page.cover) return null;
  return (
    <div
      data-print="cover"
      className={cn(
        "group/cover relative w-full flex-none overflow-hidden bg-well",
        variant === "full" ? "h-[clamp(150px,26vh,260px)]" : "h-[clamp(140px,24vh,240px)] rounded-t-sheet",
      )}
      style={preset ? { background: preset.css } : undefined}
    >
      {src && <img src={src} alt="" className="size-full object-cover" />}
      {editable && (
        <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/cover:opacity-100 [@media(hover:none)]:opacity-100" data-print="hide">
          <CoverPicker page={page} trigger={<Button size="sm" className="surface-raised">Change cover</Button>} />
          <Button size="sm" className="surface-raised" onClick={() => store.updatePage(page.id, { cover: null })}>
            Remove cover
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Title                                                               */
/* ------------------------------------------------------------------ */

export function TitleField({ page, onEnter, className, readOnly }: { page: Page; onEnter: () => void; className?: string; readOnly?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(resize, [page.title, page.id, page.style, page.look?.font]);
  // Grow or shrink with the text whenever the box's width changes (window size, wide page,
  // sidebar shown or hidden) or the page's font finishes loading.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        resize();
      }
    });
    watch.observe(el);
    void document.fonts?.ready.then(resize);
    return () => watch.disconnect();
  }, []);
  return (
    <textarea
      id="page-title"
      ref={ref}
      rows={1}
      readOnly={readOnly}
      value={page.title}
      placeholder={page.kind === "board" ? "Untitled board" : "Untitled"}
      aria-label="Page title"
      onChange={(e) => store.updatePage(page.id, { title: e.target.value.replace(/\n/g, "") })}
      onKeyDown={(e) => {
        // Enter, or ↓ / → at the end of the title, carries on into the page.
        const el = e.currentTarget;
        const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
        const arrowOut = page.kind === "doc" && (e.key === "ArrowDown" || e.key === "ArrowRight") && atEnd && !e.shiftKey;
        if (e.key === "Enter" || arrowOut) {
          if (e.nativeEvent.isComposing) return;
          e.preventDefault();
          onEnter();
        }
      }}
      className={cn(
        "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-ink outline-none placeholder:text-line-strong",
        "font-[family-name:var(--title-font,var(--d-font-display))] [font-style:var(--title-style,normal)] [font-weight:var(--title-weight,var(--d-display-weight))] tracking-[var(--d-display-tracking)] text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.1] [text-wrap:balance]",
        className,
      )}
    />
  );
}
