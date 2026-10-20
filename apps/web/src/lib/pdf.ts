// A page as a PDF, as the phone app makes it: a standalone copy of the page as it looks (its style,
// cover, title and content) on A4, printed from a hidden frame so nothing else on screen comes along.
// A whiteboard is drawn as a picture under its title. The print window's "Save as PDF" names the file
// after the page.

import { displayTitle, type Page } from "@dovli/core";
import { store } from "./store";

// Blocks that read badly split across two sheets of paper.
const WHOLE = ["table", "codeBlock", "image", "video", "audio", "file", "embed", "flowchart", "dataTable", "pdf", "callout", "quote", "subpage"];
// Blocks a line like "See it step by step:" introduces, so that line moves to the next sheet with them.
const INTRODUCED = ["table", "codeBlock", "image", "video", "embed", "flowchart", "dataTable"];

/** A block of one of these types, as seen from its .bn-block-outer (custom blocks wrap their content once more). */
function blockOf(types: string[], lead: string) {
  const is = types.map((t) => `[data-content-type="${t}"]`).join(",");
  return `${lead} .bn-block > .bn-block-content:is(${is}), ${lead} .bn-block > * > .bn-block-content:is(${is})`;
}

/** The phone app's print styles (apps/mobile/src/dom/PageEditorDom.tsx): the page's paper on A4, editing controls gone. */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
*, *::before, *::after { animation: none !important; transition: none !important; }
.dovli-print {
  --print-pad: 34px; --print-inset: 36px;
  margin: 0 !important; width: 100% !important; max-width: none !important; min-height: 0 !important; box-shadow: none !important;
  padding: var(--print-pad) 0 !important; border-radius: 16px; overflow: hidden;
  /* Every sheet of paper gets the page's padding and rounded corners, not just the first and last. */
  -webkit-box-decoration-break: clone; box-decoration-break: clone;
}
.dovli-print:not(.page-styled) { background: var(--d-panel); }
.dovli-print > [data-print-top] { margin: calc(-1 * var(--print-pad)) 0 0 !important; }
.dovli-print > header, .dovli-print .dovli-editor .bn-editor { padding-inline: var(--print-inset) !important; }
.dovli-print .dovli-editor .bn-editor { padding-bottom: 0 !important; }
[data-print="hide"], .bn-trailing-block, .bn-side-menu, .bn-toolbar, .bn-formatting-toolbar, .bn-suggestion-menu { display: none !important; }
.dovli-print pre, .dovli-print pre code { white-space: pre-wrap !important; overflow-wrap: anywhere; overflow: visible !important; }
.dovli-print > header { break-inside: avoid; break-after: avoid; }
/* Set on the outer block, never its content: Chrome ignores a block's break-after: avoid when its content has break-inside: avoid. */
.dovli-print .bn-block-outer:has(${blockOf(WHOLE, ">")}) { break-inside: avoid; }
.dovli-print .bn-block-outer:has(${blockOf(["heading"], ">")}),
.dovli-print .bn-block-outer:has(${blockOf(["paragraph"], ">")}):has(${blockOf(INTRODUCED, "+ .bn-block-outer >")}) { break-after: avoid; }
`;

const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every stylesheet the app uses. Files go in as links, since their font and image paths are relative to the file. */
function pageCss(): string {
  let out = "";
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.href) {
      out += `<link rel="stylesheet" href="${escapeHtml(sheet.href)}">`;
      continue;
    }
    try {
      out += `<style>${Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n")}</style>`;
    } catch {
      /* unreadable: leave it out */
    }
  }
  return out;
}

const attrs = (el: Element) =>
  Array.from(el.attributes)
    .map((a) => ` ${a.name}="${escapeHtml(a.value)}"`)
    .join("");

/** A standalone HTML copy of the open page's sheet: form fields turned into text, drawings into pictures. */
function snapshot(sheet: HTMLElement, title: string): string {
  const clone = sheet.cloneNode(true) as HTMLElement;

  // A textarea's text isn't part of its markup: write the title out as a heading instead.
  const areas = sheet.querySelectorAll("textarea");
  clone.querySelectorAll("textarea").forEach((el, i) => {
    const h = document.createElement("h1");
    h.textContent = areas[i]?.value || "Untitled";
    h.setAttribute("style", el.getAttribute("style") ?? "");
    h.className = el.className;
    h.style.height = "auto";
    h.style.margin = "0";
    el.replaceWith(h);
  });
  // Nor is what's typed or ticked in an input.
  const inputs = sheet.querySelectorAll("input");
  clone.querySelectorAll("input").forEach((el, i) => {
    const live = inputs[i];
    if (!live) return;
    if (live.type === "checkbox" || live.type === "radio") el.toggleAttribute("checked", live.checked);
    else el.setAttribute("value", live.value);
  });
  const canvases = sheet.querySelectorAll("canvas");
  clone.querySelectorAll("canvas").forEach((el, i) => {
    try {
      const img = document.createElement("img");
      img.src = canvases[i].toDataURL("image/png");
      img.style.width = `${canvases[i].clientWidth}px`;
      el.replaceWith(img);
    } catch {
      el.remove();
    }
  });
  // A lazy picture in a frame no one sees never loads.
  clone.querySelectorAll("img").forEach((el) => el.removeAttribute("loading"));
  clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
  clone.querySelectorAll('[data-print="hide"]').forEach((el) => el.remove());

  // A plain page's cover runs across the page area, outside the sheet: on paper it tops the sheet.
  const scroller = sheet.closest<HTMLElement>('[data-print="scroll"]');
  const outerCover = scroller?.querySelector<HTMLElement>(':scope > [data-print="cover"]');
  if (outerCover) {
    const cover = outerCover.cloneNode(true) as HTMLElement;
    cover.querySelectorAll('[data-print="hide"]').forEach((el) => el.remove());
    clone.prepend(cover);
  }
  // The cover sits on the paper's top edge.
  let top = clone.querySelector('[data-print="cover"]');
  while (top && top.parentElement !== clone) top = top.parentElement;
  top?.setAttribute("data-print-top", "");
  // Without its marker the copy escapes the app's own print styles for the sheet (globals.css), made for ⌘P.
  clone.removeAttribute("data-print");
  clone.classList.add("dovli-print");

  // The page's look (its style's colours and fonts) is set on the scroller, around the sheet.
  const look = scroller?.getAttribute("style") ?? "";
  return `<!doctype html><html${attrs(document.documentElement)}><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${pageCss()}<style>${PRINT_CSS}</style></head><body${attrs(document.body)}><div style="${escapeHtml(look)}">${clone.outerHTML}</div></body></html>`;
}

/** A whiteboard drawn as SVG markup on white, sized by its viewBox. "" when it's empty; throws when it can't be drawn. */
export async function boardSvg(page: Page): Promise<string> {
  await import("./excalidraw");
  const { convertToExcalidrawElements, exportToSvg } = await import("@excalidraw/excalidraw");
  const board = page.board ?? {};
  let elements = board.elements ?? [];
  if (!elements.length && board.skeleton?.length) elements = convertToExcalidrawElements(board.skeleton as any, { regenerateIds: false }) as any[];
  const live = elements.filter((e: any) => !e.isDeleted);
  if (!live.length) return "";
  const svg = await exportToSvg({
    elements: live,
    files: (board.files ?? {}) as any,
    appState: { exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false, exportPadding: 24 } as any,
  });
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  return svg.outerHTML;
}

/** A whiteboard as a picture (SVG, so it stays sharp) under its title, as the phone app prints it. */
async function boardHtml(page: Page): Promise<string> {
  let picture: string;
  try {
    picture = (await boardSvg(page)) || `<p class="empty">This whiteboard is empty.</p>`;
  } catch {
    picture = `<p class="empty">This whiteboard couldn't be drawn.</p>`;
  }
  const title = displayTitle(page);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { margin: 14mm 12mm; }
html, body { margin: 0; background: #fff; color: #15171d; font-family: -apple-system, system-ui, Roboto, "Segoe UI", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.mark { width: 48px; height: 48px; border-radius: 14px; background: #ecebfc; color: #5146d9; display: flex; align-items: center; justify-content: center; font-size: 22px; }
h1 { font-size: 28px; line-height: 1.15; letter-spacing: -0.6px; margin: 14px 0 4px; }
.kind { color: #606675; font-size: 13px; margin-bottom: 18px; }
svg { display: block; width: 100%; height: auto; max-height: 240mm; border: 1px solid #e7e9ef; border-radius: 14px; }
.empty { color: #606675; }
</style></head><body><div class="mark">${escapeHtml(page.mark)}</div><h1>${escapeHtml(title || "Untitled board")}</h1><div class="kind">Whiteboard</div>${picture}</body></html>`;
}

let frame: HTMLIFrameElement | null = null;

/** Standalone HTML in a hidden frame, laid out `width` wide, once its fonts and pictures are in. */
async function loadFrame(html: string, width: number): Promise<HTMLIFrameElement> {
  frame?.remove();
  const f = document.createElement("iframe");
  frame = f;
  f.setAttribute("aria-hidden", "true");
  f.tabIndex = -1;
  f.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:1123px;border:0;opacity:0;pointer-events:none`;
  const loaded = new Promise<void>((r) => f.addEventListener("load", () => r(), { once: true }));
  f.srcdoc = html;
  document.body.append(f);
  await loaded;
  const doc = f.contentDocument;
  if (!f.contentWindow || !doc) throw new Error("Couldn't copy the page. Please try again.");
  await doc.fonts?.ready.catch(() => {});
  await Promise.all(Array.from(doc.images).map((img) => (img.complete ? null : img.decode().catch(() => {}))));
  return f;
}

function closeFrame(f: HTMLIFrameElement) {
  if (frame === f) frame = null;
  f.remove();
}

/** Prints standalone HTML from a hidden frame. Resolves once the print window is open. */
async function printHtml(html: string, title: string): Promise<void> {
  // Laid out at A4 width so the copy wraps as it will on paper.
  const f = await loadFrame(html, 794);
  const win = f.contentWindow!;
  // Some browsers name the saved PDF after the window's title rather than the frame's.
  const before = document.title;
  document.title = title;
  win.addEventListener(
    "afterprint",
    () =>
      setTimeout(() => {
        document.title = before;
        closeFrame(f);
      }, 0),
    { once: true },
  );
  win.focus();
  win.print();
}

async function waitFor<T>(find: () => T | null | undefined, ms: number): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() > end) throw new Error("The page took too long to open. Please try again.");
    await sleep(100);
  }
}

/** The page's sheet on screen, opening the page first if it isn't already, with its drawings and pictures in. */
async function openSheet(page: Page): Promise<HTMLElement> {
  const route = store.get().route;
  const opened = route.name !== "page" || route.id !== page.id;
  if (opened) store.navigate({ name: "page", id: page.id });
  const sheet = await waitFor(() => {
    const s = document.querySelector<HTMLElement>(`[data-print="sheet"][data-page-id="${CSS.escape(page.id)}"]`);
    return s?.querySelector(".bn-editor") ? s : null;
  }, 20_000);
  await document.fonts?.ready.catch(() => {});
  // Flowcharts, link previews and pictures draw a moment after the text.
  if (opened) await sleep(900);
  return sheet;
}

/**
 * A document page's standalone copy (the one its PDF is printed from) open in a hidden frame,
 * `width` wide, for the image export. Its paper is `root`; call `close` when done.
 */
export async function openPageCopy(page: Page, width: number): Promise<{ root: HTMLElement; close: () => void }> {
  const sheet = await openSheet(page);
  const f = await loadFrame(snapshot(sheet, displayTitle(page) || "Untitled"), width);
  const root = f.contentDocument!.querySelector<HTMLElement>(".dovli-print");
  if (!root) {
    closeFrame(f);
    throw new Error("Couldn't copy the page. Please try again.");
  }
  return { root, close: () => closeFrame(f) };
}

/** Export a page as a PDF. A document is opened first if it isn't already, since the copy is made from the page on screen. */
export async function exportPagePdf(page: Page): Promise<void> {
  const title = displayTitle(page) || "Untitled";
  if (page.kind === "board") return printHtml(await boardHtml(page), title);
  return printHtml(snapshot(await openSheet(page), title), title);
}
