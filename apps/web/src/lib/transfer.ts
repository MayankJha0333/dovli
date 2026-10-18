// Moving pages in and out of Dovli.
// Export: one page as Markdown or HTML, or the whole workspace as a ZIP (Markdown + HTML + files +
// a full backup). PDF export prints the page through the browser.
// Import: Markdown files, folders of them, Notion exports (ZIP), and Dovli backups.

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { nanoid } from "nanoid";
import { displayTitle, childrenOf, fileIdFromUrl, type Page } from "@dovli/core";
import { getStyle } from "@dovli/theme";
import { backupFile, parseBackupFile } from "./backups";
import { getFile, saveFile } from "./files";
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

export async function pageMarkdown(page: Page, fileUrl: (id: string) => string = (id) => `files/${id}`): Promise<string> {
  const { blocksToMarkdown } = await convert();
  const body = page.kind === "doc" ? fillPaths(blocksToMarkdown(swapFileUrls(page.blocks ?? [], placeholder)), fileUrl) : "_This is a whiteboard. It is exported as an .excalidraw file next to this one._\n";
  return `# ${displayTitle(page)}\n\n${body}`.trimEnd() + "\n";
}

function htmlDocument(page: Page, bodyHtml: string) {
  const s = getStyle(page.style);
  const paper = s?.paper ?? "#ffffff";
  const ink = s?.ink ?? "#15171d";
  const accent = s?.accent ?? "#5146d9";
  const title = displayTitle(page).replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{margin:0;background:${s ? "#eee" : paper};color:${ink};font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:40px auto;padding:56px 60px;background:${paper};border-radius:20px}
h1,h2,h3{line-height:1.25}h1.page-title{font-size:2.4rem;margin:0 0 24px}
a{color:${accent}}img,video{max-width:100%;border-radius:10px}
blockquote{border-left:3px solid ${accent};margin:8px 0;padding:4px 14px;color:inherit;opacity:.9}
pre,code{font-family:ui-monospace,Menlo,monospace}pre{background:rgba(0,0,0,.05);padding:14px;border-radius:10px;overflow:auto}
table{border-collapse:collapse;width:100%}td,th{border:1px solid rgba(0,0,0,.12);padding:6px 10px;text-align:left}
@media (max-width:640px){main{margin:0;padding:28px 18px;border-radius:0}}
</style></head>
<body><main><h1 class="page-title">${page.mark ? `${page.mark} ` : ""}${title}</h1>
${bodyHtml}
</main></body></html>`;
}

/** One page as a single HTML file, with its images inside it, so it opens anywhere. */
export async function exportPageHtml(page: Page) {
  const { blocksToHTML } = await convert();
  const map: Record<string, string> = {};
  for (const id of fileIds(page)) {
    const f = await getFile(id);
    if (f) map[id] = await blobToDataUrl(f.blob);
  }
  const html = page.kind === "doc" ? blocksToHTML(swapFileUrls(page.blocks ?? [], (id) => map[id] ?? "")) : "<p>This is a whiteboard.</p>";
  download(new Blob([htmlDocument(page, html)], { type: "text/html" }), `${fileName(displayTitle(page))}.html`);
}

/** One page as Markdown. With pictures or files, it becomes a ZIP so they come along. */
export async function exportPageMarkdown(page: Page) {
  const ids = fileIds(page);
  const name = fileName(displayTitle(page));
  if (!ids.length) {
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
  zip[`${name}.md`] = strToU8(await pageMarkdown(page, (id) => names[id] ?? `files/${id}`));
  download(new Blob([zipSync(zip) as BlobPart], { type: "application/zip" }), `${name}.zip`);
}

/** Export as PDF: the browser's print window, set up to print only the page. */
export function exportPagePdf() {
  window.print();
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

/**
 * The open page as a picture (.png), exactly as it looks, at twice the screen's sharpness.
 * The page must be open (the Share window is, so it is).
 */
export async function exportPageImage(page: Page) {
  const sheet = document.querySelector<HTMLElement>('[data-print="sheet"]');
  if (!sheet) throw new Error("Open the page first, then export it as an image.");
  const { toBlob } = await import("html-to-image");
  const bg = getComputedStyle(sheet).backgroundColor;
  const blob = await toBlob(sheet, {
    pixelRatio: 2,
    cacheBust: true,
    fontEmbedCSS: await embeddedFonts(sheet),
    backgroundColor: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : getComputedStyle(document.body).backgroundColor,
    // Leave out buttons and menus that only make sense on screen.
    filter: (n) => !(n instanceof HTMLElement && (n.dataset.print === "hide" || n.classList.contains("bn-side-menu") || n.classList.contains("bn-toolbar"))),
  });
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

  const walk = async (parentId: string | null, folder: string) => {
    const used = new Set<string>();
    for (const p of childrenOf(pages, parentId)) {
      const name = fileName(displayTitle(p), used);
      const depth = folder.split("/").filter(Boolean).length;
      const up = "../".repeat(depth + 1);
      zip[`Markdown/${folder}${name}.md`] = strToU8(await pageMarkdown(p, (id) => (fileNames[id] ? `${up}${fileNames[id]}` : "")));
      const html = p.kind === "doc" ? fillPaths(blocksToHTML(swapFileUrls(p.blocks ?? [], placeholder)), (id) => (fileNames[id] ? `${up}${fileNames[id]}` : "")) : "<p>This is a whiteboard.</p>";
      zip[`HTML/${folder}${name}.html`] = strToU8(htmlDocument(p, html));
      if (p.kind === "board")
        zip[`Markdown/${folder}${name}.excalidraw`] = strToU8(
          JSON.stringify({ type: "excalidraw", version: 2, source: "dovli", elements: p.board?.elements ?? [], appState: {}, files: p.board?.files ?? {} }),
        );
      onProgress?.(++done, all.length);
      if (childrenOf(pages, p.id).length) await walk(p.id, `${folder}${name}/`);
    }
  };
  await walk(null, "");
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
  kind: "markdown" | "notion" | "backup";
}

const NOTION_ID = /\s+[0-9a-f]{32}$/i;
const titleFromPath = (path: string) => {
  const base = path.split("/").pop()!.replace(/\.(md|markdown|txt|csv)$/i, "");
  return base.replace(NOTION_ID, "").trim() || "Untitled";
};
const dirOf = (path: string) => path.split("/").slice(0, -1).join("/");
const withoutExt = (path: string) => path.replace(/\.(md|markdown|txt)$/i, "");

function normalizePath(path: string) {
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
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

  const mdPaths = [...entries.keys()].filter((k) => /\.(md|markdown|txt)$/i.test(k)).sort();
  const csvPaths = [...entries.keys()].filter((k) => /\.csv$/i.test(k) && !/_all\.csv$/i.test(k));
  if (!mdPaths.length && !csvPaths.length) throw new Error("No Markdown, CSV or Dovli backup files found. Choose .md files, a folder of them, or a Notion export (.zip).");
  const notion = [...entries.keys()].some((k) => NOTION_ID.test(withoutExt(k.split("/").pop()!)));
  const { markdownToBlocks } = await convert();

  // One page to hold everything that was imported, so it lands in one tidy place.
  const root = store.createPage({ title: notion ? `Imported from Notion, ${today()}` : `Imported, ${today()}`, mark: "⇣" });
  const idFor = new Map<string, string>(); // path without extension → page id
  for (const p of [...mdPaths, ...csvPaths]) idFor.set(withoutExt(p).replace(/\.csv$/i, ""), nanoid(10));

  let fileCount = 0;
  const fileCache = new Map<string, string>();
  const storeAsset = async (path: string): Promise<string | null> => {
    if (fileCache.has(path)) return fileCache.get(path)!;
    const bytes = entries.get(path);
    if (!bytes) return null;
    const ext = path.split(".").pop()!.toLowerCase();
    const url = await saveFile(new Blob([bytes as BlobPart], { type: MIME[ext] ?? "application/octet-stream" }), path.split("/").pop()!);
    fileCache.set(path, url);
    fileCount++;
    return url;
  };

  const now = Date.now();
  const made: Page[] = [];
  const all = [...mdPaths, ...csvPaths];
  for (let i = 0; i < all.length; i++) {
    const path = all[i];
    onProgress?.(`Importing ${i + 1} of ${all.length}`);
    const key = withoutExt(path).replace(/\.csv$/i, "");
    const title = titleFromPath(path);
    const parentKey = dirOf(path);
    const parentId = idFor.get(parentKey) ?? root.id;
    let blocks: any[];
    if (/\.csv$/i.test(path)) {
      blocks = [csvToTableBlock(parseCsv(strFromU8(entries.get(path)!)))];
    } else {
      let md = strFromU8(entries.get(path)!);
      // Pictures and files next to the Markdown come along.
      const refs = [...md.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
      for (const ref of refs) {
        if (/^(https?:|data:|mailto:|#)/i.test(ref)) continue;
        const target = normalizePath(`${dirOf(path)}/${decodeURIComponent(ref)}`);
        if (/\.(md|markdown|csv)$/i.test(target)) {
          const linked = idFor.get(withoutExt(target).replace(/\.csv$/i, ""));
          if (linked) md = md.split(`(${ref})`).join(`(#p-${linked})`);
          continue;
        }
        const url = await storeAsset(target);
        if (url) md = md.split(`(${ref})`).join(`(${url})`);
      }
      // Notion repeats the title as the first heading.
      md = md.replace(/^\uFEFF?#\s+(.+)\n+/, (m, h) => (h.trim() === title ? "" : m));
      // Pictures inside a sentence would be dropped: give each its own line, so it becomes an image block.
      md = md
        .replace(/([^\n])[ \t]*(!\[[^\]]*\]\([^)]+\))/g, "$1\n\n$2")
        .replace(/(!\[[^\]]*\]\([^)]+\))[ \t]*([^\n])/g, "$1\n\n$2");
      blocks = markdownToBlocks(md);
    }
    made.push({
      id: idFor.get(key)!,
      parentId,
      kind: "doc",
      title,
      mark: "¶",
      blocks,
      createdAt: now,
      updatedAt: now,
      order: i,
    });
  }
  // Open every imported page that has pages inside, so the new tree is visible straight away.
  const parents = new Set(made.map((p) => p.parentId));
  for (const p of made) if (parents.has(p.id)) p.expanded = true;
  store.addPages(made);
  store.updatePage(root.id, { expanded: true }, false);
  return { pages: made.length, files: fileCount, rootId: root.id, kind: notion ? "notion" : "markdown" };
}

/** Is this address one of ours that points at a stored file? */
export const isStoredFile = (url: string) => !!fileIdFromUrl(url);
