import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MIN_SIZE, parseState, visibleBounds, windowStateStore } from "../src/main/windowState";

const screen = { x: 0, y: 0, width: 1440, height: 900 };
const second = { x: 1440, y: 0, width: 1920, height: 1080 };

describe("window state", () => {
  it("keeps only well-formed values", () => {
    expect(parseState(null)).toEqual({});
    expect(parseState({ bounds: { x: 1, y: 2, width: 50, height: 900 }, maximized: "yes" })).toEqual({});
    expect(parseState({ bounds: { x: 1, y: 2, width: 1000, height: 700 }, maximized: true, theme: { bg: "rgb(241, 240, 248)", ink: "#15171D", dark: false } })).toEqual({
      bounds: { x: 1, y: 2, width: 1000, height: 700 },
      maximized: true,
      theme: { bg: "rgb(241, 240, 248)", ink: "#15171D", dark: false },
    });
    expect(parseState({ theme: { bg: "url(javascript:x)", ink: "#000", dark: false } }).theme).toBeUndefined();
  });

  it("reopens where it was, unless that screen is gone", () => {
    expect(visibleBounds({ x: 100, y: 80, width: 1200, height: 800 }, [screen])).toEqual({ x: 100, y: 80, width: 1200, height: 800 });
    expect(visibleBounds({ x: 1600, y: 100, width: 1200, height: 800 }, [screen, second])).toEqual({ x: 1600, y: 100, width: 1200, height: 800 });
    // That monitor was unplugged: let the system place the window.
    expect(visibleBounds({ x: 1600, y: 100, width: 1200, height: 800 }, [screen])).toBeUndefined();
    // Never smaller than the window allows, nor bigger than its screen.
    expect(visibleBounds({ x: 10, y: 10, width: 300, height: 300 }, [screen])).toEqual({ x: 10, y: 10, ...MIN_SIZE });
    expect(visibleBounds({ x: 10, y: 10, width: 3000, height: 2000 }, [screen])).toEqual({ x: 10, y: 10, width: 1440, height: 900 });
    expect(visibleBounds(undefined, [screen])).toBeUndefined();
  });

  it("saves to disk, survives a damaged file, and writes once after a burst of changes", () => {
    vi.useFakeTimers();
    try {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dovli-window-"));
      const a = windowStateStore(dir);
      a.set({ bounds: { x: 5, y: 6, width: 1000, height: 700 } });
      a.set({ maximized: true });
      expect(fs.existsSync(path.join(dir, "window-state.json"))).toBe(false);
      vi.advanceTimersByTime(500);
      expect(windowStateStore(dir).get()).toEqual({ bounds: { x: 5, y: 6, width: 1000, height: 700 }, maximized: true });

      fs.writeFileSync(path.join(dir, "window-state.json"), "{not json");
      expect(windowStateStore(dir).get()).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });
});
