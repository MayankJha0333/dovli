// Where Excalidraw finds its files in the web app. Import this before Excalidraw runs.
// - Fonts: <origin>/fonts/…, served from public/fonts.
// - The font-shrinking worker: copied to public/excalidraw/<version>/ by next.config.ts. Without
//   this, Excalidraw tries a file:// address, logs an error and does the work on the main thread.

if (typeof window !== "undefined") {
  const w = window as unknown as { EXCALIDRAW_ASSET_PATH?: string; EXCALIDRAW_WORKER_URL?: string };
  w.EXCALIDRAW_ASSET_PATH = `${window.location.origin}/`;
  if (process.env.NEXT_PUBLIC_EXCALIDRAW_WORKER) w.EXCALIDRAW_WORKER_URL = process.env.NEXT_PUBLIC_EXCALIDRAW_WORKER;
}

export {};
