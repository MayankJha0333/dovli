import { classify, toEmbedProps } from "./links";

// Small helpers for writing BlockNote documents by hand (templates + sample pages).
// Inline text supports **bold**, *italic* and `code`.

type Inline = { type: "text"; text: string; styles: Record<string, boolean> };

export function rich(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ type: "text", text: src.slice(last, m.index), styles: {} });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ type: "text", text: tok.slice(2, -2), styles: { bold: true } });
    else if (tok.startsWith("`")) out.push({ type: "text", text: tok.slice(1, -1), styles: { code: true } });
    else out.push({ type: "text", text: tok.slice(1, -1), styles: { italic: true } });
    last = m.index + tok.length;
  }
  if (last < src.length) out.push({ type: "text", text: src.slice(last), styles: {} });
  return out;
}

export const h1 = (t: string) => ({ type: "heading", props: { level: 1 }, content: rich(t) });
export const h2 = (t: string) => ({ type: "heading", props: { level: 2 }, content: rich(t) });
export const h3 = (t: string) => ({ type: "heading", props: { level: 3 }, content: rich(t) });
export const p = (t = "") => ({ type: "paragraph", content: rich(t) });
export const li = (t: string, children: any[] = []) => ({ type: "bulletListItem", content: rich(t), children });
export const num = (t: string) => ({ type: "numberedListItem", content: rich(t) });
export const todo = (t: string, checked = false) => ({ type: "checkListItem", props: { checked }, content: rich(t) });
export const toggle = (t: string, children: any[]) => ({ type: "toggleListItem", content: rich(t), children });
export const quote = (t: string) => ({ type: "quote", content: rich(t) });
export const code = (language: string, t: string) => ({ type: "codeBlock", props: { language }, content: t });
export const divider = () => ({ type: "divider" });
export const table = (rows: string[][]) => ({
  type: "table",
  content: { type: "tableContent", rows: rows.map((cells) => ({ cells })) },
});
export const subpage = (pageId: string) => ({ type: "subpage", props: { pageId } });
export const flowchart = () => ({ type: "flowchart" });
/** A link preview; its title and image are fetched the first time the page opens. */
export const embed = (url: string) => ({ type: "embed", props: toEmbedProps(classify(url), "loading") });

/** Turn a list of blocks into short preview lines for template thumbnails. */
export function previewLines(blocks: any[], max = 9): { kind: string; text: string }[] {
  const lines: { kind: string; text: string }[] = [];
  const text = (b: any) =>
    Array.isArray(b.content) ? b.content.map((c: any) => c.text ?? "").join("") : typeof b.content === "string" ? b.content : "";
  const walk = (bs: any[]) => {
    for (const b of bs) {
      if (lines.length >= max) return;
      if (b.type === "heading") lines.push({ kind: `h${b.props?.level ?? 1}`, text: text(b) });
      else if (b.type === "checkListItem") lines.push({ kind: "todo", text: text(b) });
      else if (b.type === "bulletListItem" || b.type === "numberedListItem") lines.push({ kind: "li", text: text(b) });
      else if (b.type === "table") lines.push({ kind: "table", text: "" });
      else if (b.type === "divider") lines.push({ kind: "rule", text: "" });
      else if (text(b)) lines.push({ kind: "p", text: text(b) });
    }
  };
  walk(blocks);
  return lines;
}
