// The top-right of a page, like Craft: a Share button, then one group with Aa (format),
// Style and Info. Each opens a panel beside the page that stays out of the way of the text.

import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import type { DovliEditor } from "@dovli/editor";
import type { Page } from "@dovli/core";
import { Icon, PopoverContent, PopoverRoot, PopoverTrigger, Tooltip, cn, modKey, type IconName } from "@dovli/ui";
import { useAuth } from "@/lib/auth";
import { share, sharingOn } from "@/lib/share";
import { ui, useUI } from "@/lib/ui";
import { FormatPanel } from "./FormatPanel";
import { InfoPanel } from "./InfoPanel";
import { StylePanel } from "./StylePanel";

type PanelId = "format" | "style" | "info";

const ToolButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName; label: string; active?: boolean }>(function ToolButton(
  { icon, label, active, children, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid h-8 min-w-9 place-items-center rounded-md px-2 text-ink-2 transition-colors hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active && "bg-hover text-ink",
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={17} /> : children}
    </button>
  );
});

/** Whether a page is shared (people or a link), remembered per page for this visit. */
const shareState = new Map<string, { people: number; link: "viewer" | "editor" | null }>();

/** Who can see this page, in a sentence, for the Share button's tooltip. */
function useShareState(page: Page) {
  const signedIn = useAuth((s) => s.status === "signed-in");
  const shareOpen = useUI((s) => s.share);
  const [state, setState] = useState(() => shareState.get(page.id) ?? null);
  const wasOpen = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    setState(shareState.get(page.id) ?? null);
    const justClosed = wasOpen.current === page.id && shareOpen === null;
    wasOpen.current = shareOpen;
    // Check once per page per visit, and again right after its Share window closes.
    if (!sharingOn || !signedIn || page.kind !== "doc" || shareOpen) return;
    if (shareState.has(page.id) && !justClosed) return;
    share.settings(page.id).then(
      (s) => {
        const v = { people: s.people.filter((p) => p.role !== "owner").length, link: s.link?.enabled ? s.link.role : null };
        shareState.set(page.id, v);
        if (live) setState(v);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [page.id, page.kind, signedIn, shareOpen]);
  const shared = !!state && (state.people > 0 || !!state.link);
  const who = state?.people ? `${state.people} ${state.people === 1 ? "person has" : "people have"} access` : "";
  const viaLink = state?.link ? (state.link === "editor" ? "anyone with the link can edit" : "anyone with the link can view") : "";
  const tip = shared ? `${[who, viaLink].filter(Boolean).join(", and ").replace(/^./, (c) => c.toUpperCase())}. Click to change.` : "Only you can access this page. Click to share it or export it.";
  return { shared, tip };
}

export function PageToolbar({ page, editor, onFind, onPresent }: { page: Page; editor: DovliEditor | null; onFind: () => void; onPresent: () => void }) {
  const [open, setOpen] = useState<PanelId | null>(null);
  const { shared, tip } = useShareState(page);
  const isDoc = page.kind === "doc";

  // ⌘⇧I opens Info and ⌘⇧Y opens Style (Ctrl on Windows and Linux).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "i") {
        e.preventDefault();
        setOpen((o) => (o === "info" ? null : "info"));
      } else if (k === "y" && isDoc) {
        e.preventDefault();
        setOpen((o) => (o === "style" ? null : "style"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDoc]);

  const panel = (id: PanelId, trigger: React.ReactElement, body: React.ReactNode, keepEditorFocus = false) => (
    <PopoverRoot open={open === id} onOpenChange={(o) => setOpen(o ? id : null)} modal={false}>
      <Tooltip label={id === "format" ? "Format" : id === "style" ? "Style" : "Info"} shortcut={id === "info" ? `${modKey()}⇧I` : id === "style" ? `${modKey()}⇧Y` : undefined}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={10}
        aria-label={id === "format" ? "Format" : id === "style" ? "Style" : "Info"}
        className="w-[min(360px,calc(100vw-24px))] max-h-[calc(100dvh-84px)] overflow-y-auto overscroll-contain rounded-xl p-4"
        // The format panel works on the text, so the cursor stays in the page while it is open,
        // and clicking back into the page doesn't close it.
        onOpenAutoFocus={keepEditorFocus ? (e) => e.preventDefault() : undefined}
        // On close, go back to writing rather than to the button (whose tooltip would pop up).
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          (document.querySelector(".bn-editor") as HTMLElement | null)?.focus({ preventScroll: true });
        }}
        onInteractOutside={
          keepEditorFocus
            ? (e) => {
                const t = e.target as HTMLElement | null;
                if (t?.closest?.(".bn-editor, .bn-formatting-toolbar, [data-page-toolbar]")) e.preventDefault();
              }
            : undefined
        }
      >
        {body}
      </PopoverContent>
    </PopoverRoot>
  );

  return (
    <div data-page-toolbar className="flex items-center gap-2" data-print="hide">
      <Tooltip label={tip}>
        <button
          type="button"
          onClick={() => ui.set({ share: page.id })}
          className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-ink surface-chip transition-colors hover:bg-hover max-[640px]:px-2.5"
        >
          <Icon name={shared ? "link" : "lock"} size={15} />
          <span className="max-[480px]:sr-only">{shared ? "Shared" : "Share"}</span>
        </button>
      </Tooltip>
      <div className="flex h-9 items-center gap-0.5 rounded-full px-1 surface-chip">
        {isDoc &&
          panel(
            "format",
            <ToolButton label="Format" active={open === "format"} className="font-display text-[15px] font-semibold" onMouseDown={(e) => e.preventDefault()}>
              Aa
            </ToolButton>,
            <FormatPanel page={page} editor={editor} />,
            true,
          )}
        {isDoc && panel("style", <ToolButton icon="brush" label="Style" active={open === "style"} />, <StylePanel page={page} />)}
        {panel("info", <ToolButton icon="info" label="Info" active={open === "info"} />, <InfoPanel page={page} onFind={onFind} onPresent={onPresent} close={() => setOpen(null)} />)}
      </div>
    </div>
  );
}
