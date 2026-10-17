import { useEffect, useRef, useState } from "react";
import { store } from "@/lib/store";
import type { Page } from "@dovli/core";

export const MARKS = ["¶", "§", "✦", "✳", "⁂", "❡", "◐", "☾", "◇", "△", "○", "☐", "⌘", "✎", "★", "☼", "⚑", "∞", "♪", "✿"];

export function MarkPicker({ page, size = "lg" }: { page: Page; size?: "lg" | "sm" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="mark-picker" ref={ref}>
      <button
        type="button"
        className={`page-mark page-mark--${size}`}
        aria-label="Change page icon"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {page.mark}
      </button>
      {open && (
        <div className="mark-grid" role="listbox" aria-label="Page icons">
          {MARKS.map((m) => (
            <button
              key={m}
              type="button"
              role="option"
              aria-selected={m === page.mark}
              className={m === page.mark ? "is-active" : ""}
              onClick={() => {
                store.updatePage(page.id, { mark: m });
                setOpen(false);
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
