import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import "@/lib/excalidraw";
import { connectEditor } from "@dovli/editor";
import { displayTitle, fileIdFromUrl, type Page } from "@dovli/core";
import { resolveLook } from "@dovli/theme";
import { Button, Icon, Pill, Spinner, Toaster, TooltipProvider, cn, toast } from "@dovli/ui";
import { applySettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase";

const PageEditor = lazy(() => import("@dovli/editor/page-editor"));

type Loaded = { access: "view" | "edit"; page: Page; rev: number };

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

/** A page someone shared with a link. No account needed to read it (or edit it, if they allowed that). */
export default function SharedPage({ shareId }: { shareId: string }) {
  const [state, setState] = useState<Loaded | "missing" | "unavailable" | null>(null);
  const [saving, setSaving] = useState<"saved" | "saving" | "error">("saved");
  const rev = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    applySettings();
    const sb = supabase();
    if (!sb) return setState("unavailable");
    void sb.rpc("get_shared_page", { p_share: shareId }).then(({ data, error }) => {
      if (error || !data?.page) return setState("missing");
      const page = { ...data.page } as Page;
      rev.current = data.rev;
      setCurrent(page);
      setState({ access: data.access, page, rev: data.rev });
      document.title = `${displayTitle(page)} · Dovli`;
    });
  }, [shareId]);

  const editable = typeof state === "object" && state?.access === "edit";

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
          const { data, error } = await supabase()!.rpc("update_shared_page", {
            p_share: shareId,
            p_title: current!.title,
            p_blocks: current!.blocks,
            p_base_rev: rev.current,
          });
          if (error || !data?.ok) {
            setSaving("error");
            toast(data?.conflict ? "Someone else changed this page. Reload to see the latest version." : (data?.error ?? "Couldn't save your change."), { tone: "danger" });
            return;
          }
          rev.current = data.rev;
          setSaving("saved");
        }, 800);
      },
      resolveFileUrl: async (url) => {
        const id = fileIdFromUrl(url);
        return id ? `/api/share/${encodeURIComponent(shareId)}/file/${encodeURIComponent(id)}` : url;
      },
      notify: (m) => toast(m),
    });
  }, [shareId, editable]);

  if (state === null)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Spinner label="Opening page" />
      </div>
    );
  if (state === "missing" || state === "unavailable")
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <span className="grid size-12 place-items-center rounded-lg bg-well text-ink-3">
            <Icon name="lock" size={22} />
          </span>
          <h1 className="display-text m-0 text-2xl">This link doesn't work</h1>
          <p className="m-0 text-ink-2">The page may have been unshared, deleted, or the link was typed wrong. Ask the person who sent it for a new link.</p>
          <Button variant="primary" onClick={() => location.assign("/")}>
            Open Dovli
          </Button>
        </div>
      </div>
    );

  const page = current ?? state.page;
  const look = resolveLook(page.style, page.look);
  const style = look.style;
  return (
    <TooltipProvider>
      <div className={cn("min-h-dvh", style && "[background:var(--s-backdrop)]")} style={look.vars as any}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 px-4 surface-chip [border-radius:0]" data-print="hide">
          <a href="/" className="flex items-center gap-2 rounded-md px-1 py-1 text-ink no-underline hover:bg-hover">
            <span className="grid size-7 place-items-center rounded-sm bg-brand font-display text-md font-bold text-brand-ink">D</span>
            <span className="font-display font-bold">Dovli</span>
          </a>
          <Pill className="ml-1">{editable ? "Anyone with the link can edit" : "View only"}</Pill>
          {editable && <span className="text-xs text-ink-3">{saving === "saving" ? "Saving…" : saving === "error" ? "Not saved" : "Saved"}</span>}
          <Button size="sm" variant="ghost" icon="download" className="ml-auto" onClick={() => window.print()}>
            Save as PDF
          </Button>
        </header>
        <article
          data-print="sheet"
          data-divider={look.divider}
          className={cn("mx-auto w-full px-6 pb-[120px] pt-10 max-[640px]:px-4", look.wide ? "max-w-[1200px]" : "max-w-[860px]", style && "page-styled my-10 rounded-sheet bg-[var(--s-paper)] py-14 shadow-sheet max-[640px]:mx-2.5")}
        >
          <header className="mb-6 px-[54px] max-[640px]:px-0">
            <div className="mb-4 grid size-[60px] place-items-center rounded-lg bg-accent-soft font-serif text-[30px] text-accent">{page.mark}</div>
            <h1 className="m-0 font-[family-name:var(--title-font,var(--d-font-display))] text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.1] tracking-[var(--d-display-tracking)] text-ink [font-style:var(--title-style,normal)] [font-weight:var(--title-weight,var(--d-display-weight))]">
              {displayTitle(page)}
            </h1>
          </header>
          <Suspense fallback={<Spinner />}>{page.kind === "doc" ? <PageEditor page={page} readOnly={!editable} /> : <p className="px-[54px] text-ink-2">Whiteboards can't be shared yet.</p>}</Suspense>
        </article>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
