// Pages as Markdown, and Markdown as pages, without an editor (so it also runs on the server).
// This is what AI apps read and write through Dovli's MCP server, in the spirit of Craft's
// ("--format markdown", "blocks add --markdown"). Plain Markdown, plus a few small extensions for
// what Markdown has no word for:
//
//   # / ## / ###            headings          - item / 1. item     lists (indent 2 spaces to nest)
//   - [ ] / - [x]           to-dos            + Toggle             a toggle (its children indented)
//   > text                  quote             ```lang … ```        code
//   ```mermaid flowchart TD …```  a flowchart (Dovli draws it as an editable flowchart block)
//   ---                     divider           | a | b |            table
//   ![caption](url)         picture           <callout tone="tip" emoji="💡">text</callout>
//   > [!TIP] text           also a callout    <small>text</small>  small grey caption text
//   <embed url="…"/>        link preview      <page id="…" title="…"/>  a page inside this one
//   <block id="…" type="…"/>  any other block (whiteboard sketch, data table, file): kept as it is
//   **bold** *italic* ~~strike~~ `code` <u>underline</u> ==highlight== [link](https://…)
//   [Title](dovli:page/ID) or [[Title]]   a link to another Dovli page            <br>  line break

import { classify, toEmbedProps } from "./links";

/** A flowchart block's scene that is still Mermaid text. The editor turns it into shapes the first time it shows. */
export const mermaidScene = (code: string) => JSON.stringify({ mermaid: code.trim().slice(0, 20_000) });

/**
 * A flowchart block's drawing written back as Mermaid, so an AI can read it and redraw it changed:
 * boxes, diamonds and ovals with their labels, and the arrows between them (with their labels).
 * Mermaid that hasn't been drawn yet comes back as it is. Null when there's nothing to read.
 */
export function flowchartToMermaid(scene: string): string | null {
  let s: any;
  try {
    s = JSON.parse(scene);
  } catch {
    return null;
  }
  if (typeof s?.mermaid === "string") return s.mermaid;
  const els: any[] = (Array.isArray(s?.elements) ? s.elements : []).filter((e: any) => e && !e.isDeleted);
  const textOf = new Map<string, string>();
  for (const e of els) if (e.type === "text" && e.containerId) textOf.set(e.containerId, String(e.originalText ?? e.text ?? "").replace(/\s+/g, " ").trim());
  const shapes = els.filter((e) => e.type === "rectangle" || e.type === "diamond" || e.type === "ellipse");
  if (!shapes.length) return null;
  const ids = new Map(shapes.map((e, i) => [e.id, `n${i + 1}`]));
  const q = (t: string) => `"${t.replace(/"/g, "#quot;")}"`;
  const node = (e: any) => {
    const label = q(textOf.get(e.id) || " ");
    return `${ids.get(e.id)}${e.type === "diamond" ? `{${label}}` : e.type === "ellipse" ? `([${label}])` : `[${label}]`}`;
  };
  // Wider than tall: left to right.
  const xs = shapes.map((e) => e.x ?? 0);
  const ys = shapes.map((e) => e.y ?? 0);
  const wide = Math.max(...xs) - Math.min(...xs) > (Math.max(...ys) - Math.min(...ys)) * 1.3;
  const lines = [`flowchart ${wide ? "LR" : "TD"}`, ...shapes.map((e) => `  ${node(e)}`)];
  for (const a of els) {
    if (a.type !== "arrow") continue;
    const from = ids.get(a.startBinding?.elementId);
    const to = ids.get(a.endBinding?.elementId);
    if (!from || !to) continue;
    const label = textOf.get(a.id);
    lines.push(`  ${from} -->${label ? `|${q(label)}|` : ""} ${to}`);
  }
  return lines.join("\n");
}

const OPENERS: [string, string][] = [
  ["[[", "]]"], ["[(", ")]"], ["([", "])"], ["((", "))"], ["{{", "}}"], ["[/", "/]"], ["[\\", "\\]"], ["[", "]"], ["(", ")"], ["{", "}"], [">", "]"],
];
// What may follow a node's closing bracket: the end of the line, an arrow, "&", ";" or a class.
const AFTER_NODE = /^\s*($|-->|---|-\.|==>|--|<--|&|;|:::|~~~)/;
const SPECIAL = /[()[\]{}<>"#;:|]/;

/**
 * Make AI-written Mermaid flowcharts parse. The usual mistake is brackets or other symbols inside
 * a label, like A[Check memory (cache)], which Mermaid only accepts in quotes: A["Check memory (cache)"].
 * Other diagram types are returned as they are.
 */
export function tidyMermaid(code: string): string {
  const lines = code.split("\n");
  if (!/^\s*(flowchart|graph)\b/.test(lines.find((l) => l.trim()) ?? "")) return code;
  const quote = (t: string) => `"${t.trim().replace(/"/g, "#quot;")}"`;
  return lines
    .map((line) => {
      if (/^\s*(%%|classDef|class |style |linkStyle|click |subgraph|end\b|direction|flowchart|graph)/.test(line)) return line;
      let out = "";
      let i = 0;
      while (i < line.length) {
        // Edge label: -->|text|
        if (line[i] === "|") {
          const close = line.indexOf("|", i + 1);
          if (close > i) {
            const label = line.slice(i + 1, close);
            out += `|${SPECIAL.test(label) && !/^\s*".*"\s*$/.test(label) ? quote(label) : label}|`;
            i = close + 1;
            continue;
          }
        }
        // Node: an id followed by its shape and label.
        const id = /^[A-Za-z0-9_][\w-]*/.exec(line.slice(i));
        const before = i === 0 ? "" : line[i - 1];
        if (id && !/[\w-]/.test(before)) {
          const j = i + id[0].length;
          const shape = OPENERS.find(([o]) => line.startsWith(o, j));
          if (shape) {
            const [open, close] = shape;
            const start = j + open.length;
            let end = -1;
            for (let k = line.indexOf(close, start); k >= 0; k = line.indexOf(close, k + 1)) {
              if (AFTER_NODE.test(line.slice(k + close.length))) {
                end = k;
                break;
              }
            }
            if (end >= 0) {
              const label = line.slice(start, end);
              const fixed = SPECIAL.test(label) && !/^\s*".*"\s*$/.test(label) ? quote(label) : label;
              out += id[0] + open + fixed + close;
              i = end + close.length;
              continue;
            }
          }
          out += id[0];
          i = j;
          continue;
        }
        out += line[i];
        i++;
      }
      return out;
    })
    .join("\n");
}

type Styles = Record<string, any>;
export type Inline =
  | { type: "text"; text: string; styles: Styles }
  | { type: "link"; href: string; content: { type: "text"; text: string; styles: Styles }[] }
  | { type: "pageLink"; props: { pageId: string; title: string } };

export interface ToBlocksOptions {
  /** Blocks already in the page, by id, so <block id="…"/> keeps them exactly as they were. */
  existing?: Map<string, any>;
  /** Turn [[Title]] into a link to that page, when one has that title. */
  findPage?: (title: string) => { id: string; title: string } | null;
  /** Make a new block id (default: random). */
  newId?: () => string;
}

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function randomBlockId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let id = "";
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

const TEXT_PROPS = { textColor: "default", backgroundColor: "default", textAlignment: "left" };
const TONES = ["note", "tip", "warning", "danger"];
const ALERTS: Record<string, string> = { NOTE: "note", TIP: "tip", IMPORTANT: "note", WARNING: "warning", CAUTION: "danger", DANGER: "danger" };

// ---------------------------------------------------------------- inline text → Markdown

const escapeText = (s: string) => s.replace(/([\\`*_[\]~<])/g, "\\$1").replace(/==/g, "=\\=");

function runToMd(text: string, styles: Styles): string {
  if (!text) return "";
  if (styles.code) {
    const ticks = text.includes("`") ? "``" : "`";
    return `${ticks}${ticks === "``" ? " " : ""}${text}${ticks === "``" ? " " : ""}${ticks}`;
  }
  // Keep spaces outside the marks (**word** , not ** word **), so the Markdown stays valid.
  const lead = text.match(/^\s*/)![0];
  const trail = text.slice(lead.length).match(/\s*$/)![0];
  let core = escapeText(text.slice(lead.length, text.length - trail.length)).replace(/\n/g, "<br>");
  if (!core) return lead + trail;
  if (styles.underline) core = `<u>${core}</u>`;
  if (styles.backgroundColor && styles.backgroundColor !== "default") core = `==${core}==`;
  if (styles.strike) core = `~~${core}~~`;
  if (styles.italic) core = `*${core}*`;
  if (styles.bold) core = `**${core}**`;
  return lead + core + trail;
}

export function inlineToMarkdown(content: any): string {
  if (typeof content === "string") return escapeText(content).replace(/\n/g, "<br>");
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const c of content) {
    if (!c) continue;
    if (typeof c === "string") out += escapeText(c);
    else if (c.type === "text") out += runToMd(c.text ?? "", c.styles ?? {});
    else if (c.type === "link") out += `[${inlineToMarkdown(c.content) || escapeText(c.href ?? "")}](${c.href ?? ""})`;
    else if (c.type === "pageLink") out += `[${escapeText(c.props?.title || "Untitled")}](dovli:page/${c.props?.pageId ?? ""})`;
    else if (typeof c.text === "string") out += escapeText(c.text);
  }
  return out;
}

// ---------------------------------------------------------------- Markdown → inline text

export function markdownToInline(src: string, opts: ToBlocksOptions = {}, styles: Styles = {}): Inline[] {
  const out: Inline[] = [];
  const push = (text: string, st: Styles = styles) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last?.type === "text" && JSON.stringify(last.styles) === JSON.stringify(st)) last.text += text;
    else out.push({ type: "text", text, styles: { ...st } });
  };
  const pair = (open: string, close: string, from: number) => {
    for (let j = from; j < src.length; j++) {
      if (src[j] === "\\") {
        j++;
        continue;
      }
      if (src.startsWith(close, j)) return j;
      if (open === "`") continue;
    }
    return -1;
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const rest = src.slice(i);
    if (ch === "\\" && i + 1 < src.length) {
      push(src[i + 1]);
      i += 2;
      continue;
    }
    if (/^<br\s*\/?>/i.test(rest)) {
      push("\n");
      i += rest.match(/^<br\s*\/?>/i)![0].length;
      continue;
    }
    if (ch === "`") {
      const ticks = rest.startsWith("``") ? "``" : "`";
      const end = src.indexOf(ticks, i + ticks.length);
      if (end > i) {
        let code = src.slice(i + ticks.length, end);
        if (ticks === "``") code = code.replace(/^ | $/g, "");
        push(code, { ...styles, code: true });
        i = end + ticks.length;
        continue;
      }
    }
    if (rest.startsWith("[[")) {
      const end = src.indexOf("]]", i + 2);
      if (end > i) {
        const title = src.slice(i + 2, end).trim();
        const found = opts.findPage?.(title);
        if (found) out.push({ type: "pageLink", props: { pageId: found.id, title: found.title } });
        else push(title);
        i = end + 2;
        continue;
      }
    }
    if (ch === "[") {
      const close = pair("[", "]", i + 1);
      if (close > i && src[close + 1] === "(") {
        const paren = src.indexOf(")", close + 2);
        if (paren > close) {
          const label = src.slice(i + 1, close);
          const href = src.slice(close + 2, paren).trim().replace(/^<|>$/g, "");
          const page = /^dovli:(?:\/\/)?page\/([A-Za-z0-9_-]{1,128})$/.exec(href);
          if (page) out.push({ type: "pageLink", props: { pageId: page[1], title: label.replace(/\\(.)/g, "$1") || "Untitled" } });
          else if (/^(https?:|mailto:|tel:)/i.test(href)) {
            const inner = markdownToInline(label, opts, styles).filter((x): x is Extract<Inline, { type: "text" }> => x.type === "text");
            out.push({ type: "link", href, content: inner.length ? inner : [{ type: "text", text: href, styles: {} }] });
          } else push(label);
          i = paren + 1;
          continue;
        }
      }
    }
    const marks: [string, string, string][] = [
      ["**", "**", "bold"],
      ["__", "__", "bold"],
      ["~~", "~~", "strike"],
      ["==", "==", "highlight"],
      ["<u>", "</u>", "underline"],
      ["*", "*", "italic"],
      ["_", "_", "italic"],
    ];
    let matched = false;
    for (const [open, close, style] of marks) {
      if (!rest.startsWith(open)) continue;
      // _ only starts italics at a word edge (so snake_case stays as it is).
      if (open === "_" && /[A-Za-z0-9]/.test(src[i - 1] ?? "")) continue;
      if (open.length === 1 && src[i + 1] === open) continue;
      const end = pair(open, close, i + open.length);
      if (end <= i + open.length - 1 || end === i + open.length) continue;
      if (open === "_" && /[A-Za-z0-9]/.test(src[end + 1] ?? "")) continue;
      const inner = src.slice(i + open.length, end);
      const st = style === "highlight" ? { ...styles, backgroundColor: "yellow" } : { ...styles, [style]: true };
      for (const part of markdownToInline(inner, opts, st)) {
        if (part.type === "text") push(part.text, part.styles);
        else out.push(part);
      }
      i = end + close.length;
      matched = true;
      break;
    }
    if (matched) continue;
    push(ch);
    i++;
  }
  return out;
}

// ---------------------------------------------------------------- blocks → Markdown

const plain = (content: any): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((c: any) => (c?.type === "link" ? plain(c.content) : c?.type === "pageLink" ? (c.props?.title ?? "") : (c?.text ?? ""))).join("");
};
const attr = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const unattr = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&");

function cellContent(cell: any): any {
  if (typeof cell === "string") return cell;
  if (Array.isArray(cell)) return cell;
  return cell?.content ?? [];
}

function tableToMd(block: any): string[] {
  const rows: any[] = block.content?.rows ?? [];
  if (!rows.length) return [];
  const cells = rows.map((r) => (r.cells ?? []).map((c: any) => inlineToMarkdown(cellContent(c)).replace(/\|/g, "\\|") || " "));
  const width = Math.max(...cells.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? " ").join(" | ")} |`;
  return [line(cells[0]), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...cells.slice(1).map(line)];
}

/** One block (without its children) as Markdown lines. `n` is its number in a numbered list. */
export function blockToMarkdown(b: any, n = 1): string[] {
  const p = b.props ?? {};
  const text = inlineToMarkdown(b.content);
  switch (b.type) {
    case "heading":
      return [`${"#".repeat(Math.min(3, Math.max(1, p.level ?? 1)))} ${text}`];
    case "bulletListItem":
      return [`- ${text}`];
    case "numberedListItem":
      return [`${n}. ${text}`];
    case "checkListItem":
      return [`- [${p.checked ? "x" : " "}] ${text}`];
    case "toggleListItem":
      return [`+ ${text}`];
    case "quote":
      return [`> ${text}`];
    case "codeBlock": {
      const code = typeof b.content === "string" ? b.content : plain(b.content);
      const fence = code.includes("```") ? "````" : "```";
      return [`${fence}${p.language && p.language !== "text" ? p.language : ""}`, ...code.split("\n"), fence];
    }
    case "divider":
      return ["---"];
    case "table":
      return tableToMd(b);
    case "image":
      return p.url ? [`![${escapeText(p.caption || p.name || "")}](${p.url})`] : [`<block id="${attr(b.id)}" type="image"/>`];
    case "callout":
      return [`<callout tone="${attr(p.tone || "note")}"${p.emoji ? ` emoji="${attr(p.emoji)}"` : ""}>${text}</callout>`];
    case "caption":
      return [`<small>${text}</small>`];
    case "embed": {
      // Embed blocks keep their address in `link` (see toEmbedProps).
      const href = p.link || p.url;
      return href ? [`<embed url="${attr(href)}"${p.title ? ` title="${attr(p.title)}"` : ""}/>`] : [];
    }
    case "subpage":
      return [`<page id="${attr(p.pageId)}"/>`];
    case "paragraph":
      return [/^(#{1,6}\s|[-+*]\s|\d+[.)]\s|>|```|---$|\|)/.test(text) ? `\\${text}` : text];
    default: {
      // Things Markdown can't hold (a whiteboard sketch, a data table, a video or file): named
      // by id, so writing the page back keeps them exactly as they are.
      const extra = p.url ? ` url="${attr(p.url)}"` : "";
      const name = p.name ? ` name="${attr(p.name)}"` : "";
      return [`<block id="${attr(b.id)}" type="${attr(b.type)}"${extra}${name}/>`];
    }
  }
}

/** A list of blocks (with their children, indented) as Markdown. */
export function blocksToMarkdown(blocks: any[] | undefined, indent = ""): string {
  if (!blocks?.length) return "";
  const parts: string[] = [];
  let n = 0;
  let prevType = "";
  blocks.forEach((b) => {
    n = b.type === "numberedListItem" ? (prevType === "numberedListItem" ? n + 1 : 1) : 0;
    const lines = blockToMarkdown(b, n || 1).map((l) => (l ? indent + l : l));
    const listy = /ListItem$/.test(b.type);
    // Lists stay together; everything else is separated by a blank line.
    if (parts.length && !(listy && /ListItem$/.test(prevType))) parts.push("");
    parts.push(...lines);
    if (b.children?.length) parts.push(blocksToMarkdown(b.children, indent + "  "));
    prevType = b.type;
  });
  return parts.join("\n").replace(/\n{3,}/g, "\n\n");
}

// ---------------------------------------------------------------- Markdown → blocks

type Line = { indent: number; text: string };

function readAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) out[m[1]] = unattr(m[2]);
  return out;
}

function splitRow(row: string): string[] {
  const cells: string[] = [];
  let cur = "";
  const body = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && body[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (body[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += body[i];
  }
  cells.push(cur.trim());
  return cells;
}

/** Turn Markdown into page blocks (with ids), nesting by indentation. */
export function markdownToBlocks(markdown: string, opts: ToBlocksOptions = {}): any[] {
  const newId = opts.newId ?? randomBlockId;
  const inline = (s: string) => markdownToInline(s, opts);
  const textBlock = (type: string, s: string, props: Record<string, any> = {}) => ({ id: newId(), type, props: { ...TEXT_PROPS, ...props }, content: inline(s), children: [] as any[] });

  const raw = markdown.replace(/\r\n?/g, "\n").split("\n");
  const lines: Line[] = raw.map((l) => {
    const m = l.match(/^[ \t]*/)![0];
    return { indent: m.replace(/\t/g, "  ").length, text: l.slice(m.length) };
  });

  const root: any[] = [];
  const stack: { indent: number; block: any }[] = [];
  const place = (block: any, indent: number) => {
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1]?.block;
    (parent ? (parent.children ??= []) : root).push(block);
    stack.push({ indent, block });
  };

  let para: { block: any; indent: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const { indent, text } = lines[i];
    if (!text.trim()) {
      para = null;
      continue;
    }
    // Code: everything up to the closing fence, as it is.
    const fence = /^(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/.exec(text);
    if (fence) {
      const body: string[] = [];
      let j = i + 1;
      for (; j < lines.length && !lines[j].text.startsWith(fence[1]); j++) body.push(raw[j].slice(Math.min(indent, raw[j].length - raw[j].trimStart().length)));
      const code = body.join("\n");
      // A Mermaid diagram becomes a real flowchart (drawn by the editor the first time it shows).
      if (fence[2].toLowerCase() === "mermaid" && code.trim()) place({ id: newId(), type: "flowchart", props: { scene: mermaidScene(code) }, children: [] }, indent);
      else place({ id: newId(), type: "codeBlock", props: { language: fence[2] || "text" }, content: code, children: [] }, indent);
      i = j;
      para = null;
      continue;
    }
    // Tables: a header row, a --- row, then rows.
    if (text.startsWith("|") && /^\|?\s*:?-{2,}/.test(lines[i + 1]?.text ?? "")) {
      const rows = [splitRow(text)];
      let j = i + 2;
      for (; j < lines.length && lines[j].text.startsWith("|"); j++) rows.push(splitRow(lines[j].text));
      const width = Math.max(...rows.map((r) => r.length));
      place(
        {
          id: newId(),
          type: "table",
          props: { textColor: "default" },
          content: { type: "tableContent", columnWidths: Array.from({ length: width }, () => undefined), rows: rows.map((r) => ({ cells: Array.from({ length: width }, (_, k) => inline(r[k] ?? "")) })) },
          children: [],
        },
        indent,
      );
      i = j - 1;
      para = null;
      continue;
    }
    // Callouts, possibly over several lines.
    const callout = /^<callout\b([^>]*)>(.*)$/i.exec(text);
    if (callout) {
      let body = callout[2];
      let j = i;
      while (!/<\/callout>\s*$/i.test(body) && j + 1 < lines.length) body += "<br>" + lines[++j].text;
      const a = readAttrs(callout[1]);
      const tone = TONES.includes(a.tone) ? a.tone : "note";
      place({ id: newId(), type: "callout", props: { tone, emoji: a.emoji ?? "" }, content: inline(body.replace(/<\/callout>\s*$/i, "").trim()), children: [] }, indent);
      i = j;
      para = null;
      continue;
    }
    const alert = /^>\s*\[!(\w+)\]\s*(.*)$/.exec(text);
    if (alert && ALERTS[alert[1].toUpperCase()]) {
      let body = alert[2];
      while (/^>/.test(lines[i + 1]?.text ?? "") && lines[i + 1].indent === indent) body += (body ? "<br>" : "") + lines[++i].text.replace(/^>\s?/, "");
      place({ id: newId(), type: "callout", props: { tone: ALERTS[alert[1].toUpperCase()], emoji: "" }, content: inline(body), children: [] }, indent);
      para = null;
      continue;
    }
    const tag = /^<(block|page|embed)\b([^>]*?)\/?>\s*(?:<\/\1>)?\s*$/i.exec(text);
    if (tag) {
      const a = readAttrs(tag[2]);
      const kind = tag[1].toLowerCase();
      const kept = a.id ? opts.existing?.get(a.id) : undefined;
      if (kind === "page" && a.id) place(kept?.type === "subpage" ? { ...kept, children: [] } : { id: newId(), type: "subpage", props: { pageId: a.id }, children: [] }, indent);
      else if (kind === "embed" && a.url) place({ id: newId(), type: "embed", props: toEmbedProps(classify(a.url), "loading"), children: [] }, indent);
      else if (kept) place({ ...kept, children: [] }, indent);
      para = null;
      continue;
    }
    const small = /^<small>(.*)<\/small>\s*$/i.exec(text);
    if (small) {
      place(textBlock("caption", small[1]), indent);
      para = null;
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/.exec(text);
    if (image) {
      place({ id: newId(), type: "image", props: { url: image[2], caption: image[1].replace(/\\(.)/g, "$1"), name: "", showPreview: true, backgroundColor: "default", textAlignment: "left" }, children: [] }, indent);
      para = null;
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(text))) {
      place(textBlock("heading", m[2], { level: Math.min(3, m[1].length) }), indent);
      para = null;
    } else if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(text)) {
      place({ id: newId(), type: "divider", props: {}, children: [] }, indent);
      para = null;
    } else if ((m = /^[-*]\s+\[([ xX])\]\s*(.*)$/.exec(text))) {
      place(textBlock("checkListItem", m[2], { checked: m[1].toLowerCase() === "x" }), indent);
      para = null;
    } else if ((m = /^[-*]\s+(.*)$/.exec(text))) {
      place(textBlock("bulletListItem", m[1]), indent);
      para = null;
    } else if ((m = /^\+\s+(.*)$/.exec(text))) {
      place(textBlock("toggleListItem", m[1]), indent);
      para = null;
    } else if ((m = /^\d+[.)]\s+(.*)$/.exec(text))) {
      place(textBlock("numberedListItem", m[1]), indent);
      para = null;
    } else if ((m = /^>\s?(.*)$/.exec(text))) {
      // A quote: following > lines join it.
      let body = m[1];
      while (/^>/.test(lines[i + 1]?.text ?? "") && !/^>\s*\[!/.test(lines[i + 1].text)) body += "<br>" + lines[++i].text.replace(/^>\s?/, "");
      place(textBlock("quote", body), indent);
      para = null;
    } else if (para && indent >= para.indent) {
      // Another line of the same paragraph.
      para.block.content.push({ type: "text", text: "\n", styles: {} }, ...inline(text));
    } else {
      const block = textBlock("paragraph", text);
      place(block, indent);
      para = { block, indent };
    }
  }
  return root;
}

/** Every block in a page, in reading order, with how deep it sits. */
export function flattenBlocks(blocks: any[] | undefined, depth = 0, out: { block: any; depth: number; parent: any[] }[] = []) {
  for (const b of blocks ?? []) {
    out.push({ block: b, depth, parent: blocks! });
    if (b.children?.length) flattenBlocks(b.children, depth + 1, out);
  }
  return out;
}
