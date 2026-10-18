import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "./cn";
import { Icon } from "./Icon";

// A tiny toast system: toast("Saved") from anywhere, and one <Toaster /> near the root.

interface ToastItem {
  id: number;
  message: string;
  tone: "default" | "danger";
  action?: { label: string; onClick: () => void };
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, opts: { tone?: ToastItem["tone"]; action?: ToastItem["action"]; duration?: number } = {}) {
  const item: ToastItem = { id: ++seq, message, tone: opts.tone ?? "default", action: opts.action };
  items = [...items.slice(-2), item];
  emit();
  window.setTimeout(() => dismiss(item.id), opts.duration ?? (opts.action ? 6000 : 3200));
  return item.id;
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
    () => items,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-[500] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex max-w-full items-center gap-3 rounded-md bg-ink py-2 pl-4 pr-2 text-sm font-medium text-bg shadow-pop animate-pop-in",
            t.tone === "danger" && "bg-danger text-white",
          )}
        >
          <span className="min-w-0">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="h-7 rounded-sm px-2.5 text-sm font-semibold text-accent-ink bg-accent hover:bg-accent-hover"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" className="grid size-7 place-items-center rounded-sm opacity-70 hover:opacity-100" onClick={() => dismiss(t.id)}>
            <Icon name="close" size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
