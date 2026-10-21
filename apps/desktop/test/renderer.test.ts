import { describe, expect, it } from "vitest";
import type { SyncStatus } from "@dovli/sync";
import { commandForKey } from "../renderer/keys";
import { syncChip } from "../renderer/syncChip";

const key = (k: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}, code = "") => ({
  key: k,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("desktop keys", () => {
  it("⌘N / Ctrl+N make a page, with Shift a whiteboard", () => {
    expect(commandForKey(key("n", { metaKey: true }, "KeyN"), "darwin")).toBe("new-page");
    expect(commandForKey(key("N", { metaKey: true, shiftKey: true }, "KeyN"), "darwin")).toBe("new-board");
    expect(commandForKey(key("n", { ctrlKey: true }, "KeyN"), "win32")).toBe("new-page");
    // The other system's key does nothing, and ⌘⌥N stays the web app's own.
    expect(commandForKey(key("n", { ctrlKey: true }, "KeyN"), "darwin")).toBeNull();
    expect(commandForKey(key("n", { metaKey: true, altKey: true }, "KeyN"), "darwin")).toBeNull();
  });

  it("back and forward use each system's keys", () => {
    expect(commandForKey(key("[", { metaKey: true }), "darwin")).toBe("back");
    expect(commandForKey(key("]", { metaKey: true }), "darwin")).toBe("forward");
    expect(commandForKey(key("ArrowLeft", { altKey: true }), "win32")).toBe("back");
    expect(commandForKey(key("ArrowRight", { altKey: true }), "win32")).toBe("forward");
    expect(commandForKey(key("ArrowLeft", { altKey: true }), "darwin")).toBeNull();
    expect(commandForKey(key("a"), "darwin")).toBeNull();
  });
});

describe("title bar sync status", () => {
  const now = Date.UTC(2026, 9, 21, 12);
  const status = (s: Partial<SyncStatus>): SyncStatus => ({ state: "synced", pending: 0, lastSyncedAt: now - 60_000, ...s });

  it("says how things stand", () => {
    expect(syncChip(status({}), "saved", false, now)).toMatchObject({ text: "Synced", tone: "quiet", icon: "cloudCheck" });
    expect(syncChip(status({ state: "syncing", pending: 2 }), "saved", false, now)).toMatchObject({ text: "Syncing…", tone: "busy", detail: "Sending 2 changes." });
    expect(syncChip(status({ state: "offline", pending: 1 }), "saved", false, now)).toMatchObject({ text: "Offline · 1 change waiting", tone: "warn" });
    expect(syncChip(status({ state: "offline" }), "saved", false, now)?.text).toBe("Offline");
    expect(syncChip(status({ state: "error", pending: 3, error: "Sync failed (500)." }), "saved", false, now)).toMatchObject({ text: "Sync paused · 3 changes waiting", tone: "danger" });
  });

  it("tells a lost connection apart from Dovli's server being down", () => {
    expect(syncChip(status({ state: "offline", pending: 2 }), "saved", true, now)).toMatchObject({ text: "Can't reach Dovli · 2 changes waiting", tone: "warn" });
    expect(syncChip(status({ state: "offline", pending: 2 }), "saved", false, now)?.text).toBe("Offline · 2 changes waiting");
  });

  it("puts a failed save first, and says nothing without an account", () => {
    expect(syncChip(status({}), "error", false, now)).toMatchObject({ text: "Couldn't save", tone: "danger" });
    expect(syncChip(status({ state: "signed-out" }), "saved", false, now)).toBeNull();
    expect(syncChip(status({ state: "local-only" }), "saved", false, now)).toBeNull();
  });
});
