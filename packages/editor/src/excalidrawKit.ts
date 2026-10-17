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
  const scene = parseScene(json);
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
