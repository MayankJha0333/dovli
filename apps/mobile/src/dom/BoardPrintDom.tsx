"use dom";

// A whiteboard as a PDF-ready web page: Excalidraw draws the board as a picture (SVG, so it stays
// sharp at any size), under the page's title. Runs out of sight, once, and hands back the HTML.

import "@excalidraw/excalidraw/index.css";
import { useEffect } from "react";
import type { DOMProps } from "expo/dom";
import { convertToExcalidrawElements, exportToSvg } from "@excalidraw/excalidraw";
import type { BoardData } from "@dovli/core";

const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default function BoardPrintDom({
  board,
  title,
  mark,
  onPrint,
}: {
  board: BoardData;
  title: string;
  mark: string;
  onPrint: (html: string) => Promise<void>;
  dom?: DOMProps;
}) {
  useEffect(() => {
    void (async () => {
      let elements = board.elements ?? [];
      if (!elements.length && board.skeleton?.length) elements = convertToExcalidrawElements(board.skeleton as any, { regenerateIds: false }) as any[];
      const live = elements.filter((e: any) => !e.isDeleted);
      let picture = `<p class="empty">This whiteboard is empty.</p>`;
      if (live.length) {
        try {
          const svg = await exportToSvg({
            elements: live,
            files: (board.files ?? {}) as any,
            appState: { exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false, exportPadding: 24 } as any,
          });
          svg.removeAttribute("width");
          svg.removeAttribute("height");
          picture = svg.outerHTML;
        } catch {
          picture = `<p class="empty">This whiteboard couldn't be drawn.</p>`;
        }
      }
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { margin: 14mm 12mm; }
html, body { margin: 0; background: #fff; color: #15171d; font-family: -apple-system, system-ui, Roboto, "Segoe UI", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.mark { width: 48px; height: 48px; border-radius: 14px; background: #ecebfc; color: #5146d9; display: flex; align-items: center; justify-content: center; font-size: 22px; }
h1 { font-size: 28px; line-height: 1.15; letter-spacing: -0.6px; margin: 14px 0 4px; }
.kind { color: #606675; font-size: 13px; margin-bottom: 18px; }
svg { display: block; width: 100%; height: auto; max-height: 240mm; border: 1px solid #e7e9ef; border-radius: 14px; }
.empty { color: #606675; }
</style></head><body><div class="mark">${escapeHtml(mark)}</div><h1>${escapeHtml(title || "Untitled board")}</h1><div class="kind">Whiteboard</div>${picture}</body></html>`;
      await onPrint(html).catch(() => {});
    })();
    // Once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
