import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { contextMenuTemplate, type ContextActions } from "../src/main/contextMenu";
import { menuTemplate } from "../src/main/menu";

const items = (m: MenuItemConstructorOptions) => m.submenu as MenuItemConstructorOptions[];
const find = (menu: MenuItemConstructorOptions[], label: string) => menu.flatMap((m) => items(m) ?? []).find((i) => i.label === label);

describe("menu bar", () => {
  const actions = { command: vi.fn(), checkForUpdates: vi.fn(), openWebsite: vi.fn() };

  it("on a Mac: the app menu, and shortcuts shown but left to the window", () => {
    const menu = menuTemplate("darwin", actions);
    expect(menu.map((m) => m.label ?? m.role)).toEqual(["Dovli", "File", "Edit", "View", "Window", "help"]);
    const newPage = find(menu, "New Page")!;
    expect(newPage).toMatchObject({ accelerator: "CmdOrCtrl+N", registerAccelerator: false });
    (newPage.click as () => void)();
    expect(actions.command).toHaveBeenCalledWith("new-page");
    expect(items(menu[0]).some((i) => i.role === "quit")).toBe(true);
  });

  it("on Windows: no app menu; Quit, Settings and updates live in File and Help", () => {
    const menu = menuTemplate("win32", actions);
    expect(menu.map((m) => m.label ?? m.role)).toEqual(["File", "Edit", "View", "Window", "help"]);
    expect(items(menu[0]).some((i) => i.role === "quit")).toBe(true);
    expect(find(menu, "Settings…")).toBeDefined();
    expect(find(menu, "Check for Updates…")).toBeDefined();
    // The window handles these keys itself on Windows too, so the menu doesn't claim them.
    expect(find(menu, "New Page")!.accelerator).toBeUndefined();
  });
});

describe("right-click menu", () => {
  const actions: ContextActions = { replaceMisspelling: vi.fn(), addToDictionary: vi.fn(), openExternal: vi.fn(), copyText: vi.fn(), copyImageAt: vi.fn(), lookUp: vi.fn() };
  const base = {
    isEditable: false,
    selectionText: "",
    misspelledWord: "",
    dictionarySuggestions: [] as string[],
    linkURL: "",
    mediaType: "none" as const,
    srcURL: "",
    editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true, canUndo: true, canRedo: true, canDelete: true, canEditRichly: true },
  };

  it("offers spelling fixes first in the editor", () => {
    const menu = contextMenuTemplate({ ...base, isEditable: true, misspelledWord: "teh", dictionarySuggestions: ["the", "ten"] }, "darwin", actions);
    expect(menu.map((i) => i.label ?? i.role ?? i.type)).toEqual(["the", "ten", "Add to Dictionary", "separator", "cut", "copy", "paste", "pasteAndMatchStyle", "selectAll"]);
    (menu[0].click as () => void)();
    expect(actions.replaceMisspelling).toHaveBeenCalledWith("the");
  });

  it("opens web links in the browser, and ignores other kinds", () => {
    const menu = contextMenuTemplate({ ...base, linkURL: "https://example.com" }, "win32", actions);
    expect(menu.map((i) => i.label)).toEqual(["Open Link in Browser", "Copy Link"]);
    expect(contextMenuTemplate({ ...base, linkURL: "javascript:alert(1)" }, "win32", actions)).toEqual([]);
  });

  it("has Look Up for selected text on a Mac only, and no stray separators", () => {
    const mac = contextMenuTemplate({ ...base, selectionText: "serendipity" }, "darwin", actions);
    expect(mac.map((i) => i.label ?? i.role ?? i.type)).toEqual(["copy", "separator", "Look Up “serendipity”", "Speech"]);
    const win = contextMenuTemplate({ ...base, selectionText: "serendipity" }, "win32", actions);
    expect(win.map((i) => i.role)).toEqual(["copy"]);
  });
});
