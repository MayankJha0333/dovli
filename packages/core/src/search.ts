import type { Page } from "./types";
import { displayTitle, livePages, pageText } from "./pages";

// Full-text search across every page: titles count most, then words in the text.

export interface SearchHit {
  page: Page;
  score: number;
  /** A short piece of text around the first match, with the match marked by start/end. */
  snippet: { text: string; start: number; end: number } | null;
}

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");

export function searchPages(pages: Record<string, Page>, query: string, limit = 30): SearchHit[] {
  const q = fold(query.trim());
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  for (const page of livePages(pages)) {
    const title = fold(displayTitle(page));
    const raw = pageText(page);
    const body = fold(raw);
    let score = 0;
    let ok = true;
    for (const t of terms) {
      const inTitle = title.includes(t);
      const inBody = body.includes(t);
      if (!inTitle && !inBody) {
        ok = false;
        break;
      }
      if (inTitle) score += title.startsWith(t) ? 12 : 8;
      if (inBody) score += Math.min(4, body.split(t).length - 1);
    }
    if (!ok) continue;
    if (title === q) score += 20;
    // Recent pages win ties.
    score += Math.max(0, 2 - (Date.now() - page.updatedAt) / (14 * 864e5));
    hits.push({ page, score, snippet: snippetFor(raw, body, terms[0]) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

function snippetFor(raw: string, folded: string, term: string): SearchHit["snippet"] {
  const at = folded.indexOf(term);
  if (at < 0) return null;
  const from = Math.max(0, at - 40);
  const to = Math.min(raw.length, at + term.length + 80);
  const prefix = from > 0 ? "…" : "";
  const slice = raw.slice(from, to).replace(/\s+/g, " ");
  // Whitespace collapsing can shift positions; find the term again in the shortened text.
  const local = Math.max(0, fold(slice).indexOf(term));
  return { text: prefix + slice, start: prefix.length + local, end: prefix.length + local + term.length };
}
