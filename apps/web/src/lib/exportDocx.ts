// One page as a Word document (.docx), built in the browser with the `docx` library.
// Headings, bold/italic/underline/strike/code, colours, links, bullet and numbered lists, to-dos,
// quotes, callouts, code blocks, tables, pictures and dividers. Blocks Word has no match for
// (embeds, whiteboards inside pages) become a short line saying what was there.

import type { Page } from "@dovli/core";
import { displayTitle, fileIdFromUrl } from "@dovli/core";
import { getFile } from "./files";

type Docx = typeof import("docx");

/** BlockNote's colour names, as hex for Word. */
const COLOURS: Record<string, string> = {
  gray: "787774", brown: "9F6B53", red: "D44C47", orange: "D9730D", yellow: "CB912F",
  green: "448361", blue: "337EA9", purple: "9065B0", pink: "C14C8A",
};
const HIGHLIGHT: Record<string, string> = {
  gray: "lightGray", brown: "darkYellow", red: "red", orange: "yellow", yellow: "yellow",
  green: "green", blue: "cyan", purple: "magenta", pink: "magenta",
};

function runs(d: Docx, content: any, extra: Record<string, unknown> = {}): any[] {
  if (typeof content === "string") return [new d.TextRun({ text: content, ...extra })];
  if (!Array.isArray(content)) return [];
  const out: any[] = [];
  for (const c of content) {
    if (c?.type === "text") {
      const s = c.styles ?? {};
      out.push(
        new d.TextRun({
          text: c.text ?? "",
          bold: !!s.bold,
          italics: !!s.italic,
          underline: s.underline ? {} : undefined,
          strike: !!s.strike,
          font: s.code ? "Consolas" : undefined,
          color: COLOURS[s.textColor] ?? undefined,
          highlight: HIGHLIGHT[s.backgroundColor] as any,
          ...extra,
        }),
      );
    } else if (c?.type === "link") {
      out.push(new d.ExternalHyperlink({ link: c.href, children: runs(d, c.content, { style: "Hyperlink", ...extra }) }));
    } else if (typeof c?.text === "string") {
      out.push(new d.TextRun({ text: c.text, ...extra }));
    }
  }
  return out;
}

const plain = (content: any): string =>
  typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => (c?.type === "link" ? plain(c.content) : (c?.text ?? ""))).join("") : "";

async function picture(d: Docx, url: string): Promise<any | null> {
  try {
    const id = fileIdFromUrl(url);
    const blob = id ? (await getFile(id))?.blob : await (await fetch(url)).blob();
    if (!blob) return null;
    const type = blob.type.includes("png") ? "png" : blob.type.includes("gif") ? "gif" : blob.type.includes("bmp") ? "bmp" : blob.type.includes("jpeg") || blob.type.includes("jpg") ? "jpg" : null;
    if (!type) return null;
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 600 / bmp.width);
    const size = { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) };
    bmp.close();
    return new d.Paragraph({ children: [new d.ImageRun({ type, data: new Uint8Array(await blob.arrayBuffer()), transformation: size } as any)] });
  } catch {
    return null; // a picture that can't be reached is left out rather than failing the export
  }
}

async function blocksToDocx(d: Docx, blocks: any[], level = 0): Promise<any[]> {
  const out: any[] = [];
  for (const b of blocks ?? []) {
    const p = b.props ?? {};
    const align = p.textAlignment === "center" ? d.AlignmentType.CENTER : p.textAlignment === "right" ? d.AlignmentType.RIGHT : p.textAlignment === "justify" ? d.AlignmentType.JUSTIFIED : undefined;
    switch (b.type) {
      case "heading": {
        const h = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3, d.HeadingLevel.HEADING_4][Math.min(3, (p.level ?? 1) - 1)];
        out.push(new d.Paragraph({ heading: h, alignment: align, children: runs(d, b.content) }));
        break;
      }
      case "bulletListItem":
        out.push(new d.Paragraph({ bullet: { level: Math.min(level, 8) }, children: runs(d, b.content) }));
        break;
      case "numberedListItem":
        out.push(new d.Paragraph({ numbering: { reference: "numbers", level: Math.min(level, 8) }, children: runs(d, b.content) }));
        break;
      case "checkListItem":
        out.push(new d.Paragraph({ indent: { left: 360 * level }, children: [new d.TextRun({ text: p.checked ? "☑ " : "☐ " }), ...runs(d, b.content, p.checked ? { strike: true, color: "787774" } : {})] }));
        break;
      case "toggleListItem":
        out.push(new d.Paragraph({ indent: { left: 360 * level }, children: [new d.TextRun({ text: "▸ " }), ...runs(d, b.content)] }));
        break;
      case "quote":
        out.push(new d.Paragraph({ style: "Quote", border: { left: { style: d.BorderStyle.SINGLE, size: 12, color: "5146D9", space: 8 } }, indent: { left: 240 }, children: runs(d, b.content, { italics: true }) }));
        break;
      case "callout":
        out.push(
          new d.Paragraph({
            shading: { type: d.ShadingType.CLEAR, fill: "F1F0FB", color: "auto" },
            border: { left: { style: d.BorderStyle.SINGLE, size: 18, color: "5146D9", space: 8 } },
            spacing: { before: 120, after: 120 },
            children: [new d.TextRun({ text: `${p.icon || "💡"} ` }), ...runs(d, b.content)],
          }),
        );
        break;
      case "codeBlock":
        for (const line of plain(b.content).split("\n"))
          out.push(new d.Paragraph({ shading: { type: d.ShadingType.CLEAR, fill: "F3F4F6", color: "auto" }, spacing: { before: 0, after: 0 }, children: [new d.TextRun({ text: line || " ", font: "Consolas", size: 20 })] }));
        out.push(new d.Paragraph({ children: [] }));
        break;
      case "table": {
        const rows = (b.content?.rows ?? []) as { cells: any[] }[];
        if (rows.length)
          out.push(
            new d.Table({
              width: { size: 100, type: d.WidthType.PERCENTAGE },
              rows: rows.map(
                (r, i) =>
                  new d.TableRow({
                    tableHeader: i === 0,
                    children: r.cells.map((cell) => new d.TableCell({ children: [new d.Paragraph({ children: runs(d, Array.isArray(cell) ? cell : (cell?.content ?? []), i === 0 ? { bold: true } : {}) })] })),
                  }),
              ),
            }),
          );
        break;
      }
      case "image": {
        const img = p.url ? await picture(d, p.url) : null;
        if (img) out.push(img);
        if (p.caption) out.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ text: p.caption, italics: true, color: "787774", size: 20 })] }));
        break;
      }
      case "divider":
        out.push(new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: "D0D0D8", space: 1 } }, children: [] }));
        break;
      case "paragraph":
      case "caption":
        out.push(new d.Paragraph({ alignment: align, children: runs(d, b.content, b.type === "caption" ? { color: "787774", size: 20 } : {}) }));
        break;
      default: {
        // Blocks Word can't show: say what was there, with a link when there is one.
        const label = { video: "Video", audio: "Audio", file: "File", pdf: "PDF", embed: "Embed", flowchart: "Diagram", dataTable: "Table", subpage: "Page", pageLink: "Page link" }[b.type as string] ?? "Block";
        const text = plain(b.content) || p.name || p.title || p.url || "";
        out.push(new d.Paragraph({ children: [new d.TextRun({ text: `[${label}${text ? `: ${text}` : ""}]`, color: "787774", italics: true })] }));
      }
    }
    if (b.children?.length) out.push(...(await blocksToDocx(d, b.children, level + 1)));
  }
  return out;
}

/** Build the .docx for a page (a document page; whiteboards export as PDF or image). */
export async function pageDocx(page: Page): Promise<Blob> {
  const d = await import("docx");
  const body = await blocksToDocx(d, page.blocks ?? []);
  const doc = new d.Document({
    creator: "Dovli",
    title: displayTitle(page),
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 120, line: 300 } } } },
      paragraphStyles: [{ id: "Quote", name: "Quote", basedOn: "Normal", run: { color: "464B58" } }],
    },
    numbering: {
      config: [
        {
          reference: "numbers",
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: [d.LevelFormat.DECIMAL, d.LevelFormat.LOWER_LETTER, d.LevelFormat.LOWER_ROMAN][i % 3],
            text: `%${i + 1}.`,
            alignment: d.AlignmentType.START,
            style: { paragraph: { indent: { left: 360 * (i + 1), hanging: 260 } } },
          })),
        },
      ],
    },
    sections: [{ children: [new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun({ text: `${page.mark && !/^[¶◇]$/.test(page.mark) ? `${page.mark} ` : ""}${displayTitle(page)}` })] }), ...body] }],
  });
  return d.Packer.toBlob(doc);
}
