import fs from "node:fs";
import path from "node:path";

// What the app remembers between launches (window-state.json in the app's data folder): where the
// window was, and the theme's colours, so the next launch opens in the right place and colour.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds?: Rect;
  maximized?: boolean;
  fullscreen?: boolean;
  theme?: { bg: string; ink: string; dark: boolean };
}

export const DEFAULT_SIZE = { width: 1280, height: 820 };
export const MIN_SIZE = { width: 880, height: 560 };

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;

/** Only well-formed values survive, so a damaged file can't break the window. */
export function parseState(raw: unknown): WindowState {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const out: WindowState = {};
  const b = v.bounds;
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width >= 200 && b.height >= 200) out.bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  if (typeof v.maximized === "boolean") out.maximized = v.maximized;
  if (typeof v.fullscreen === "boolean") out.fullscreen = v.fullscreen;
  const t = v.theme;
  if (t && COLOR.test(t.bg) && COLOR.test(t.ink) && typeof t.dark === "boolean") out.theme = { bg: t.bg, ink: t.ink, dark: t.dark };
  return out;
}

/**
 * Saved bounds, if they still show on one of today's screens (a monitor may have been unplugged).
 * At least a usable corner of the title bar must be on screen; otherwise the system places it.
 */
export function visibleBounds(saved: Rect | undefined, screens: Rect[]): Rect | undefined {
  if (!saved) return undefined;
  const width = Math.max(saved.width, MIN_SIZE.width);
  const height = Math.max(saved.height, MIN_SIZE.height);
  const onScreen = screens.some((s) => saved.x + 120 > s.x && saved.x + 120 < s.x + s.width && saved.y >= s.y && saved.y + 40 < s.y + s.height);
  if (!onScreen) return undefined;
  const screen = screens.find((s) => saved.x + 120 > s.x && saved.x + 120 < s.x + s.width)!;
  return { x: saved.x, y: saved.y, width: Math.min(width, screen.width), height: Math.min(height, screen.height) };
}

export function windowStateStore(dir: string) {
  const file = path.join(dir, "window-state.json");
  let state: WindowState = {};
  try {
    state = parseState(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    /* first launch, or a damaged file: start fresh */
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = () => {
    clearTimeout(timer);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(state));
      fs.renameSync(`${file}.tmp`, file);
    } catch (e) {
      console.warn("[dovli] Couldn't save the window's place", e);
    }
  };
  return {
    get: () => state,
    /** Saved a moment later, so dragging the window doesn't write on every pixel. */
    set(patch: WindowState) {
      state = { ...state, ...patch };
      clearTimeout(timer);
      timer = setTimeout(write, 400);
    },
    /** Write now (on quit). */
    flush: write,
  };
}
