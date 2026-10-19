import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import "@/lib/excalidraw";
import { connectEditor } from "@dovli/editor";
import { PageIconGlyph, hasOwnIcon } from "@/features/page/PageIcon";
import { displayTitle, fileIdFromUrl, type Page } from "@dovli/core";
import { coverPreset, resolveLook } from "@dovli/theme";
import { Button, DovliMark, Icon, Pill, Spinner, Toaster, TooltipProvider, cn, toast } from "@dovli/ui";
import { auth, initAuth } from "@/lib/auth";
import { applySettings } from "@/lib/settings";
import { share } from "@/lib/share";

const PageEditor = lazy(() => import("@dovli/editor/page-editor"));

/** Which shared page: one shared with you by invite, or one opened through a link. */
export type SharedSource = { workspaceId: string; pageId: string } | { linkId: string };
type Loaded = { role: "owner" | "editor" | "viewer"; signInToEdit: boolean; ownerName: string; page: Page };

// A tiny store for the one shared page, so the editor bridge can read it like the real app.
let current: Page | null = null;
let currentMap: Record<string, Page> = {};
const EMPTY: Record<string, Page> = {};
const subs = new Set<() => void>();
const setCurrent = (p: Page) => {
  current = p;
  currentMap = { [p.id]: p };
  subs.forEach((s) => s());
};

/** Wait until we know whether this browser is signed in (so a signed-in editor gets edit access). */
function authSettled(): Promise<void> {
  initAuth();
  return new Promise((resolve) => {
    if (auth.get().status !== "loading") return resolve();
    const off = auth.subscribe(() => {
      if (auth.get().status !== "loading") {
        off();
        resolve();
      }
    });
  });
}

/**
 * A page someone shared: by invite (only the invited people) or by link (anyone with it).
 * Viewers read it; editors change it, and each change is saved back to the owner's page.
 */
export default function SharedPage({ source }: { source: SharedSource }) {
  const [state, setState] = useState<Loaded | "missing" | null>(null);
  const [saving, setSaving] = useState<"saved" | "saving" | "error">("saved");
  const rev = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const key = JSON.stringify(source);

  async function load() {
    try {
      const r = await share.open(source);
      // Your own page: open it in your workspace instead.
      if (r.role === "owner" && "pageId" in source) return location.replace(`/#p-${encodeURIComponent(r.pageId)}`);
      rev.current = r.rev;
      setCurrent(r.page);
      setState({ role: r.role, signInToEdit: r.signInToEdit, ownerName: r.ownerName, page: r.page });
      setSaving("saved");
      document.title = `${displayTitle(r.page)} · Dovli`;
    } catch {
      setState("missing");
    }
  }

  useEffect(() => {
    applySettings();
    void authSettled().then(load);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = typeof state === "object" && (state?.role === "editor" || state?.role === "owner");

  // Plug this page into the shared editor.
  useMemo(() => {
    connectEditor({
      usePages: (select) =>
        useSyncExternalStore(
          (l) => {
            subs.add(l);
            return () => subs.delete(l);
          },
          () => select(currentMap),
          () => select(EMPTY),
        ),
      getPages: () => currentMap,
      openPage: () => toast("Only this page is shared."),
      createPage: () => {
        throw new Error("Not available on a shared page");
      },
      saveBlocks: (_id, blocks) => {
        if (!current || !editable) return;
        setCurrent({ ...current, blocks });
        setSaving("saving");
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(async () => {
          try {
            const r = await share.save(source, { title: current!.title, blocks: current!.blocks ?? [], baseRev: rev.current });
            if (!r.ok) {
              setSaving("error");
              toast("Someone else changed this page. Load their version to keep editing.", { tone: "danger", action: { label: "Load", onClick: () => void load() }, duration: 12000 });
              return;
            }
            rev.current = r.rev;
            setSaving("saved");
          } catch (e) {
            setSaving("error");
            toast(e instanceof Error ? e.message : "Couldn't save your change.", { tone: "danger" });
          }
        }, 800);
      },
      // Pictures uploaded by the owner stay on their device for now; web pictures show here.
      resolveFileUrl: async (url) => (fileIdFromUrl(url) ? "" : url),
      notify: (m) => toast(m),
    });
  }, [key, editable]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === null)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Spinner label="Opening page" />
      </div>
    );
  if (state === "missing")
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <main id="main" className="flex max-w-sm flex-col items-center gap-3">
          <span className="grid size-12 place-items-center rounded-lg bg-well text-ink-3">
            <Icon name="lock" size={22} />
          </span>
          <h1 className="display-text m-0 text-2xl">This page isn't available</h1>
          <p className="m-0 text-ink-2">It may have been unshared or deleted, or the link was typed wrong. Ask the person who shared it for a new link.</p>
          <Button variant="primary" onClick={() => location.assign("/")}>
            Open Dovli
          </Button>
        </main>
      </div>
    );

  const page = current ?? state.page;
  const look = resolveLook(page.style, page.look);
  const style = look.style;
  // Uploaded cover pictures live on the owner's device; gradients and web pictures show here.
  const cover = !!page.cover && !page.cover.startsWith("file:");
  return (
    <TooltipProvider>
      <div className={cn("min-h-dvh", style && "[background:var(--s-backdrop)]")} style={look.vars as any}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 px-4 surface-chip [border-radius:0]" data-print="hide">
          <a href="/" className="flex items-center gap-2 rounded-md px-1 py-1 text-ink no-underline hover:bg-hover">
            <DovliMark size={24} />
            <span className="font-display font-bold max-[420px]:sr-only">Dovli</span>
          </a>
          <Pill className="ml-1 max-[640px]:hidden">{`Shared by ${state.ownerName}`}</Pill>
          <Pill>{editable ? "Can edit" : "View only"}</Pill>
          {editable && (
            <span className="text-xs text-ink-3" aria-live="polite">
              {saving === "saving" ? "Saving…" : saving === "error" ? "Not saved" : "Saved"}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {state.signInToEdit && (
              <Button size="sm" variant="primary" icon="pencil" onClick={() => location.assign(`/login?next=${encodeURIComponent(location.pathname)}`)}>
                Sign in to edit
              </Button>
            )}
            <Button size="sm" variant="ghost" icon="download" aria-label="Save as PDF" onClick={() => window.print()}>
              <span className="max-[480px]:hidden">Save as PDF</span>
            </Button>
          </div>
        </header>
        <main id="main">
          <article
            data-print="sheet"
            data-divider={look.divider}
            className={cn(
              "mx-auto w-full px-6 pb-[120px] max-[640px]:px-4",
              cover ? "pt-0" : "pt-10",
              look.wide ? "max-w-[1200px]" : "max-w-[860px]",
              style && cn("page-styled my-10 rounded-sheet bg-[var(--s-paper)] pb-14 shadow-sheet max-[640px]:mx-2.5", !cover && "pt-14"),
            )}
          >
            {cover && (
              <div className={cn("-mx-6 max-[640px]:-mx-4", !style && "mt-6 overflow-hidden rounded-xl")}>
                <div
                  className={cn("h-[clamp(140px,24vh,240px)] bg-well bg-cover bg-center", style && "rounded-t-sheet")}
                  style={{ background: coverPreset(page.cover)?.css ?? `center / cover no-repeat url(${JSON.stringify(page.cover)})` }}
                />
              </div>
            )}
            <header className="mb-6 px-[54px] max-[640px]:px-0">
              {hasOwnIcon(page) && (
                <div className={cn("relative z-[1] mb-3 flex", cover ? "-mt-[40px]" : "")}>
                  <PageIconGlyph mark={page.mark} onCover={cover} />
                </div>
              )}
              {cover && !hasOwnIcon(page) && <div className="h-8" />}
              <h1 className="m-0 font-[family-name:var(--title-font,var(--d-font-display))] text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.1] tracking-[var(--d-display-tracking)] text-ink [font-style:var(--title-style,normal)] [font-weight:var(--title-weight,var(--d-display-weight))]">
                {displayTitle(page)}
              </h1>
            </header>
            <Suspense fallback={<Spinner />}>{page.kind === "doc" ? <PageEditor page={page} readOnly={!editable} /> : <p className="px-[54px] text-ink-2">Whiteboards can't be shared yet.</p>}</Suspense>
          </article>
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
