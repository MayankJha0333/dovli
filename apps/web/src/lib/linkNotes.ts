// Notes from a link: ask the server to read a web page (/api/link-notes), then make a page from it.
// "notes" is written by AI; "article" is the page's own main text, cleaned up.

import { markdownToBlocks, type Page } from "@dovli/core";
import { DEFAULT_PAGE_STYLE, getStyle } from "@dovli/theme";
import { AIError, aiHeaders, countUsage } from "./ai";
import { sourceLine } from "./linkSource";
import { store } from "./store";

export type LinkNotesMode = "notes" | "article";

interface Answer {
  url: string;
  title: string;
  siteName: string;
  byline: string;
  published: string;
  markdown: string;
  /** A page style chosen from what the web page is about, or its brand colour. */
  style?: string;
  own?: boolean;
  usage?: { input_tokens: number; output_tokens: number };
  used?: number;
  limit?: number;
}

export async function makePageFromLink(
  url: string,
  { mode, focus = "", parentId = null, signal }: { mode: LinkNotesMode; focus?: string; parentId?: string | null; signal?: AbortSignal },
): Promise<Page> {
  const res = await fetch("/api/link-notes", { method: "POST", headers: await aiHeaders(), body: JSON.stringify({ url, mode, focus }), signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(data.error ?? "Couldn't read that page. Please try again.");
  const a = data as Answer;
  if (mode === "notes") countUsage(!!a.own, (a.usage?.input_tokens ?? 0) + (a.usage?.output_tokens ?? 0), a.used, a.limit);
  // Nothing is made if the person closed the window while the answer was on its way.
  signal?.throwIfAborted();
  return store.createPage({
    parentId,
    title: a.title,
    mark: "↗",
    style: getStyle(a.style) ? a.style : DEFAULT_PAGE_STYLE,
    blocks: markdownToBlocks(`${sourceLine(a, mode)}\n\n${a.markdown}`),
  });
}
