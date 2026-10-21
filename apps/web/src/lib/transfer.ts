// Moving pages in and out of Dovli.
// Export: one page as Markdown or HTML, or the whole workspace as a ZIP (Markdown + HTML + files +
// a full backup). PDF export is in ./pdf.
// Import: Markdown, CSV, web pages, Word documents and web archives (and folders and ZIPs of them),
// which covers Notion, Craft and OneNote exports; Evernote (.enex); Confluence space exports; Dovli backups.

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { nanoid } from "nanoid";
import { displayTitle, childrenOf, fileIdFromUrl, withBlockIds, type Page } from "@dovli/core";
import { getStyle } from "@dovli/theme";
import { backupFile, parseBackupFile } from "./backups";
import { siteOrigin } from "./desktop";
import { getFile, saveFile } from "./files";
import { confluencePage, confluenceTree, finishBlocks, isConfluencePage, mhtPart, parseEnex, parseHtml, parseMht, tidy } from "./importers";
import { store } from "./store";

const convert = () => import("@dovli/editor/convert");

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** A safe file name from a page title. */
export function fileName(title: string, used?: Set<string>) {
  const base = (title.trim() || "Untitled").replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled";
  if (!used) return base;
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} ${i}`;
  used.add(name.toLowerCase());
  return name;
}

// Today in the person's own time zone, as YYYY-MM-DD.
const today = () => new Date().toLocaleDateString("en-CA");

/** Every dovli-file:// id used in a page. */
function fileIds(page: Page): string[] {
  const out = new Set<string>();
  for (const m of JSON.stringify(page.blocks ?? []).matchAll(/dovli-file:\/\/([\w-]+)/g)) out.add(m[1]);
  if (page.cover?.startsWith("file:")) out.add(page.cover.slice(5));
  return [...out];
}

/** Swap dovli-file:// addresses in blocks for something that works outside Dovli. */
function swapFileUrls(blocks: any[], to: (id: string) => string): any[] {
  return JSON.parse(JSON.stringify(blocks ?? []).replace(/dovli-file:\/\/([\w-]+)/g, (_m, id) => to(id)));
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

// Converting blocks briefly builds real elements, and an <img> with a relative path would make the
// browser try to load it from this site. So files get a placeholder that loads nothing while
// converting, and their real path in the export is written in afterwards.
const placeholder = (id: string) => `data:,dovli-file-${id}`;
const fillPaths = (text: string, path: (id: string) => string) => text.replace(/data:,dovli-file-([\w-]+)/g, (_, id: string) => path(id));

/** A page in Dovli itself, for links to pages that aren't in the export. */
const appLink = (id: string) => `${siteOrigin()}/app#p-${id}`;

/** Links to other pages come out of the converter as #p-<id>, which leads nowhere outside Dovli. */
const linkPages = (text: string, to: (id: string) => string) => text.replace(/(\]\(|href=")#p-([\w-]+)/g, (_, lead: string, id: string) => lead + to(id));

/** A relative path for a Markdown link or an href: each folder and name encoded, slashes kept. */
const urlPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** Every flowchart in the blocks drawn as SVG, by block id. Markdown, HTML and Word can't draw one themselves. */
async function drawFlowcharts(blocks: any[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const walk = async (list: any[]) => {
    for (const b of list ?? []) {
      if (b.type === "flowchart") {
        await import("./excalidraw");
        const { flowchartSvg } = await convert();
        const svg = await flowchartSvg(b.props?.scene ?? "");
        if (svg) out.set(b.id, svg);
      }
      await walk(b.children);
    }
  };
  await walk(blocks);
  return out;
}

/** Flowcharts swapped for pictures of themselves at `url(blockId)`. */
function flowchartsAsPictures(blocks: any[], drawn: Map<string, string>, url: (id: string) => string): any[] {
  if (!drawn.size) return blocks;
  return (blocks ?? []).map((b) => {
    const children = flowchartsAsPictures(b.children ?? [], drawn, url);
    return b.type === "flowchart" && drawn.has(b.id) ? { id: b.id, type: "image", props: { url: url(b.id), name: "Flowchart", caption: "" }, children } : { ...b, children };
  });
}

/**
 * A page as Markdown. `fileUrl` places pictures and files (and drawn flowcharts, as "flowchart-<block id>"),
 * `pageUrl` places links to other pages.
 */
export async function pageMarkdown(
  page: Page,
  fileUrl: (id: string) => string = (id) => `files/${id}`,
  pageUrl: (id: string) => string = appLink,
  drawn: Map<string, string> = new Map(),
): Promise<string> {
  const { blocksToMarkdown } = await convert();
  const blocks = flowchartsAsPictures(swapFileUrls(page.blocks ?? [], placeholder), drawn, (id) => placeholder(`flowchart-${id}`));
  const body = page.kind === "doc" ? linkPages(fillPaths(blocksToMarkdown(blocks), fileUrl), pageUrl) : "_This is a whiteboard. It is exported as an .excalidraw file next to this one._\n";
  return `# ${displayTitle(page)}\n\n${body}`.trimEnd() + "\n";
}

function htmlDocument(page: Page, bodyHtml: string) {
  const s = getStyle(page.style);
  const paper = s?.paper ?? "#ffffff";
  const ink = s?.ink ?? "#15171d";
  const accent = s?.accent ?? "#5146d9";
  const title = displayTitle(page).replace(/</g, "&lt;");
  // Lines are drawn in the page's own ink, faintly, so they show on dark page styles too.
  const line = "color-mix(in srgb,currentColor 18%,transparent)";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{margin:0;background:${s ? "#eee" : paper};color:${ink};font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:40px auto;padding:56px 60px;background:${paper};border-radius:20px}
h1,h2,h3{line-height:1.25}h1.page-title{font-size:2.4rem;margin:0 0 24px}
a{color:${accent}}img,video,svg{max-width:100%;height:auto;border-radius:10px}
blockquote{border-left:3px solid ${accent};margin:8px 0;padding:4px 14px;color:inherit;opacity:.9}
pre,code{font-family:ui-monospace,Menlo,monospace}pre{background:${line.replace("18%", "7%")};padding:14px;border-radius:10px;overflow:auto}
table{border-collapse:collapse;width:100%}td,th{border:1px solid ${line};padding:6px 10px;text-align:left;vertical-align:top}th{font-weight:600}
td p,th p,li>p,summary>p{margin:0}li{margin:.2em 0}
li:has(>input[type=checkbox]){list-style:none;display:flex;gap:.55em;align-items:baseline;margin-left:-1.3em}
li[data-checked="true"]>p{text-decoration:line-through;opacity:.6}
li:has(>details){list-style:none;margin-left:-1.3em}summary>p{display:inline}
hr{border:0;border-top:1px solid ${line};margin:20px 0}
@media (max-width:640px){main{margin:0;padding:28px 18px;border-radius:0}}
</style></head>
<body><main><h1 class="page-title">${page.mark ? `${page.mark} ` : ""}${title}</h1>
${bodyHtml}
</main></body></html>`;
}

/** A whiteboard for an HTML export: its drawing, inline. */
async function boardBody(page: Page) {
  const { boardSvg } = await import("./pdf");
  try {
    return (await boardSvg(page)) || "<p>This whiteboard is empty.</p>";
  } catch {
    return "<p>This whiteboard couldn't be drawn.</p>";
  }
}

/** One page as a single HTML file, with its images inside it, so it opens anywhere. */
export async function exportPageHtml(page: Page) {
  const { blocksToHTML } = await convert();
  const map: Record<string, string> = {};
  for (const id of fileIds(page)) {
    const f = await getFile(id);
    if (f) map[id] = await blobToDataUrl(f.blob);
  }
  let html: string;
  if (page.kind === "doc") {
    const drawn = await drawFlowcharts(page.blocks ?? []);
    const pictures: Record<string, string> = {};
    for (const [id, svg] of drawn) pictures[id] = await blobToDataUrl(new Blob([svg], { type: "image/svg+xml" }));
    const blocks = flowchartsAsPictures(swapFileUrls(page.blocks ?? [], (id) => map[id] ?? ""), drawn, (id) => pictures[id]);
    html = linkPages(blocksToHTML(blocks), appLink);
  } else html = await boardBody(page);
  download(new Blob([htmlDocument(page, html)], { type: "text/html" }), `${fileName(displayTitle(page))}.html`);
}

/** One page as Markdown. With pictures, files or flowcharts, it becomes a ZIP so they come along. */
export async function exportPageMarkdown(page: Page) {
  const ids = fileIds(page);
  const drawn = page.kind === "doc" ? await drawFlowcharts(page.blocks ?? []) : new Map<string, string>();
  const name = fileName(displayTitle(page));
  if (!ids.length && !drawn.size) {
    download(new Blob([await pageMarkdown(page)], { type: "text/markdown" }), `${name}.md`);
    return;
  }
  const zip: Zippable = {};
  const names: Record<string, string> = {};
  for (const id of ids) {
    const f = await getFile(id);
    if (!f) continue;
    names[id] = `files/${id}-${fileName(f.name)}`;
    zip[names[id]] = new Uint8Array(await f.blob.arrayBuffer());
  }
  let n = 0;
  for (const [id, svg] of drawn) {
    names[`flowchart-${id}`] = `files/flowchart-${++n}.svg`;
    zip[names[`flowchart-${id}`]] = strToU8(svg);
  }
  zip[`${name}.md`] = strToU8(await pageMarkdown(page, (id) => urlPath(names[id] ?? `files/${id}`), appLink, drawn));
  download(new Blob([zipSync(zip) as BlobPart], { type: "application/zip" }), `${name}.zip`);
}

/**
 * The fonts a picture of the page needs, built in (as data), so the picture looks like the page.
 * Only the families the page uses, Latin letters only. (The picture library can't read the font
 * styles from Google itself; the browser blocks that.)
 */
async function embeddedFonts(root: HTMLElement): Promise<string> {
  const link = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
  if (!link) return "";
  const used = new Set<string>();
  for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")])
    for (const f of getComputedStyle(el).fontFamily.split(",")) used.add(f.trim().replace(/["']/g, "").toLowerCase());
  try {
    const css = await (await fetch(link.href)).text();
    const faces = [...css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?(@font-face\s*{[^}]*})/g)]
      .filter(([, subset, face]) => (!subset || subset === "latin") && used.has((/font-family:\s*["']?([^;"']+)/.exec(face)?.[1] ?? "").trim().toLowerCase()))
      .map(([, , face]) => face);
    const withData = await Promise.all(
      faces.map(async (face) => {
        const url = /url\(([^)]+)\)/.exec(face)?.[1]?.replace(/["']/g, "");
        if (!url) return "";
        const data = await blobToDataUrl(await (await fetch(url)).blob());
        return face.replace(/url\([^)]+\)/, `url(${data})`);
      }),
    );
    return withData.join("\n");
  } catch {
    return ""; // no fonts: the picture uses the device's own fonts
  }
}

/** One page as a Word document. */
export async function exportPageDocx(page: Page) {
  const { pageDocx } = await import("./exportDocx");
  download(await pageDocx(page), `${fileName(displayTitle(page))}.docx`);
}

// Stands in for a picture another site won't let the page read (no CORS), so one blocked picture
// doesn't fail the whole export.
const BLANK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/**
 * A page as a picture (.png), as it looks, at twice the screen's sharpness. A document is drawn from
 * the same copy of the page its PDF is printed from (opening the page if needed); a whiteboard on its own.
 */
export async function exportPageImage(page: Page) {
  let blob: Blob | null = null;
  if (page.kind === "board") {
    const { boardSvg } = await import("./pdf");
    const { svgToPng } = await import("./raster");
    const svg = await boardSvg(page);
    if (!svg) throw new Error("This whiteboard is empty.");
    blob = (await svgToPng(svg))?.png ?? null;
  } else {
    const { openPageCopy } = await import("./pdf");
    const { toBlob } = await import("html-to-image");
    const { root, close } = await openPageCopy(page, 860);
    try {
      blob = await toBlob(root, { pixelRatio: 2, cacheBust: true, imagePlaceholder: BLANK, fontEmbedCSS: await embeddedFonts(root) });
    } catch {
      // html-to-image rejects with a bare event, which says nothing useful.
      blob = null;
    } finally {
      close();
    }
  }
  if (!blob) throw new Error("Couldn't make the picture. Please try again.");
  download(blob, `${fileName(displayTitle(page))}.png`);
}

/** Everything: Markdown and HTML for every page (in folders that match the page tree), files, boards, and a backup. */
export async function exportWorkspace(onProgress?: (done: number, total: number) => void) {
  const { blocksToHTML } = await convert();
  const pages = store.get().pages;
  const zip: Zippable = {};
  const fileNames: Record<string, string> = {};
  const all = Object.values(pages).filter((p) => !p.deletedAt);
  let done = 0;

  const usedFiles = new Set(all.flatMap(fileIds));
  for (const id of usedFiles) {
    const f = await getFile(id);
    if (!f) continue;
    fileNames[id] = `files/${id}-${fileName(f.name)}`;
    zip[fileNames[id]] = new Uint8Array(await f.blob.arrayBuffer());
  }

  // Every page's place in the export first, so links between pages can point at each other's files.
  const paths = new Map<string, string>();
  const place = (parentId: string | null, folder: string) => {
    const used = new Set<string>();
    for (const p of childrenOf(pages, parentId)) {
      const path = `${folder}${fileName(displayTitle(p), used)}`;
      paths.set(p.id, path);
      place(p.id, `${path}/`);
    }
  };
  place(null, "");

  for (const p of all) {
    const path = paths.get(p.id);
    if (!path) continue;
    const depth = path.split("/").length - 1;
    const up = "../".repeat(depth + 1); // to the top of the ZIP, where files/ is
    const toPage = (ext: string) => (id: string) => (paths.has(id) ? `${"../".repeat(depth)}${urlPath(paths.get(id)!)}.${ext}` : appLink(id));
    const toFile = (id: string) => (fileNames[id] ? `${up}${urlPath(fileNames[id])}` : "");
    const drawn = p.kind === "doc" ? await drawFlowcharts(p.blocks ?? []) : new Map<string, string>();
    for (const [id, svg] of drawn) {
      fileNames[`flowchart-${id}`] = `files/flowchart-${id}.svg`;
      zip[fileNames[`flowchart-${id}`]] = strToU8(svg);
    }
    zip[`Markdown/${path}.md`] = strToU8(await pageMarkdown(p, toFile, toPage("md"), drawn));
    const html =
      p.kind === "doc"
        ? linkPages(fillPaths(blocksToHTML(flowchartsAsPictures(swapFileUrls(p.blocks ?? [], placeholder), drawn, (id) => placeholder(`flowchart-${id}`))), toFile), toPage("html"))
        : await boardBody(p);
    zip[`HTML/${path}.html`] = strToU8(htmlDocument(p, html));
    if (p.kind === "board")
      zip[`Markdown/${path}.excalidraw`] = strToU8(
        JSON.stringify({ type: "excalidraw", version: 2, source: "dovli", elements: p.board?.elements ?? [], appState: {}, files: p.board?.files ?? {} }),
      );
    onProgress?.(++done, all.length);
  }
  zip["dovli-backup.json"] = new Uint8Array(await backupFile(pages).arrayBuffer());
  zip["README.txt"] = strToU8(
    `Dovli export, ${today()}\n\nMarkdown/  every page as Markdown, in folders that follow your page tree\nHTML/      every page as a web page you can open in any browser\nfiles/     pictures and files from your pages\ndovli-backup.json  everything, to restore in Dovli (Settings → Import & export → Restore a backup)\n`,
  );
  download(new Blob([zipSync(zip, { level: 6 }) as BlobPart], { type: "application/zip" }), `Dovli export ${today()}.zip`);
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export interface ImportResult {
  pages: number;
  files: number;
  rootId: string | null;
  kind: "files" | "notion" | "evernote" | "confluence" | "onenote" | "backup";
}

const FROM: Partial<Record<ImportResult["kind"], string>> = { notion: "Notion", evernote: "Evernote", confluence: "Confluence", onenote: "OneNote" };

const NOTION_ID = /\s+[0-9a-f]{32}$/i;
/** Files that become pages. A .doc counts only when it's a web archive (as Confluence's "Export to Word" makes). */
const DOC = /\.(md|markdown|txt|csv|html?|docx|mht|mhtml|doc)$/i;
const titleFromPath = (path: string) => {
  const base = withoutExt(path.split("/").pop()!);
  return base.replace(NOTION_ID, "").trim() || "Untitled";
};
const dirOf = (path: string) => path.split("/").slice(0, -1).join("/");
const withoutExt = (path: string) => path.replace(/\.(md|markdown|txt|csv|html?|docx|mht|mhtml|doc|enex)$/i, "");
/** Where a document's page sits in the tree. A TextBundle (Craft, Bear) is a folder holding text.md and its pictures. */
const keyOf = (path: string) => withoutExt(path.replace(/\.textbundle\/text\.(md|markdown|txt)$/i, ""));
const isWebArchive = (bytes: Uint8Array) => /^(MIME-Version|Content-Type|From|Subject|Date):/im.test(strFromU8(bytes.subarray(0, 600), true));

function normalizePath(path: string) {
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}

const decodePath = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
/** A link or src in a file, as the path of the file it points at. */
const resolvePath = (from: string, ref: string) => normalizePath(`${dirOf(from)}/${decodePath(ref.replace(/[?#].*$/, ""))}`);

/** The folder every path is in (none when they don't share one). */
function commonDir(paths: string[]) {
  const parts = paths.map((p) => dirOf(p).split("/"));
  const out: string[] = [];
  for (let i = 0; parts.every((p) => p[i] && p[i] === parts[0][i]); i++) out.push(parts[0][i]);
  return out.join("/");
}

/** A small CSV reader (quotes, commas and new lines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function csvToTableBlock(rows: string[][]) {
  const [head = [], ...body] = rows;
  const columns = head.map((name, i) => ({ id: `c${i}`, name: name || `Column ${i + 1}`, type: "text" as const }));
  return {
    type: "dataTable",
    props: {
      data: JSON.stringify({
        columns,
        rows: body.map((r) => ({ id: nanoid(6), cells: Object.fromEntries(columns.map((c, i) => [c.id, r[i] ?? ""])) })),
        sort: null,
      }),
    },
  };
}

/** Files from a file picker or a drop: unzip ZIPs (and ZIPs inside ZIPs, as Notion makes). */
async function collect(files: File[]): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  const addZip = (data: Uint8Array, prefix = "") => {
    const entries = unzipSync(data);
    for (const [path, bytes] of Object.entries(entries)) {
      if (path.endsWith("/") || path.includes("__MACOSX/") || path.split("/").pop()!.startsWith(".")) continue;
      if (/\.zip$/i.test(path)) addZip(bytes, `${prefix}${withoutExt(path.replace(/\.zip$/i, ""))}/`);
      else out.set(`${prefix}${path}`, bytes);
    }
  };
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (/\.zip$/i.test(f.name)) addZip(bytes);
    else out.set((f as any).webkitRelativePath || f.name, bytes);
  }
  return out;
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", mp4: "video/mp4", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav" };
const mimeOf = (name: string) => MIME[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";

/** One import's stored files: each stored once, with its name kept for file blocks. */
function session(entries: Map<string, Uint8Array>) {
  const names = new Map<string, string>();
  const saved = new Map<string, Promise<string | null>>();
  let files = 0;
  const save = (key: string, bytes: Uint8Array, name: string, type?: string) => {
    if (!saved.has(key))
      saved.set(
        key,
        saveFile(new Blob([bytes as BlobPart], { type: type || mimeOf(name) }), name).then(
          (url) => {
            names.set(url, name);
            files++;
            return url;
          },
          // Too big for Dovli: the rest of the import goes on without it.
          () => null,
        ),
      );
    return saved.get(key)!;
  };
  return {
    names,
    save,
    /** A file from the export by its path. Pages are never stored as files. */
    asset: (path: string) => {
      const bytes = entries.get(path);
      return bytes && !DOC.test(path) ? save(path, bytes, path.split("/").pop()!) : Promise.resolve(null);
    },
    get files() {
      return files;
    },
  };
}
type Session = ReturnType<typeof session>;

/**
 * HTML as blocks. `asset` stores a picture or file the page uses and gives its address (null leaves it out);
 * `page` gives the id of another imported page a link points at.
 */
async function htmlBlocks(html: string, ses: Session, asset: (src: string) => Promise<string | null>, page: (href: string, link: Element) => string | null | undefined = () => null) {
  const { htmlToBlocks } = await convert();
  const doc = parseHtml(html);
  for (const el of [...doc.body.querySelectorAll("img,audio,video,embed,source")]) {
    const src = el.getAttribute("src") ?? "";
    if (/^(https?:|data:|dovli-file:)/i.test(src)) continue;
    const url = src ? await asset(src) : null;
    if (url) el.setAttribute("src", url);
    else el.remove();
  }
  for (const a of [...doc.body.querySelectorAll("a[href]")]) {
    const href = a.getAttribute("href")!;
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) continue;
    const id = page(href, a);
    if (id) {
      a.setAttribute("href", `#p-${id}`);
      continue;
    }
    const url = /^[a-z][\w+.-]*:/i.test(href) && !/^(file|cid):/i.test(href) ? null : await asset(href);
    if (!url) continue;
    // A link to an attached file becomes the file itself; a picture that links to its original stays a picture.
    if (a.querySelector("img")) a.replaceWith(...a.childNodes);
    else {
      const embed = doc.createElement("embed");
      embed.setAttribute("src", url);
      const name = a.textContent?.trim();
      if (name && /\.\w{2,5}$/.test(name)) ses.names.set(url, name);
      a.replaceWith(embed);
    }
  }
  tidy(doc.body);
  return finishBlocks(htmlToBlocks(doc.body.innerHTML), ses.names);
}

interface Draft {
  key: string;
  parent: string | null;
  title: string;
  blocks: any[];
  createdAt?: number;
}

/** The imported pages, all inside one new page so they land in one tidy place. */
function addDrafts(kind: ImportResult["kind"], drafts: Draft[], idFor: Map<string, string>, ses: Session): ImportResult {
  const root = store.createPage({ title: FROM[kind] ? `Imported from ${FROM[kind]}, ${today()}` : `Imported, ${today()}`, mark: "⇣" });
  const now = Date.now();
  const made: Page[] = drafts.map((d, i) => {
    const id = idFor.get(d.key)!;
    return {
      id,
      parentId: (d.parent && idFor.get(d.parent)) || root.id,
      kind: "doc",
      title: d.title,
      mark: "¶",
      blocks: withBlockIds(d.blocks, id),
      createdAt: d.createdAt ?? now,
      updatedAt: now,
      order: i,
    };
  });
  // Open every imported page that has pages inside, so the new tree is visible straight away.
  const parents = new Set(made.map((p) => p.parentId));
  for (const p of made) if (parents.has(p.id)) p.expanded = true;
  store.addPages(made);
  store.updatePage(root.id, { expanded: true }, false);
  return { pages: made.length, files: ses.files, rootId: root.id, kind };
}

export async function importFiles(files: File[], onProgress?: (msg: string) => void): Promise<ImportResult> {
  // A Dovli backup on its own.
  if (files.length === 1 && /\.json$/i.test(files[0].name)) {
    const pages = parseBackupFile(await files[0].text());
    store.addPages(Object.values(pages).map((p) => ({ ...p, updatedAt: Date.now() })));
    return { pages: Object.keys(pages).length, files: 0, rootId: null, kind: "backup" };
  }

  onProgress?.("Reading files");
  const entries = await collect(files);
  const backup = [...entries.keys()].find((k) => k.endsWith("dovli-backup.json"));
  if (backup) {
    const pages = parseBackupFile(strFromU8(entries.get(backup)!));
    store.addPages(Object.values(pages).map((p) => ({ ...p, updatedAt: Date.now() })));
    return { pages: Object.keys(pages).length, files: 0, rootId: null, kind: "backup" };
  }

  const ses = session(entries);
  const paths = [...entries.keys()];
  if (paths.some((k) => /\.enex$/i.test(k))) return importEvernote(entries, ses, onProgress);
  const space = paths.find(
    (k) => /(^|\/)index\.html$/i.test(k) && paths.some((p) => p !== k && dirOf(p) === dirOf(k) && /\.html$/i.test(p) && isConfluencePage(strFromU8(entries.get(p)!))),
  );
  if (space) return importConfluence(entries, ses, space, onProgress);
  return importDocuments(entries, ses, onProgress);
}

/** Markdown, CSV, web pages, Word and web archives, with folders as the page tree: Notion, Craft, Obsidian, OneNote… */
async function importDocuments(entries: Map<string, Uint8Array>, ses: Session, onProgress?: (msg: string) => void): Promise<ImportResult> {
  const docs = [...entries.keys()].filter((k) => DOC.test(k) && !/_all\.csv$/i.test(k) && (!/\.doc$/i.test(k) || isWebArchive(entries.get(k)!))).sort();
  if (!docs.length)
    throw new Error("Nothing to import here. Choose a Notion, Evernote, Confluence or Craft export, Markdown, Word or web page files, a folder of them, or a Dovli backup.");
  const notion = docs.some((k) => NOTION_ID.test(keyOf(k).split("/").pop()!));
  const { markdownToBlocks } = await convert();

  const idFor = new Map<string, string>(); // page key (path without extension) → page id
  for (const p of docs) idFor.set(keyOf(p), nanoid(10));
  // A folder without a page of its own (in a Craft or Obsidian export) becomes one, so the tree stays.
  // The folder around everything doesn't.
  const top = commonDir(docs.map(keyOf));
  const drafts: Draft[] = [];
  for (const p of docs)
    for (let d = dirOf(keyOf(p)); d.length > top.length && !idFor.has(d); d = dirOf(d)) {
      idFor.set(d, nanoid(10));
      drafts.push({ key: d, parent: dirOf(d), title: titleFromPath(d), blocks: [] });
    }

  const linkedPage = (from: string) => (href: string) => {
    const target = resolvePath(from, href);
    return DOC.test(target) ? idFor.get(keyOf(target)) : null;
  };
  let onenote = false;
  for (let i = 0; i < docs.length; i++) {
    const path = docs[i];
    onProgress?.(`Importing ${i + 1} of ${docs.length}`);
    const key = keyOf(path);
    const title = titleFromPath(key);
    const bytes = entries.get(path)!;
    let blocks: any[];
    if (/\.csv$/i.test(path)) {
      blocks = [csvToTableBlock(parseCsv(strFromU8(bytes)))];
    } else if (/\.(md|markdown|txt)$/i.test(path)) {
      let md = strFromU8(bytes);
      // Pictures and files next to the Markdown come along.
      const refs = [...md.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
      for (const ref of refs) {
        if (/^(https?:|data:|mailto:|#)/i.test(ref)) continue;
        const target = resolvePath(path, ref);
        if (DOC.test(target)) {
          const linked = idFor.get(keyOf(target));
          if (linked) md = md.split(`(${ref})`).join(`(#p-${linked})`);
          continue;
        }
        const url = await ses.asset(target);
        if (url) md = md.split(`(${ref})`).join(`(${url})`);
      }
      // Notion and Craft repeat the title as the first heading.
      md = md.replace(/^﻿?#\s+(.+)\n+/, (m, h) => (h.trim() === title ? "" : m));
      // Pictures inside a sentence would be dropped: give each its own line, so it becomes an image block.
      md = md
        .replace(/([^\n])[ \t]*(!\[[^\]]*\]\([^)]+\))/g, "$1\n\n$2")
        .replace(/(!\[[^\]]*\]\([^)]+\))[ \t]*([^\n])/g, "$1\n\n$2");
      blocks = finishBlocks(markdownToBlocks(md), ses.names);
    } else if (/\.html?$/i.test(path)) {
      const doc = parseHtml(strFromU8(bytes));
      // Notion's HTML export keeps the page itself in .page-body, after a header with the title.
      const body = doc.querySelector(".page-body") ?? doc.body;
      const first = body.firstElementChild;
      if (first?.tagName === "H1" && first.textContent?.trim() === title) first.remove();
      blocks = await htmlBlocks(body.innerHTML, ses, (src) => ses.asset(resolvePath(path, src)), linkedPage(path));
    } else if (/\.docx$/i.test(path)) {
      blocks = await docxBlocks(bytes, ses);
    } else {
      const archive = parseMht(bytes);
      if (/onenote/i.test(archive.generator)) onenote = true;
      blocks = await htmlBlocks(archive.html, ses, async (src) => {
        const part = mhtPart(archive.parts, src, archive.location);
        if (!part) return null;
        const name = decodePath(part.location.split(/[\\/]/).pop() || "file");
        return ses.save(`${path}|${part.location || part.cid}`, part.bytes, name, part.type);
      });
    }
    drafts.push({ key, parent: dirOf(key), title, blocks });
  }
  return addDrafts(onenote ? "onenote" : notion ? "notion" : "files", drafts, idFor, ses);
}

/** A Word document (OneNote exports pages and sections as these too). */
async function docxBlocks(bytes: Uint8Array, ses: Session) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: bytes.slice().buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const type = image.contentType;
        const url = await ses.save(nanoid(), new Uint8Array(await image.readAsArrayBuffer()), `picture.${type.split("/")[1] ?? "png"}`, type);
        return { src: url ?? "" };
      }),
    },
  );
  return htmlBlocks(value, ses, async () => null);
}

/** Evernote: one or more .enex files, one per notebook. With several, each notebook becomes a page holding its notes. */
async function importEvernote(entries: Map<string, Uint8Array>, ses: Session, onProgress?: (msg: string) => void): Promise<ImportResult> {
  const books = [...entries.keys()].filter((k) => /\.enex$/i.test(k)).sort();
  const idFor = new Map<string, string>();
  const drafts: Draft[] = [];
  if (books.length > 1)
    for (const b of books) {
      idFor.set(b, nanoid(10));
      drafts.push({ key: b, parent: null, title: titleFromPath(b), blocks: [] });
    }
  const notes = books.flatMap((book) => parseEnex(strFromU8(entries.get(book)!)).map((note, i) => ({ book, note, key: `${book}#${i}` })));
  if (!notes.length) throw new Error("No notes found in that Evernote export.");
  // Links between notes are evernote:// addresses an export can't follow, so they're matched by the note's title.
  const byTitle = new Map<string, string>();
  for (const n of notes) {
    idFor.set(n.key, nanoid(10));
    if (!byTitle.has(n.note.title.toLowerCase())) byTitle.set(n.note.title.toLowerCase(), idFor.get(n.key)!);
  }
  for (let i = 0; i < notes.length; i++) {
    const { book, note, key } = notes[i];
    onProgress?.(`Importing ${i + 1} of ${notes.length}`);
    const byHash = new Map(note.resources.map((r) => [r.hash, r]));
    const blocks = await htmlBlocks(
      note.html,
      ses,
      async (src) => {
        const r = byHash.get(src.replace(/^enex:/, ""));
        return r ? ses.save(`enex:${r.hash}`, r.bytes, r.name, r.mime) : null;
      },
      (href, a) => (/^evernote:/i.test(href) ? byTitle.get(a.textContent?.trim().toLowerCase() ?? "") : null),
    );
    // Dovli tags are written in the text.
    const tags = note.tags.map((t) => `#${t.replace(/\s+/g, "-")}`).filter((t) => /^#\p{L}/u.test(t));
    if (tags.length) blocks.push({ type: "paragraph", content: [{ type: "text", text: tags.join(" "), styles: {} }], children: [] });
    drafts.push({ key, parent: books.length > 1 ? book : null, title: note.title, blocks, createdAt: note.created });
  }
  return addDrafts("evernote", drafts, idFor, ses);
}

/** Confluence: an HTML export of a space. The page tree comes from its index.html, or else each page's breadcrumbs. */
async function importConfluence(entries: Map<string, Uint8Array>, ses: Session, index: string, onProgress?: (msg: string) => void): Promise<ImportResult> {
  const dir = dirOf(index);
  const at = (href: string) => resolvePath(index, href);
  const tree = new Map([...confluenceTree(strFromU8(entries.get(index)!))].map(([page, parent]) => [at(page), parent && at(parent)]));
  const inTree = [...tree.keys()].filter((p) => entries.has(p));
  const rest = [...entries.keys()].filter((k) => dirOf(k) === dir && /\.html$/i.test(k) && k !== index && !tree.has(k)).sort();
  const files = [...inTree, ...rest];
  const idFor = new Map(files.map((f) => [f, nanoid(10)]));
  const drafts: Draft[] = [];
  for (let i = 0; i < files.length; i++) {
    const path = files[i];
    onProgress?.(`Importing ${i + 1} of ${files.length}`);
    const { title, parent, body } = confluencePage(strFromU8(entries.get(path)!));
    const blocks = await htmlBlocks(
      body,
      ses,
      (src) => ses.asset(resolvePath(path, src)),
      (href) => idFor.get(resolvePath(path, href)),
    );
    drafts.push({ key: path, parent: tree.has(path) ? (tree.get(path) ?? null) : parent && at(parent), title, blocks });
  }
  return addDrafts("confluence", drafts, idFor, ses);
}

/** Is this address one of ours that points at a stored file? */
export const isStoredFile = (url: string) => !!fileIdFromUrl(url);
