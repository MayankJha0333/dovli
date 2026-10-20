// Reading a web page for "Notes from a link": which addresses Dovli may fetch, and turning a page's
// HTML into its main text as Dovli Markdown. No Next.js here, so it's easy to test
// (webPageCore.test.ts). Fetching is in webPage.ts, and the route in app/api/link-notes.

import { BlockList, isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { classify, inlineToMarkdown } from "@dovli/core";
import { pickStyle, type StyleSignals } from "./webPageStyle";

/* ---------- Which addresses may be read ---------- */

// Private, local and special-use networks. A link (or a redirect, or a name that resolves to one of
// these) must never make the server read something inside its own network.
const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  PRIVATE.addSubnet(net, bits, "ipv4");
// 64:ff9b::, 2001:: and 2002:: can carry an IPv4 address inside (NAT64, Teredo, 6to4).
for (const [net, bits] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  PRIVATE.addSubnet(net, bits, "ipv6");

/** True for an address on the public internet (BlockList also catches IPv4 written as ::ffff:a.b.c.d). */
export function isPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  return v !== 0 && !PRIVATE.check(ip, v === 4 ? "ipv4" : "ipv6");
}

const PORTS = new Set(["", "80", "443", "8080", "8443"]);

export type CheckedUrl = { ok: true; url: URL } | { ok: false; error: string };

/** A link someone pasted, made into a full address, or the reason Dovli won't read it. */
export function checkUrl(input: unknown): CheckedUrl {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return { ok: false, error: "Paste a link first." };
  if (text.length > 2048) return { ok: false, error: "That link is too long." };
  let url: URL;
  try {
    // "example.com/post" and "example.com:8080/post" have no scheme; "javascript:…" does.
    url = new URL(/^[a-z][\w+.-]*:(?!\d)/i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: "That doesn't look like a web address." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: "Only web links (starting with http or https) can be read." };
  if (url.username || url.password) return { ok: false, error: "Links with a user name or password in them can't be read." };
  if (!PORTS.has(url.port)) return { ok: false, error: "That link uses an unusual port, so Dovli can't read it." };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const local = isIP(host) ? !isPublicAddress(host) : !host.includes(".") || /\.(localhost|local|internal|intranet|lan|home|corp)\.?$/.test(host);
  if (local) return { ok: false, error: "That address is on a private network, so Dovli can't read it." };
  url.hash = "";
  return { ok: true, url };
}

/* ---------- HTML → Dovli Markdown ---------- */

export interface Article {
  title: string;
  siteName: string;
  byline: string;
  /** When the page says it was published, as the page gives it. */
  published: string;
  markdown: string;
  words: number;
  /** The Dovli page style that suits it (see webPageStyle.ts). */
  style: string;
}

const SKIP = new Set(["script", "style", "noscript", "template", "svg", "math", "button", "form", "input", "select", "textarea", "nav", "canvas", "object", "map", "link", "meta", "head", "title"]);
const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "center", "details", "div", "dd", "dl", "dt", "figcaption", "figure", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "iframe", "img", "li", "main", "ol", "p", "picture", "pre", "section",
  "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul", "video",
]);
const MARKS: Record<string, [string, string]> = {
  strong: ["**", "**"],
  b: ["**", "**"],
  em: ["*", "*"],
  i: ["*", "*"],
  s: ["~~", "~~"],
  del: ["~~", "~~"],
  strike: ["~~", "~~"],
  mark: ["==", "=="],
  u: ["<u>", "</u>"],
};
// A paragraph that starts like this would be read back as a heading, list, quote, table…
const LOOKS_LIKE_SYNTAX = /^(#{1,6}\s|[-+*]\s|\d+[.)]\s|>|```|---$|\|)/;

type Node = any;
interface Ctx {
  base: URL;
  /** Pictures and videos met inside a paragraph, placed after it (Dovli has no inline pictures). */
  hoist: string[];
}

const tagOf = (n: Node) => String(n?.nodeName ?? "").toLowerCase();
const BLOCK_SELECTOR = [...BLOCK].join(",");
/** Text, or an inline element with no blocks inside (old pages wrap whole articles in <span> or <font>). */
const isInline = (n: Node) => n.nodeType === 3 || (n.nodeType === 1 && !BLOCK.has(tagOf(n)) && !SKIP.has(tagOf(n)) && !n.querySelector(BLOCK_SELECTOR));
const words = (s: string) => s.replace(/\s+/g, " ");
const text = (s: string) => inlineToMarkdown(words(s));
const trimInline = (s: string) => s.replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, "");
// A Markdown link or picture address ends at the first ")" or space.
const safeUrl = (u: string) => u.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");

function absolute(href: string | null | undefined, base: URL, kinds = /^(https?|mailto):$/): string | null {
  const h = href?.trim();
  if (!h || h.startsWith("#")) return null;
  try {
    const u = new URL(h, base);
    return kinds.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

/** Put marks around text, leaving its outer spaces outside (**word** , not ** word **). */
function wrap(s: string, open: string, close: string): string {
  const lead = s.match(/^\s*/)![0];
  const rest = s.slice(lead.length);
  const trail = rest.match(/\s*$/)![0];
  const core = rest.slice(0, rest.length - trail.length);
  return core ? `${lead}${open}${core}${close}${trail}` : s;
}

function inlineCode(raw: string): string {
  const t = words(raw).trim();
  if (!t) return "";
  return t.includes("`") ? `\`\` ${t} \`\`` : `\`${t}\``;
}

function inline(nodes: Iterable<Node>, ctx: Ctx, marks: ReadonlySet<string> = new Set()): string {
  let out = "";
  for (const n of nodes) {
    if (n.nodeType === 3) {
      out += text(n.textContent ?? "");
      continue;
    }
    if (n.nodeType !== 1) continue;
    const tag = tagOf(n);
    if (SKIP.has(tag)) continue;
    if (tag === "br") out += "<br>";
    else if (tag === "img" || tag === "picture" || tag === "iframe" || tag === "video") {
      const m = media(n, ctx);
      if (m) ctx.hoist.push(m);
    } else if (tag === "code" || tag === "kbd" || tag === "samp" || tag === "tt") out += inlineCode(n.textContent ?? "");
    else if (tag === "a") {
      const href = absolute(n.getAttribute("href"), ctx.base);
      const inner = inline(n.childNodes, ctx, marks);
      out += href && trimInline(inner) ? wrap(inner, "[", `](${safeUrl(href)})`) : inner;
    } else {
      const mark = MARKS[tag];
      const nested = mark && !marks.has(mark[0]);
      const inner = inline(n.childNodes, ctx, nested ? new Set([...marks, mark[0]]) : marks);
      // Block elements met inside a line (a <p> in a <td>) still need a gap between them.
      out += nested ? wrap(inner, mark[0], mark[1]) : BLOCK.has(tag) ? ` ${inner} ` : inner;
    }
  }
  return out;
}

/** A picture, video or embedded player as one Markdown line, or null. */
function media(el: Node, ctx: Ctx, caption = ""): string | null {
  const tag = tagOf(el);
  if (tag === "picture") {
    const img = el.querySelector("img");
    return img ? media(img, ctx, caption) : null;
  }
  if (tag === "img") {
    const w = Number(el.getAttribute("width"));
    const h = Number(el.getAttribute("height"));
    if ((w && w < 32) || (h && h < 32)) return null; // icons and tracking pixels
    // Lazy-loaded pictures keep the real address in data-src or srcset, and a placeholder in src.
    const srcset = (el.getAttribute("srcset") || el.getAttribute("data-srcset") || "").split(",")[0]?.trim().split(/\s+/)[0];
    const candidates = [el.getAttribute("data-src"), el.getAttribute("data-original"), el.getAttribute("data-lazy-src"), el.getAttribute("src"), srcset];
    const src = candidates.map((c) => absolute(c, ctx.base, /^https?:$/)).find(Boolean);
    if (!src) return null;
    const alt = words(caption || el.getAttribute("alt") || "").replace(/[[\]]/g, "").trim().slice(0, 300);
    return `![${alt}](${safeUrl(src)})`;
  }
  const src = absolute(el.getAttribute("src") || el.querySelector?.("source")?.getAttribute("src"), ctx.base, /^https?:$/);
  // Only players Dovli knows how to show (YouTube, Vimeo, video files…), not ads or widgets.
  return src && classify(src).kind !== "link" ? `<embed url="${src.replace(/"/g, "%22")}"/>` : null;
}

function emit(out: string[], line: string) {
  out.push(line, "");
}

function flushHoisted(ctx: Ctx, indent: string, out: string[]) {
  for (const m of ctx.hoist.splice(0)) emit(out, indent + m);
}

function paragraph(md: string, ctx: Ctx, indent: string, out: string[]) {
  // Some pages separate paragraphs with <br><br> instead of <p>.
  for (const part of md.split(/(?:\s*<br>\s*){2,}/)) {
    const t = trimInline(part).replace(/ {2,}/g, " ");
    if (t) emit(out, indent + (LOOKS_LIKE_SYNTAX.test(t) ? `\\${t}` : t));
  }
  flushHoisted(ctx, indent, out);
}

/** A run of nodes as blocks: loose text and inline elements between blocks become paragraphs. */
function blocks(nodes: Iterable<Node>, ctx: Ctx, indent: string, out: string[]) {
  let pending: Node[] = [];
  const flush = () => {
    if (pending.length) paragraph(inline(pending, ctx), ctx, indent, out);
    pending = [];
  };
  for (const n of nodes) {
    if (isInline(n)) {
      pending.push(n);
      continue;
    }
    const tag = tagOf(n);
    if (n.nodeType !== 1 || SKIP.has(tag)) continue;
    flush();
    block(n, tag, ctx, indent, out);
  }
  flush();
}

function block(el: Node, tag: string, ctx: Ctx, indent: string, out: string[]) {
  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const t = trimInline(inline(el.childNodes, ctx).replace(/<br>/g, " ")).replace(/ {2,}/g, " ");
      if (t) emit(out, `${indent}${"#".repeat(Math.min(3, Number(tag[1])))} ${t}`);
      flushHoisted(ctx, indent, out);
      return;
    }
    case "p":
    case "dt":
    case "address":
      return paragraph(tag === "dt" ? wrap(inline(el.childNodes, ctx, new Set(["**"])), "**", "**") : inline(el.childNodes, ctx), ctx, indent, out);
    case "dd":
      item(el, "- ", ctx, indent, out);
      return void out.push("");
    case "ul":
    case "ol":
      return list(el, tag === "ol", ctx, indent, out);
    case "li":
      item(el, "- ", ctx, indent, out);
      return void out.push("");
    case "blockquote":
      return quote(el, ctx, indent, out);
    case "pre":
      return code(el, indent, out);
    case "table":
      return table(el, ctx, indent, out);
    case "hr":
      return emit(out, `${indent}---`);
    case "img":
    case "picture":
    case "iframe":
    case "video": {
      const m = media(el, ctx);
      if (m) emit(out, indent + m);
      return;
    }
    case "figure": {
      const pictures = [...el.querySelectorAll("img, iframe, video")];
      if (!pictures.length) return blocks(el.childNodes, ctx, indent, out);
      const caption = trimInline(text(el.querySelector("figcaption")?.textContent ?? ""));
      pictures.forEach((p, i) => {
        const m = media(p, ctx, i === 0 ? caption : "");
        if (m) emit(out, indent + m);
      });
      return;
    }
    case "figcaption": {
      const t = trimInline(inline(el.childNodes, ctx));
      if (t) emit(out, `${indent}<small>${t}</small>`);
      return;
    }
    case "details": {
      const summary = [...el.children].find((c: Node) => tagOf(c) === "summary");
      const title = summary ? trimInline(inline(summary.childNodes, ctx)) : "";
      emit(out, `${indent}+ ${title || "Details"}`);
      blocks([...el.childNodes].filter((c: Node) => c !== summary), ctx, `${indent}  `, out);
      return;
    }
    default:
      return blocks(el.childNodes, ctx, indent, out);
  }
}

function list(el: Node, ordered: boolean, ctx: Ctx, indent: string, out: string[]) {
  let n = Number(el.getAttribute("start")) || 1;
  for (const c of el.children) {
    const tag = tagOf(c);
    if (tag === "li") item(c, ordered ? `${n++}. ` : "- ", ctx, indent, out);
    // A list straight inside a list (not valid HTML, but common) belongs to the item above it.
    else if (tag === "ul" || tag === "ol") list(c, tag === "ol", ctx, `${indent}  `, out);
    else if (!SKIP.has(tag)) blocks([c], ctx, indent, out);
  }
  out.push("");
}

function item(li: Node, marker: string, ctx: Ctx, indent: string, out: string[]) {
  const kids: Node[] = [...li.childNodes];
  let i = 0;
  let line = "";
  let box: boolean | null = null;
  for (; i < kids.length; i++) {
    const k = kids[i];
    const tag = k.nodeType === 1 ? tagOf(k) : "";
    if (tag === "input" && k.getAttribute("type") === "checkbox") {
      box = k.hasAttribute("checked");
      continue;
    }
    if (isInline(k)) {
      line += inline([k], ctx);
      continue;
    }
    if (k.nodeType !== 1 || SKIP.has(tag)) continue;
    // "<li><p>First line</p>…" is the item's own text, not a paragraph under it.
    if (tag === "p" && !trimInline(line)) {
      line = inline(k.childNodes, ctx);
      i++;
    }
    break;
  }
  const mark = box === null ? marker : `- [${box ? "x" : " "}] `;
  // Items of one list stay together, with no blank line between them.
  out.push(indent + mark + trimInline(line).replace(/ {2,}/g, " "));
  flushHoisted(ctx, `${indent}  `, out);
  blocks(kids.slice(i), ctx, `${indent}  `, out);
}

function quote(el: Node, ctx: Ctx, indent: string, out: string[]) {
  const inner: string[] = [];
  blocks(el.childNodes, ctx, "", inner);
  const lines: string[] = [];
  const after: string[] = [];
  for (const l of inner) {
    const t = l.trim();
    if (!t || /^(`{3,}|~{3,})/.test(t)) continue;
    if (/^(!\[|<embed )/.test(t)) after.push(t);
    else lines.push(t.replace(/^#{1,3}\s+/, ""));
  }
  if (lines.length) emit(out, lines.map((l) => `${indent}> ${l}`).join("\n"));
  for (const a of after) emit(out, indent + a);
}

function code(el: Node, indent: string, out: string[]) {
  const inner = el.querySelector("code");
  const classes = `${el.getAttribute("class") ?? ""} ${inner?.getAttribute("class") ?? ""}`;
  let lang = (/\b(?:lang(?:uage)?-|brush:\s*)([\w+#.-]+)/i.exec(classes)?.[1] ?? el.getAttribute("data-lang") ?? el.getAttribute("data-language") ?? "").toLowerCase();
  if (!/^[\w+#.-]{0,30}$/.test(lang)) lang = "";
  const body = String(el.textContent ?? "").replace(/^\n/, "").replace(/\s+$/, "");
  if (!body.trim()) return;
  // In Dovli a mermaid block becomes a flowchart, and it only draws flowcharts.
  if (lang === "mermaid" && !/^\s*(flowchart|graph)\b/.test(body)) lang = "text";
  const fence = body.includes("```") ? "````" : "```";
  emit(out, [indent + fence + lang, ...body.split("\n").map((l) => indent + l), indent + fence].join("\n"));
}

function table(el: Node, ctx: Ctx, indent: string, out: string[]) {
  // A table holding tables is page layout, not data.
  if (el.querySelector("table")) return blocks(el.childNodes, ctx, indent, out);
  const rows: string[][] = [...el.querySelectorAll("tr")]
    .map((tr: Node) =>
      [...tr.children]
        .filter((c: Node) => /^t[hd]$/.test(tagOf(c)))
        .map((c: Node) => trimInline(inline(c.childNodes, ctx)).replace(/ {2,}/g, " ").replace(/\|/g, "\\|")),
    )
    .filter((r) => r.some(Boolean));
  if (!rows.length) return;
  const width = Math.max(...rows.map((r) => r.length));
  // One column is a list of lines laid out as a table.
  if (width < 2) {
    for (const r of rows) paragraph(r[0] ?? "", ctx, indent, out);
    return;
  }
  const line = (r: string[]) => `${indent}| ${Array.from({ length: width }, (_, i) => r[i] || " ").join(" | ")} |`;
  emit(out, [line(rows[0]), `${indent}| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n"));
  flushHoisted(ctx, indent, out);
}

/** HTML (a whole page or a part of one) as Dovli Markdown. */
export function htmlToMarkdown(html: string, pageUrl: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const ctx: Ctx = { base: new URL(pageUrl), hoist: [] };
  const out: string[] = [];
  blocks(document.body.childNodes, ctx, "", out);
  flushHoisted(ctx, "", out);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const meta = (doc: Node, ...names: string[]) => {
  for (const n of names) {
    const v = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute("content")?.trim();
    if (v) return v;
  }
  return "";
};

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** "How to bake bread | The Kitchen" → "How to bake bread", when the site's name (or its address) is known. */
export function cleanTitle(title: string, siteName: string, host = ""): string {
  let t = words(title).trim();
  if (siteName) {
    const site = siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cut = t.replace(new RegExp(`\\s+[|\\-–—·•:]\\s+${site}$`, "i"), "").replace(new RegExp(`^${site}\\s+[|\\-–—·•:]\\s+`, "i"), "");
    if (cut) t = cut;
  }
  // "Thinking in React – React" on react.dev: the last part is the site's name.
  const tail = /^(.+?)\s+[|–—·•]\s+([^|–—·•]{2,40})$/.exec(t);
  const name = tail ? squash(tail[2]) : "";
  if (name.length > 1 && squash(host).includes(name)) t = tail![1];
  return t.slice(0, 200);
}

/**
 * The main text of a page (no menus, ads, comments or footers) as Dovli Markdown, with its title
 * and details. Null when the page has no readable text, like an app that draws itself with JavaScript.
 */
export function readArticle(body: string, pageUrl: string, kind: "html" | "text" = "html"): Article | null {
  const host = new URL(pageUrl).hostname.replace(/^www\./, "");
  if (kind === "text") {
    const paras = body.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((p) => text(p).trim()).filter(Boolean);
    if (!paras.length) return null;
    const markdown = paras.map((p) => (LOOKS_LIKE_SYNTAX.test(p) ? `\\${p}` : p)).join("\n\n");
    const { pathname } = new URL(pageUrl);
    const name = decodeURIComponent(pathname.split("/").pop() || "");
    const style = pickStyle({ host, path: pathname, title: name, about: "", types: [], headings: "", body: markdown.slice(0, 8000), codeBlocks: 0, themeColor: "" });
    return { title: name || host, siteName: host, byline: "", published: "", markdown, words: words(body).trim().split(" ").length, style };
  }

  const { document } = parseHTML(body);
  // A <base href> changes what relative links on the page point at.
  let base = pageUrl;
  try {
    const href = document.querySelector("base[href]")?.getAttribute("href");
    if (href) base = new URL(href, pageUrl).href;
  } catch {
    /* keep the page's own address */
  }
  const siteMeta = meta(document, "og:site_name", "application-name");
  const fallbackTitle = meta(document, "og:title", "twitter:title") || words(document.querySelector("title")?.textContent ?? "").trim();
  const published = meta(document, "article:published_time", "date", "pubdate", "dc.date");
  const signals = {
    about: [meta(document, "description", "og:description"), meta(document, "keywords", "news_keywords"), meta(document, "article:section"), ...[...document.querySelectorAll('meta[property="article:tag"]')].map((m: Node) => m.getAttribute("content") ?? "")].join(" "),
    types: [meta(document, "og:type"), ...schemaTypes(document)].filter(Boolean),
    themeColor: meta(document, "theme-color", "msapplication-TileColor"),
  };

  // Some sites hide the whole page until their script runs, so it doesn't flash unstyled (GeeksforGeeks
  // does). A reader sees it once the script has run, so Dovli shows it too. Small hidden things stay hidden.
  for (const el of document.querySelectorAll("[style*=visibility]")) {
    const style = el.getAttribute("style") ?? "";
    if (/visibility\s*:\s*hidden/i.test(style) && (el.textContent ?? "").length > 2000) el.setAttribute("style", style.replace(/visibility\s*:\s*hidden\s*;?/gi, ""));
  }

  // Readability changes the document as it works, so the details above are read first.
  const read = new Readability(document as any, { charThreshold: 200, keepClasses: true }).parse();
  if (!read?.content) return null;
  const markdown = htmlToMarkdown(read.content, base);
  const count = words(read.textContent ?? "").trim().split(" ").filter(Boolean).length;
  if (!markdown) return null;
  // Not Readability's guess at the site's name: that's often the publisher ("Wikimedia Foundation, Inc.").
  const siteName = siteMeta || host;
  const title = cleanTitle(read.title || fallbackTitle || host, siteName, host);
  const style = pickStyle({
    ...signals,
    host,
    path: new URL(pageUrl).pathname,
    title,
    headings: markdown.match(/^\s*#{1,3} .*$/gm)?.join("\n") ?? "",
    body: markdown.slice(0, 8000),
    codeBlocks: Math.floor((markdown.match(/^\s*`{3,}/gm)?.length ?? 0) / 2),
  } satisfies StyleSignals);
  return {
    title,
    siteName: words(siteName).trim().slice(0, 120),
    byline: words(read.byline ?? "").trim().slice(0, 160),
    published: words(read.publishedTime || published).trim().slice(0, 60),
    markdown,
    words: count,
    style,
  };
}

/** Every schema.org type the page declares in JSON-LD ("Recipe", "NewsArticle"…), including inside @graph. */
function schemaTypes(doc: Node): string[] {
  const out: string[] = [];
  const walk = (v: any, depth: number) => {
    if (!v || typeof v !== "object" || depth > 4 || out.length > 20) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    for (const t of [v["@type"]].flat()) if (typeof t === "string") out.push(t);
    if (v["@graph"]) walk(v["@graph"], depth + 1);
    if (v.mainEntity) walk(v.mainEntity, depth + 1);
  };
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(script.textContent ?? ""), 0);
    } catch {
      /* broken JSON-LD is common; skip it */
    }
  }
  return out;
}

/* ---------- For the AI ---------- */

/** The page's text for the AI to read: without pictures and players, cut at a line if it's too long. */
export function sourceForAI(markdown: string, max: number): { text: string; cut: boolean } {
  const t = markdown
    .split("\n")
    .filter((l) => !/^\s*(!\[[^\]]*\]\([^)]*\)|<embed [^>]*\/>)\s*$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (t.length <= max) return { text: t, cut: false };
  const at = t.lastIndexOf("\n", max);
  return { text: t.slice(0, at > max * 0.8 ? at : max).trim(), cut: true };
}

/** The AI's notes, without a code fence around them, the page title repeated as the first heading, or Markdown's two-space line ends. */
export function tidyNotes(answer: string, title: string): string {
  let t = answer.trim().replace(/[ \t]+$/gm, "");
  const fenced = /^```(?:markdown|md)?[ \t]*\n([\s\S]*?)\n```\s*$/i.exec(t);
  if (fenced) t = fenced[1].trim();
  const same = (a: string) => a.replace(/[*_`#]/g, "").trim().toLowerCase() === title.trim().toLowerCase();
  t = t.replace(/^#\s+(.+)\n+/, (m, h) => (same(h) ? "" : m));
  return t.trim();
}
