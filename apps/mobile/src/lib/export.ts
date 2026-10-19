// Taking your pages out of Dovli, from the phone: a Dovli backup (one .json file the web app can
// import), or a .zip of Markdown files laid out like your page tree. Files go out through the
// phone's share sheet (Save to Files, AirDrop, Mail…).

import { Share } from "react-native";
import { File, Paths } from "expo-file-system";
import { strToU8, zipSync, type Zippable } from "fflate";
import { blocksToMarkdown, childrenOf, displayTitle, type Page } from "@dovli/core";
import { store } from "./store";

/** The web app's backup format (apps/web/src/lib/backups.ts), so a phone backup imports there. */
const BACKUP_FORMAT = "dovli-backup";

const day = () => new Date().toISOString().slice(0, 10);

/** A file or folder name that every phone and computer accepts. */
function safeName(title: string): string {
  const clean = title.replace(/[\\/:*?"<>|#^[\]\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || "Untitled";
}

/** Pages that aren't in the trash. */
export function livePages(pages = store.getPages()): Page[] {
  return Object.values(pages).filter((p) => !p.deletedAt);
}

async function shareFile(name: string, content: string | Uint8Array): Promise<boolean> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(content);
  const res = await Share.share({ url: file.uri, title: name });
  return res.action === Share.sharedAction;
}

/** Everything in one Dovli backup file. */
export async function shareBackup(): Promise<boolean> {
  const pages = Object.fromEntries(livePages().map((p) => [p.id, p]));
  const body = { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), pages };
  return shareFile(`Dovli backup ${day()}.json`, JSON.stringify(body));
}

/** One page as Markdown, with its title on top. Whiteboards get a short note instead. */
export function pageMarkdown(page: Page): string {
  const body = page.kind === "doc" ? blocksToMarkdown(page.blocks ?? []) : "_This is a whiteboard. Open it in Dovli to see it._\n";
  return `# ${displayTitle(page)}\n\n${body}`.trimEnd() + "\n";
}

/** Every page as Markdown in a .zip: a folder for each page that has pages inside. */
export async function shareMarkdownZip(): Promise<boolean> {
  const pages = store.getPages();
  const files: Zippable = {};
  const add = (parentId: string | null, dir: string) => {
    const used = new Set<string>();
    for (const p of childrenOf(pages, parentId).filter((x) => !x.deletedAt)) {
      let name = safeName(displayTitle(p));
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${safeName(displayTitle(p))} ${n}`;
      used.add(name.toLowerCase());
      if (p.kind === "board") files[`${dir}${name}.excalidraw`] = strToU8(JSON.stringify({ type: "excalidraw", version: 2, source: "dovli", elements: p.board?.elements ?? [], appState: {}, files: p.board?.files ?? {} }));
      else files[`${dir}${name}.md`] = strToU8(pageMarkdown(p));
      if (childrenOf(pages, p.id).some((x) => !x.deletedAt)) add(p.id, `${dir}${name}/`);
    }
  };
  add(null, "");
  return shareFile(`Dovli pages ${day()}.zip`, zipSync(files, { level: 6 }));
}

/** One page as Markdown text, through the share sheet (Notes, Mail, Messages…). */
export async function sharePageText(page: Page): Promise<void> {
  await Share.share({ message: pageMarkdown(page), title: displayTitle(page) });
}
