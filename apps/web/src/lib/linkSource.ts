// The grey line at the top of a page made from a web page: where it came from, who wrote it, and
// when it was saved. Shared by the app (Notes from a link) and the server (the browser extension).

import { inlineToMarkdown } from "@dovli/core";

export interface LinkSource {
  url: string;
  siteName: string;
  byline: string;
  published: string;
}

/**
 * `saved` is the day it was saved; on the server it comes from the person's device as YYYY-MM-DD,
 * so it's their date, not the server's. `locale` decides how dates are written.
 */
export function sourceLine(a: LinkSource, mode: "notes" | "article", { saved = new Date(), locale }: { saved?: Date | string; locale?: string } = {}): string {
  const fromDevice = typeof saved === "string";
  const day = (value: Date | string, utc = false) => {
    const d = typeof value === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value) : value;
    if (Number.isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", ...(utc ? { timeZone: "UTC" } : {}) });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };
  const href = a.url.replace(/\(/g, "%28").replace(/\)/g, "%29");
  let host = a.url;
  try {
    host = new URL(a.url).hostname;
  } catch {
    /* keep the address as it is */
  }
  const published = a.published ? day(a.published, fromDevice) : "";
  const parts = [
    `${mode === "notes" ? "Notes from" : "From"} [${inlineToMarkdown(a.siteName || host)}](${href})`,
    a.byline && `by ${inlineToMarkdown(a.byline)}`,
    published && `published ${published}`,
    `saved ${day(saved, fromDevice) || day(new Date(), true)}`,
  ];
  return `<small>${parts.filter(Boolean).join(" · ")}</small>`;
}
