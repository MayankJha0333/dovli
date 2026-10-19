// The top-right of a page, like Craft: a Share button, then one group with Aa (format),
// Style and Info. Each opens the same glass panel, flush right under the group.

import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import type { DovliEditor } from "@dovli/editor";
import type { Page } from "@dovli/core";
import { Icon, PopoverAnchor, PopoverContent, PopoverRoot, Tooltip, cn, modKey, type IconName } from "@dovli/ui";
import { useAuth } from "@/lib/auth";
import { share, sharingOn } from "@/lib/share";
import { ui, useUI } from "@/lib/ui";
import { FormatPanel } from "./FormatPanel";
import { InfoPanel } from "./InfoPanel";
import { StylePanel } from "./StylePanel";

type PanelId = "format" | "style" | "info";

const ToolButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: IconName;
    label: string;
    active?: boolean;
  }
>(function ToolButton({ icon, label, active, children, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid h-7 min-w-8 place-items-center rounded-full px-2 text-ink transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
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
        const v = {
          people: s.people.filter((p) => p.role !== "owner").length,
          link: s.link?.enabled ? s.link.role : null,
        };
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
  const tip = shared
    ? `${[who, viaLink]
        .filter(Boolean)
        .join(", and ")
        .replace(/^./, (c) => c.toUpperCase())}. Click to change.`
    : "Only you can access this page. Click to share it or export it.";
  return { shared, tip };
}

export function PageToolbar({ page, editor, onFind, onPresent }: { page: Page; editor: DovliEditor | null; onFind: () => void; onPresent: () => void }) {
  const [open, setOpen] = useState<PanelId | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
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

  const LABEL: Record<PanelId, string> = {
    format: "Format",
    style: "Style",
    info: "Info",
  };
  const SHORTCUT: Partial<Record<PanelId, string>> = {
    info: `${modKey()}⇧I`,
    style: `${modKey()}⇧Y`,
  };
  const toggle = (id: PanelId) => setOpen((o) => (o === id ? null : id));
  const trigger = (id: PanelId, button: React.ReactElement) => (
    <Tooltip label={LABEL[id]} shortcut={SHORTCUT[id]}>
      {button}
    </Tooltip>
  );

  return (
    <div data-page-toolbar className="flex items-center gap-2" data-print="hide">
      <Tooltip label={tip}>
        <button
          type="button"
          onClick={() => ui.set({ share: page.id })}
          className="flex h-9 items-center gap-1.5 px-3.5 text-[13px] font-semibold text-ink chrome-pill transition-[filter] hover:brightness-[0.97] max-[640px]:px-2.5"
        >
          <Icon name={shared ? "link" : "lock"} size={15} />
          <span className="max-[480px]:sr-only">{shared ? "Shared" : "Share"}</span>
        </button>
      </Tooltip>
      {/* One popover for the group, anchored to the group's right edge (like Craft): Format, Style
          and Info all open in the same place, flush right under the buttons, whichever was pressed. */}
      <PopoverRoot open={open !== null} onOpenChange={(o) => !o && setOpen(null)} modal={false}>
        <PopoverAnchor asChild>
          <div className="flex h-9 items-center gap-0.5 px-1 chrome-pill">
            {isDoc &&
              trigger(
                "format",
                <ToolButton
                  label="Format"
                  active={open === "format"}
                  aria-expanded={open === "format"}
                  aria-haspopup="dialog"
                  className="text-[15px] font-semibold"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle("format")}
                >
                  Aa
                </ToolButton>,
              )}
            {isDoc &&
              trigger(
                "style",
                <ToolButton icon="brush" label="Style" active={open === "style"} aria-expanded={open === "style"} aria-haspopup="dialog" onClick={() => toggle("style")} />,
              )}
            {trigger(
              "info",
              <ToolButton icon="info" label="Info" active={open === "info"} aria-expanded={open === "info"} aria-haspopup="dialog" onClick={() => toggle("info")} />,
            )}
          </div>
        </PopoverAnchor>
        {open && (
          <PopoverContent
            key={open}
            glass
            align="end"
            sideOffset={9}
            aria-label={LABEL[open]}
            data-page-panel={open}
            className="w-[min(300px,calc(100vw-24px))] max-h-[calc(var(--radix-popover-content-available-height)-4px)] overflow-y-auto overscroll-contain p-3.5"
            // The format panel works on the text, so the cursor stays in the page while it is open,
            // and clicking back into the page doesn't close it.
            onOpenAutoFocus={open === "format" ? (e) => e.preventDefault() : undefined}
            // On close, go back to writing rather than to the button (whose tooltip would pop up).
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              // Switching to another panel (Format → Style) also unmounts this one: leave focus to the new one.
              if (openRef.current) return;
              (document.querySelector(".bn-editor") as HTMLElement | null)?.focus({ preventScroll: true });
            }}
            onInteractOutside={(e) => {
              const t = e.target as HTMLElement | null;
              // The toolbar's own buttons switch or close the panel themselves.
              if (t?.closest?.("[data-page-toolbar]")) return e.preventDefault();
              if (open === "format" && t?.closest?.(".bn-editor, .bn-formatting-toolbar")) e.preventDefault();
            }}
          >
            {open === "format" && <FormatPanel page={page} editor={editor} />}
            {open === "style" && <StylePanel page={page} />}
            {open === "info" && <InfoPanel page={page} onFind={onFind} onPresent={onPresent} close={() => setOpen(null)} />}
          </PopoverContent>
        )}
      </PopoverRoot>
    </div>
  );
}
