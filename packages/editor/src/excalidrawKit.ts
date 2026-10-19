// Loaded on demand (it pulls in Excalidraw), so pages without flowcharts stay fast.
import { exportToSvg, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { flowchartStarter } from "@dovli/core";

try {
  // Excalidraw loads its fonts from <origin>/fonts/…, which the web app serves from public/.
  (window as any).EXCALIDRAW_ASSET_PATH ??= `${window.location.origin}/`;
} catch {
  /* ignore */
}

export interface Scene {
  elements: any[];
  files?: Record<string, any>;
}

/** Mermaid text waiting to be drawn (what the assistant and the MCP server write), or null. */
export function mermaidOf(json: string): string | null {
  try {
    const s = JSON.parse(json);
    return typeof s?.mermaid === "string" && !Array.isArray(s.elements) ? s.mermaid : null;
  } catch {
    return null;
  }
}

/**
 * Draw Mermaid as Excalidraw shapes, laid out by Mermaid itself, in Dovli's clean look (no
 * hand-drawn wobble). Throws when the Mermaid can't be read.
 */
export async function sceneFromMermaid(code: string): Promise<string> {
  const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
  const { elements, files } = await parseMermaidToExcalidraw(code, { themeVariables: { fontSize: "16px" } });
  // Excalidraw's "Normal" font (2, the system sans-serif): always there to measure, so labels are
  // sized and wrapped to fit their boxes. A web font may not have loaded yet when this runs.
  const tidy = (e: any) => ({ ...e, roughness: 0, ...(e.label ? { label: { ...e.label, fontFamily: 2 } } : {}), ...(e.type === "text" ? { fontFamily: 2 } : {}) });
  const drawn = convertToExcalidrawElements(elements.map(tidy) as any, { regenerateIds: true });
  return JSON.stringify({ elements: drawn, files: files ?? {} });
}

/** The scene ready to draw: Mermaid is turned into shapes first. */
export async function resolveScene(json: string): Promise<string> {
  const code = mermaidOf(json);
  return code === null ? json : sceneFromMermaid(code);
}

export function parseScene(json: string): Scene {
  try {
    const s = JSON.parse(json);
    return { elements: Array.isArray(s.elements) ? s.elements : [], files: s.files ?? {} };
  } catch {
    return { elements: [] };
  }
}

export function starterScene(): string {
  const elements = convertToExcalidrawElements(flowchartStarter() as any, { regenerateIds: true });
  return JSON.stringify({ elements, files: {} });
}

/** Draw the flowchart as SVG markup for the read-only preview in the page. */
export async function renderSvg(json: string, dark: boolean): Promise<string> {
  const scene = parseScene(await resolveScene(json));
  const elements = scene.elements.filter((e) => !e.isDeleted);
  if (!elements.length) return "";
  const svg = await exportToSvg({
    elements,
    files: scene.files ?? {},
    exportPadding: 16,
    appState: { exportBackground: false, exportWithDarkMode: dark, viewBackgroundColor: "transparent" } as any,
  });
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Flowchart");
  return svg.outerHTML;
}
