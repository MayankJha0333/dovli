// The Info panel: two tabs. "Page info" has the details (dates, where it lives, stats, outline,
// links, tags) and AI document review. "Actions" has everything you can do with the page.

import { useMemo, useState } from "react";
import { ancestors, backlinksOf, childrenOf, displayTitle, outline, pageTags, pageText, timeAgo, wordCount, type Page } from "@dovli/core";
import { Icon, Segmented, cn, modKey } from "@dovli/ui";
import { useAuth } from "@/lib/auth";
import { store, useStore } from "@/lib/store";
import { ui } from "@/lib/ui";
import { toast } from "@dovli/ui";
import { exportPagePdf } from "@/lib/pdf";
import { exportPageDocx, exportPageHtml, exportPageImage, exportPageMarkdown } from "@/lib/transfer";
import { copyLink, duplicate, moveWithPicker, trashWithUndo } from "@/features/pages/actions";
import { reviewPage, summarizePage, type ReviewFocus } from "@/features/ai/AIPanel";
import { scrollToBlock } from "../PageInfo";
import { ActionRow, PanelTitle, Prop, Section } from "./kit";

const REVIEWS: { id: ReviewFocus; label: string }[] = [
  { id: "full", label: "Full review, with fixes" },
  { id: "grammar", label: "Check spelling and grammar" },
  { id: "structure", label: "Get feedback on structure" },
  { id: "tone", label: "Check tone of voice" },
  { id: "clarity", label: "Make sure it's clear" },
];

const fullDate = (t: number) => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function countBlocks(blocks: any[] | undefined): number {
  return (blocks ?? []).reduce((n, b) => n + 1 + countBlocks(b.children), 0);
}

export function InfoPanel({ page, onFind, onPresent, close }: { page: Page; onFind: () => void; onPresent: () => void; close: () => void }) {
  const [tab, setTab] = useState<"info" | "actions">("info");
  const pages = useStore((s) => s.pages);
  const account = useAuth((s) => s.account);
  const trail = ancestors(pages, page.id);
  const heads = useMemo(() => outline(page), [page]);
  const back = useMemo(() => backlinksOf(pages, page.id), [pages, page.id]);
  const tags = useMemo(() => pageTags(page), [page]);
  const stats = useMemo(() => {
    const text = pageText(page);
    const words = wordCount(page);
    return { words, chars: text.replace(/\s/g, "").length, blocks: countBlocks(page.blocks), minutes: Math.max(1, Math.round(words / 220)) };
  }, [page]);
  const kids = childrenOf(pages, page.id).length;
  const isDoc = page.kind === "doc";
  const go = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <div>
      <PanelTitle>Info</PanelTitle>
      <Segmented
        label="Info panel tab"
        value={tab}
        onValueChange={setTab}
        className="mb-2 grid w-full grid-cols-2 [&>button]:justify-center"
        options={[
          { value: "info", label: "Page info" },
          { value: "actions", label: "Actions" },
        ]}
      />

      {tab === "info" ? (
        <>
          <Section title="Properties" collapsible>
            <div title={fullDate(page.createdAt)}>
              <Prop icon="clock" label="Created">
                {timeAgo(page.createdAt)}
              </Prop>
            </div>
            <div title={fullDate(page.updatedAt)}>
              <Prop icon="pencil" label="Edited">
                {timeAgo(page.updatedAt)}
              </Prop>
            </div>
            <Prop icon="user" label="Author">
              {account?.name || account?.email || "You, on this device"}
            </Prop>
          </Section>

          <Section title="Location" collapsible>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <button type="button" onClick={go(() => store.navigate({ name: "home" }))} className="rounded-sm px-1.5 py-0.5 text-ink-2 hover:bg-hover hover:text-ink">
                Home
              </button>
              {trail.map((a) => (
                <span key={a.id} className="contents">
                  <Icon name="chevron" size={11} className="text-ink-4" />
                  <button type="button" onClick={go(() => store.navigate({ name: "page", id: a.id }))} className="max-w-[160px] truncate rounded-sm px-1.5 py-0.5 text-ink-2 hover:bg-hover hover:text-ink">
                    {a.mark} {displayTitle(a)}
                  </button>
                </span>
              ))}
              <Icon name="chevron" size={11} className="text-ink-4" />
              <span className="max-w-[160px] truncate px-1.5 font-medium text-ink">{displayTitle(page)}</span>
            </div>
          </Section>

          {isDoc && (
            <Section title="Stats" collapsible>
              <dl className="m-0 grid grid-cols-2 gap-1.5">
                {(
                  [
                    ["Words", stats.words],
                    ["Characters", stats.chars],
                    ["Blocks", stats.blocks],
                    ["Reading time", `${stats.minutes} min`],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-md bg-well px-3 py-2">
                    <dt className="text-xs text-ink-3">{k}</dt>
                    <dd className="m-0 text-md font-semibold tabular-nums text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {kids > 0 && <p className="m-0 mt-2 text-sm text-ink-3">{kids === 1 ? "1 page inside" : `${kids} pages inside`}</p>}
            </Section>
          )}

          {isDoc && heads.length > 0 && (
            <Section title="On this page" collapsible>
              <ul className="m-0 flex list-none flex-col p-0">
                {heads.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => scrollToBlock(h.id)}
                      className={cn("w-full truncate rounded-sm py-1 pr-2 text-left text-sm text-ink-2 hover:bg-hover hover:text-ink", h.level === 1 ? "pl-1.5" : h.level === 2 ? "pl-4" : "pl-6")}
                    >
                      {h.text}
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {back.length > 0 && (
            <Section title="Linked from" collapsible>
              <div className="flex flex-col gap-1">
                {back.map((p) => (
                  <ActionRow key={p.id} icon="link" onClick={go(() => store.navigate({ name: "page", id: p.id }))}>
                    {p.mark} {displayTitle(p)}
                  </ActionRow>
                ))}
              </div>
            </Section>
          )}

          {tags.length > 0 && (
            <Section title="Tags" collapsible>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <button key={t} type="button" onClick={go(() => store.navigate({ name: "tag", tag: t }))} className="h-7 rounded-full bg-accent-soft px-3 text-sm font-medium text-accent hover:brightness-95">
                    #{t}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {isDoc && (
            <Section title="Document review" collapsible>
              <ul className="m-0 flex list-none flex-col p-0">
                <li className="border-b border-line">
                  <button type="button" onClick={go(() => summarizePage(page))} className="flex h-10 w-full items-center gap-2.5 rounded-sm px-1 text-left text-base text-ink hover:bg-hover">
                    <Icon name="summary" size={15} className="text-accent" />
                    <span className="flex-1">Summarise with AI</span>
                    <Icon name="chevron" size={12} className="text-ink-4" />
                  </button>
                </li>
                {REVIEWS.map((r) => (
                  <li key={r.id} className="border-b border-line last:border-b-0">
                    <button type="button" onClick={go(() => reviewPage(page, r.id))} className="flex h-10 w-full items-center gap-2.5 rounded-sm px-1 text-left text-base text-ink hover:bg-hover">
                      <Icon name="sparkles" size={15} className="text-accent" />
                      <span className="flex-1">{r.label}</span>
                      <Icon name="chevron" size={12} className="text-ink-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-1.5 text-xs text-ink-3">Opens in the assistant: what to fix first, with fixes you can pick and apply. Nothing changes until you do.</p>
            </Section>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-1.5 pt-2">
          {isDoc && (
            <ActionRow icon="play" onClick={go(onPresent)} hint="Esc to stop">
              Present
            </ActionRow>
          )}
          {isDoc && (
            <ActionRow icon="search" onClick={go(onFind)} hint={`${modKey()}F`}>
              Find and replace
            </ActionRow>
          )}
          <ActionRow icon={page.favorite ? "starFilled" : "star"} onClick={() => store.toggleFavorite(page.id)}>
            {page.favorite ? "Remove from favourites" : "Add to favourites"}
          </ActionRow>
          <ActionRow icon="move" onClick={go(() => void moveWithPicker(page))}>
            Move to…
          </ActionRow>
          <ActionRow icon="duplicate" onClick={go(() => duplicate(page))}>
            Duplicate
          </ActionRow>
          <ActionRow icon="link" onClick={() => void copyLink(page)}>
            Copy link
          </ActionRow>
          {isDoc && (
            <div className="rounded-md bg-well px-3 py-2">
              <div className="mb-1.5 flex items-center gap-3 text-base text-ink">
                <Icon name="download" size={16} className="text-ink-3" />
                Export
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["PDF", () => void exportPagePdf(page).catch((e) => toast(e.message, { tone: "danger" }))],
                    ["Word", () => void exportPageDocx(page).catch((e) => toast(e.message, { tone: "danger" }))],
                    ["Markdown", () => void exportPageMarkdown(page)],
                    ["Image", () => void exportPageImage(page).catch((e) => toast(e.message, { tone: "danger" }))],
                    ["Web page", () => void exportPageHtml(page)],
                  ] as const
                ).map(([label, fn]) => (
                  <button key={label} type="button" onClick={go(fn)} className="h-8 rounded-sm bg-panel text-sm text-ink shadow-sm hover:bg-hover">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ActionRow icon="history" onClick={go(() => ui.set({ settings: "sync" }))}>
            View backups
          </ActionRow>
          <ActionRow icon="trash" danger onClick={go(() => trashWithUndo(page))}>
            Move to trash
          </ActionRow>
        </div>
      )}
    </div>
  );
}
