// The Dovli browser extension's door into a person's pages. It signs in with the secret of its
// connection (made when the person clicks Connect, see features/extension/ConnectExtension.tsx), the
// same kind of connection AI apps use, so it shows in Settings → AI apps and can be switched off there.
//
// POST, "Authorization: Bearer dvl_…", { action, … }:
//   hello                                  → { account, can, recent, favorites, pages }
//   search   { query }                     → { results }
//   read     { pageId }                    → { page, cursor }          (see pageView in extensionCore.ts)
//   follow   { pageId, cursor }            → { cursor, changed }       (cheap: has the page changed?)
//   add      { pageId, markdown, position?, blockId? }
//   update   { pageId, blockId, markdown }
//   delete   { pageId, blockIds }
//   task     { pageId, blockId, done }
//   addClip  { pageId, kind: "selection" | "image" | "link" | "bookmark", pageUrl, pageTitle, html?, text?,
//              src?, alt?, href?, linkText?, description?, remark?, tags? }
//   create   { title, markdown?, parentId? }                   → { page_id, … }
//   clip     { url, mode, html?, region?: "guess" | "chosen", text?, pageTitle?, siteName?, description?, title?,
//              focus?, tags?, remark?, parentId?, today?, locale? } → { pageId, title, style }
//
// "clip" makes a new page from the tab, as the browser shows it (so pages behind a sign-in, or built
// with JavaScript, work too). mode "article" finds the main text, "notes" has AI write notes from it,
// "page" keeps everything, and "selection" and "bookmark" save what was selected, or the link with its
// summary. With `region`, the html holds only the part outlined in the popup: Dovli's guess at the
// article, which is tidied like any article, or a part the person chose, which is kept as it is.

import { NextResponse } from "next/server";
import { DEFAULT_PAGE_STYLE } from "@dovli/theme";
import { sourceLine } from "@/lib/linkSource";
import { CloudError } from "@/lib/server/cloudCore";
import { clipBody, clipMarkdown, pageView, remarkCallout, tagLine, type Clip } from "@/lib/server/extensionCore";
import { NotesError, notesEngine, writeNotes } from "@/lib/server/linkNotes";
import { mcpServer } from "@/lib/server/mcp";
import { ToolError, type Connection } from "@/lib/server/mcpCore";
import { readArticle } from "@/lib/server/webPageCore";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY = 3_500_000; // characters: a captured page, without its scripts and styles
const MAX_SAVED = 190_000; // a page is saved as at most this much Markdown
const rate = new Map<string, number[]>();

const headers = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const fail = (error: string, status: number, code?: string) => json({ error, ...(code ? { code } : {}) }, status);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

// The side panel checks for changes every few seconds, so this allows that and a busy minute of editing.
function limited(c: Connection) {
  const t = Date.now();
  const recent = (rate.get(c.id) ?? []).filter((x) => t - x < 60_000);
  recent.push(t);
  rate.set(c.id, recent);
  return recent.length > 300;
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  let mcp: ReturnType<typeof mcpServer>;
  try {
    mcp = mcpServer();
  } catch {
    return fail("Dovli's cloud isn't set up on this server, so the extension can't connect.", 503);
  }
  const c = await mcp.resolve(secret);
  if (!c) return fail("The extension isn't connected to Dovli any more. Connect it again.", 401, "disconnected");
  if (!c.enabled) return fail(`The extension is switched off in Dovli → Settings → AI apps ("${c.name}").`, 403, "disconnected");
  if (limited(c)) return fail("Too many requests in a minute. Wait a moment and try again.", 429);

  const text = await req.text();
  if (text.length > MAX_BODY) return fail("That page is too big to clip. Select the part you want and add that instead.", 413);
  let a: Record<string, unknown>;
  try {
    a = JSON.parse(text);
  } catch {
    return fail("That request didn't make sense.", 400);
  }

  const pageId = str(a.pageId, 128);
  try {
    switch (a.action) {
      case "hello": {
        const o: any = await mcp.call(c, "get_overview", {});
        return json({ account: o.person, can: c.permission, recent: o.recently_edited, favorites: o.favorites, pages: o.pages });
      }
      case "search":
        return json(await mcp.call(c, "search", { query: str(a.query, 200), limit: 12 }));
      case "read": {
        // Where to follow changes from, taken before reading, so nothing saved in between is missed.
        const { cursor } = await mcp.follow(c, pageId, null);
        return json({ page: pageView(await mcp.getPage(c, pageId)), cursor });
      }
      case "follow":
        return json(await mcp.follow(c, pageId, typeof a.cursor === "number" ? a.cursor : null));
      case "add":
        return json(await mcp.call(c, "add_blocks", { page_id: pageId, markdown: a.markdown, position: a.position, block_id: a.blockId }));
      case "update":
        return json(await mcp.call(c, "update_block", { page_id: pageId, block_id: a.blockId, markdown: a.markdown }));
      case "delete":
        return json(await mcp.call(c, "delete_blocks", { page_id: pageId, block_ids: a.blockIds }));
      case "task":
        return json(await mcp.call(c, "set_task", { page_id: pageId, block_id: a.blockId, done: a.done }));
      case "addClip": {
        const kind: Clip["kind"] = a.kind === "image" || a.kind === "link" || a.kind === "bookmark" ? a.kind : "selection";
        const markdown = clipMarkdown({
          kind,
          pageUrl: str(a.pageUrl, 4096),
          pageTitle: str(a.pageTitle, 300),
          html: str(a.html, MAX_BODY),
          text: str(a.text, 200_000),
          src: str(a.src, 4096),
          alt: str(a.alt, 500),
          href: str(a.href, 4096),
          linkText: str(a.linkText, 500),
          description: str(a.description, 1000),
        });
        if (!markdown) return fail(kind === "image" ? "That picture can't be saved (it isn't a web address)." : "There was nothing to add.", 400);
        const added = [markdown, remarkCallout(str(a.remark, 2000)), tagLine(a.tags)].filter(Boolean).join("\n\n");
        return json(await mcp.call(c, "add_blocks", { page_id: pageId, markdown: added }));
      }
      case "create":
        return json(
          await mcp.call(c, "create_page", { title: a.title, markdown: a.markdown, ...(a.parentId ? { parent_id: a.parentId } : {}), icon: str(a.icon, 8) || undefined, style: DEFAULT_PAGE_STYLE }),
        );
      case "clip":
        return await clip(req, c, mcp, a);
    }
    return fail("That request didn't make sense.", 400);
  } catch (e) {
    if (e instanceof ToolError) return fail(e.message, 400);
    if (e instanceof CloudError) return fail(e.message, e.status);
    if (e instanceof NotesError) return fail(e.message, e.status, e.code);
    console.error("[dovli] extension request failed:", a.action, e);
    return fail("Something went wrong in Dovli. Please try again.", 500);
  }
}

const MODES = ["article", "notes", "page", "selection", "bookmark"] as const;

async function clip(req: Request, c: Connection, mcp: ReturnType<typeof mcpServer>, a: Record<string, unknown>) {
  if (c.permission !== "edit") return fail("The extension can only read your pages. Allow editing in Dovli → Settings → AI apps.", 403);
  let url: URL;
  try {
    url = new URL(str(a.url, 4096));
  } catch {
    return fail("Dovli can only clip web pages.", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return fail("Dovli can only clip web pages.", 400);
  const mode = MODES.find((m) => m === a.mode) ?? "article";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(str(a.today, 10)) ? str(a.today, 10) : undefined;
  const locale = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,3}$/.test(str(a.locale, 35)) ? str(a.locale, 35) : "en";
  const extras = [tagLine(a.tags), remarkCallout(str(a.remark, 2000))];
  const host = url.hostname.replace(/^www\./, "");
  const save = async (title: string, line: string, markdown: string, style: string, icon = "↗") => {
    if (markdown.length > MAX_SAVED) markdown = `${markdown.slice(0, markdown.lastIndexOf("\n\n", MAX_SAVED))}\n\n<small>The page goes on: only the first part was saved.</small>`;
    const made: any = await mcp.call(c, "create_page", {
      title,
      markdown: [line, ...extras, markdown].filter(Boolean).join("\n\n"),
      icon,
      style,
      ...(a.parentId ? { parent_id: str(a.parentId, 128) } : {}),
    });
    return json({ pageId: made.page_id, title, style });
  };

  if (mode === "selection" || mode === "bookmark") {
    const body = clipBody({ kind: mode, pageUrl: url.href, pageTitle: str(a.pageTitle, 300), html: str(a.html, MAX_BODY), text: str(a.text, 200_000), href: url.href, description: str(a.description, 1000) });
    if (!body) return fail("Select some text on the page first.", 400);
    const line = sourceLine({ url: url.href, siteName: str(a.siteName, 120).trim() || host, byline: "", published: "" }, "article", { saved: today, locale });
    return save(str(a.title, 200).trim() || str(a.pageTitle, 200).trim() || host, line, body, DEFAULT_PAGE_STYLE, mode === "bookmark" ? "🔖" : "↗");
  }

  const html = str(a.html, MAX_BODY);
  if (!html) return fail("Dovli couldn't read this tab. Reload it and try again.", 400);
  // Check the AI first, so nobody waits for nothing.
  const ai = mode === "notes" ? await notesEngine(req, { id: c.uid }) : null;
  const exact = mode === "page" || a.region === "chosen";
  // An outlined part is what they asked for, even where Readability can't make sense of it.
  const outlined = exact || a.region === "guess";
  let article;
  try {
    article = readArticle(html, url.href, "html", { whole: exact });
    if (outlined && (!article || article.words < 40)) article = readArticle(html, url.href, "html", { whole: true });
  } catch (e) {
    console.error("[dovli] extension clip: parsing the page failed", e);
    article = null;
  }
  if (!article || article.words < (outlined ? 1 : 40)) return fail("Dovli couldn't find the main text on this page. Select the part you want and add the selection instead.", 422);
  article = { ...article, title: str(a.title, 200).trim() || article.title };

  let markdown = ai ? (await writeNotes(article, url.href, str(a.focus, 300), { ...ai, userId: c.uid })).markdown : article.markdown;
  // A part kept as it is starts with the page's own heading, which would repeat the title right above it.
  const lead = /^#{1,2} (.+)\n*/.exec(markdown);
  const squash = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (!ai && lead && squash(lead[1]) === squash(article.title)) markdown = markdown.slice(lead[0].length);
  const line = sourceLine({ url: url.href, siteName: article.siteName, byline: article.byline, published: article.published }, mode === "notes" ? "notes" : "article", { saved: today, locale });
  return save(article.title, line, markdown, article.style);
}
