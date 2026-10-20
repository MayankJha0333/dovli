// Notes from a link: read a web page and turn it into a Dovli page.
// POST { url, mode: "notes" | "article", focus? } → { title, markdown, url, siteName, byline, published, style, … }
//
// "article" keeps the page's main text, cleaned up (no menus, ads or comments), with no AI. "notes"
// has the AI write notes from it: the same AI as everywhere else (Dovli AI on Groq, or the person's
// own key), and Dovli AI's monthly allowance counts it. The app turns the Markdown into blocks and
// makes the page. Fetching is in lib/server/webPage.ts, reading the page in lib/server/webPageCore.ts.

import { NextResponse } from "next/server";
import { firebaseOnServer, userFromRequest } from "@/lib/server/firebaseAdmin";
import { noStore, sameOrigin } from "@/lib/server/http";
import { NotesError, notesEngine, writeNotes } from "@/lib/server/linkNotes";
import { WebPageError, fetchPage } from "@/lib/server/webPage";
import { checkUrl, readArticle } from "@/lib/server/webPageCore";

export const runtime = "nodejs";
export const maxDuration = 60;

const FETCH_MS = 15_000;

const clip = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "That request came from another site." }, 403);
  let body: { url?: unknown; mode?: unknown; focus?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "That request didn't make sense." }, 400);
  }
  const mode = body.mode === "article" ? "article" : "notes";
  const checked = checkUrl(body.url);
  if (!checked.ok) return json({ error: checked.error }, 400);

  // With accounts turned on, this needs a signed-in person: the server reads pages for people, not for anyone.
  const user = firebaseOnServer ? await userFromRequest(req) : null;
  if (firebaseOnServer && !user) return json({ error: "Sign in to make notes from a link." }, 401);

  try {
    // Check the AI before reading the page, so nobody waits for a page only to be told AI isn't ready.
    const ai = mode === "notes" ? await notesEngine(req, user) : null;

    let page;
    try {
      const signal = AbortSignal.any([req.signal, AbortSignal.timeout(FETCH_MS)]);
      page = await fetchPage(checked.url, signal, clip(req.headers.get("accept-language"), 200) || "en");
    } catch (e) {
      if (e instanceof WebPageError) return json({ error: e.message }, e.status);
      console.error("[dovli] link notes: reading the page failed", e);
      return json({ error: "Couldn't read that page. Please try again." }, 502);
    }

    let article;
    try {
      article = readArticle(page.body, page.url, page.kind);
    } catch (e) {
      console.error("[dovli] link notes: parsing the page failed", e);
      article = null;
    }
    if (!article || article.words < 40)
      return json({ error: "Dovli couldn't find the main text on that page. Pages that need a sign-in, or that build themselves with JavaScript, can't be read yet." }, 422);

    const source = { url: page.url, title: article.title, siteName: article.siteName, byline: article.byline, published: article.published, style: article.style };
    if (!ai) return json({ ...source, markdown: article.markdown, own: false });

    const notes = await writeNotes(article, page.url, clip(body.focus, 300), { ...ai, userId: user?.id ?? null });
    return json({
      ...source,
      markdown: notes.markdown,
      usage: { input_tokens: notes.inputTokens, output_tokens: notes.outputTokens },
      own: notes.own,
      used: notes.used,
      limit: notes.limit,
    });
  } catch (e) {
    if (e instanceof NotesError) return json({ error: e.message, code: e.code }, e.status);
    throw e;
  }
}
