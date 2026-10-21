import type { ContextMenuParams, MenuItemConstructorOptions, WebContents } from "electron";

// The right-click menu. A browser has one built in; an app window doesn't, so this gives the
// editor spelling suggestions, cut / copy / paste, and link and picture actions.

type Params = Pick<ContextMenuParams, "isEditable" | "selectionText" | "misspelledWord" | "dictionarySuggestions" | "linkURL" | "mediaType" | "srcURL" | "editFlags">;

export interface ContextActions {
  replaceMisspelling(word: string): void;
  addToDictionary(word: string): void;
  openExternal(url: string): void;
  copyText(text: string): void;
  copyImageAt(): void;
  /** macOS's dictionary panel for the selected word. */
  lookUp(): void;
}

const isWebLink = (url: string) => /^(https?|mailto):/i.test(url);

export function contextMenuTemplate(p: Params, platform: NodeJS.Platform, a: ContextActions): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  const sep = () => items.length && items[items.length - 1].type !== "separator" && items.push({ type: "separator" });

  if (p.misspelledWord) {
    for (const word of p.dictionarySuggestions.slice(0, 5)) items.push({ label: word, click: () => a.replaceMisspelling(word) });
    if (!p.dictionarySuggestions.length) items.push({ label: "No Guesses Found", enabled: false });
    items.push({ label: "Add to Dictionary", click: () => a.addToDictionary(p.misspelledWord) });
    sep();
  }

  if (p.linkURL && isWebLink(p.linkURL)) {
    items.push({ label: "Open Link in Browser", click: () => a.openExternal(p.linkURL) });
    items.push({ label: "Copy Link", click: () => a.copyText(p.linkURL) });
    sep();
  }

  if (p.mediaType === "image" && p.srcURL) {
    items.push({ label: "Copy Image", click: a.copyImageAt });
    if (isWebLink(p.srcURL)) items.push({ label: "Copy Image Address", click: () => a.copyText(p.srcURL) });
    sep();
  }

  if (p.isEditable) {
    items.push({ role: "cut", enabled: p.editFlags.canCut }, { role: "copy", enabled: p.editFlags.canCopy }, { role: "paste", enabled: p.editFlags.canPaste });
    items.push({ role: "pasteAndMatchStyle", enabled: p.editFlags.canPaste }, { role: "selectAll", enabled: p.editFlags.canSelectAll });
  } else if (p.selectionText.trim()) {
    items.push({ role: "copy" });
  }

  const selected = p.selectionText.trim();
  if (platform === "darwin" && selected && !p.misspelledWord) {
    sep();
    items.push({ label: `Look Up “${selected.length > 24 ? `${selected.slice(0, 24)}…` : selected}”`, click: a.lookUp });
    items.push({ label: "Speech", submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }] });
  }

  while (items.length && items[items.length - 1].type === "separator") items.pop();
  return items;
}

export function contextActions(contents: WebContents, openExternal: (url: string) => void, copyText: (text: string) => void, at: { x: number; y: number }): ContextActions {
  return {
    replaceMisspelling: (w) => contents.replaceMisspelling(w),
    addToDictionary: (w) => contents.session.addWordToSpellCheckerDictionary(w),
    openExternal,
    copyText,
    copyImageAt: () => contents.copyImageAt(at.x, at.y),
    lookUp: () => contents.showDefinitionForSelection(),
  };
}
