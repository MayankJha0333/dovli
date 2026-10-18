import { useEffect, useRef, useState } from "react";
import type { Page } from "@dovli/core";
import { COVER_PRESETS, coverPreset } from "@dovli/theme";
import { Button, Icon, Input, PopoverContent, PopoverRoot, PopoverTrigger, cn, toast } from "@dovli/ui";
import { resolveFileUrl, saveFile } from "@/lib/files";
import { store } from "@/lib/store";

export const MARKS = ["¶", "§", "✦", "✳", "⁂", "❡", "◐", "☾", "◇", "△", "○", "☐", "⌘", "✎", "★", "☼", "⚑", "∞", "♪", "✿"];
export const EMOJI = [
  "📝", "📌", "📎", "📚", "📖", "🗂️", "🗓️", "✅", "💡", "🎯", "🚀", "⭐", "🔥", "🌱", "🌿", "🌸",
  "🍀", "☕", "🍳", "🏠", "✈️", "🧭", "🗺️", "🏝️", "💼", "📈", "💰", "🧾", "🛒", "🎁", "🎨", "🎵",
  "🎬", "📷", "💻", "🧪", "🔬", "🧠", "❤️", "😊", "🙌", "👋", "🤝", "🏃", "🧘", "🏋️", "🐶", "🐱",
];

/* ------------------------------------------------------------------ */
/* Icon                                                                */
/* ------------------------------------------------------------------ */

export function IconPicker({ page, size = "lg" }: { page: Page; size?: "lg" | "sm" }) {
  const [open, setOpen] = useState(false);
  const pick = (m: string) => {
    store.updatePage(page.id, { mark: m });
    setOpen(false);
  };
  const cell = "grid size-9 place-items-center rounded-sm text-lg hover:bg-hover aria-selected:bg-active aria-selected:text-active-ink";
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change page icon"
          className={cn(
            "grid place-items-center bg-accent-soft font-serif text-accent transition-transform hover:brightness-95 active:scale-[0.97]",
            size === "lg" ? "mb-4 size-[60px] rounded-lg text-[30px] max-[640px]:size-[52px] max-[640px]:text-[26px]" : "size-9 rounded-sm text-lg",
          )}
        >
          {page.mark}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[332px] p-2.5">
        <p className="label-text m-0 px-1 pb-1.5">Marks</p>
        <div role="listbox" aria-label="Marks" className="grid grid-cols-8 gap-0.5">
          {MARKS.map((m) => (
            <button key={m} type="button" role="option" aria-selected={m === page.mark} className={cn(cell, "font-serif")} onClick={() => pick(m)}>
              {m}
            </button>
          ))}
        </div>
        <p className="label-text m-0 px-1 pb-1.5 pt-3">Emoji</p>
        <div role="listbox" aria-label="Emoji" className="grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto">
          {EMOJI.map((m) => (
            <button key={m} type="button" role="option" aria-selected={m === page.mark} className={cell} onClick={() => pick(m)}>
              {m}
            </button>
          ))}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Cover                                                               */
/* ------------------------------------------------------------------ */

function useCoverSrc(cover: string | null | undefined) {
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

export function Cover({ page }: { page: Page }) {
  const preset = coverPreset(page.cover);
  const src = useCoverSrc(page.cover);
  if (!page.cover) return null;
  return (
    <div className="group/cover relative mb-6 h-[200px] overflow-hidden rounded-xl max-[640px]:h-[140px]" style={preset ? { background: preset.css } : undefined}>
      {src && <img src={src} alt="" className="size-full object-cover" />}
      <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/cover:opacity-100 [@media(hover:none)]:opacity-100" data-print="hide">
        <CoverPicker page={page} trigger={<Button size="sm" className="surface-raised">Change cover</Button>} />
      </div>
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
  useEffect(resize, [page.title, page.id]);
  useEffect(() => {
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
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
