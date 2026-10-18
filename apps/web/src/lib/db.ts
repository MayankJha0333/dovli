// This device's database (IndexedDB). Pages, files and sync bookkeeping live here, so Dovli works
// fully offline and has room for big workspaces (localStorage tops out around 5 MB).

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Page, StoredFile } from "@dovli/core";

export interface Backup {
  id: string;
  createdAt: number;
  pageCount: number;
  pages: Record<string, Page>;
}

/** A page with changes not yet in the cloud. `base` is the last cloud copy, for merging. */
export interface OutboxEntry {
  id: string;
  base: Page | null;
  baseRev: number | null;
  /** True when the page was deleted for good and the cloud should forget it. */
  purge?: boolean;
}

interface DovliDB extends DBSchema {
  pages: { key: string; value: Page };
  files: { key: string; value: StoredFile & { blob: Blob; uploaded?: boolean } };
  meta: { key: string; value: unknown };
  backups: { key: string; value: Backup; indexes: { byDate: number } };
  outbox: { key: string; value: OutboxEntry };
  /** The last cloud copy and revision of every synced page. */
  synced: { key: string; value: { id: string; rev: number; page: Page } };
}

// Each account gets its own database on this device ("dovli-u-<account id>"), so a second
// person signing in here never sees the first one's pages. Without accounts (no Firebase set up)
// everything lives in "dovli", as before. Pages saved in "dovli" before accounts existed belong to
// nobody: a signed-in person can move them into their account, or delete them (Settings → Account).

const UNOWNED_DB = "dovli";
const STORES = ["pages", "files", "meta", "backups", "outbox", "synced"] as const;

function open(name: string) {
  return openDB<DovliDB>(name, 1, {
    upgrade(d) {
      d.createObjectStore("pages", { keyPath: "id" });
      d.createObjectStore("files", { keyPath: "id" });
      d.createObjectStore("meta");
      d.createObjectStore("backups", { keyPath: "id" }).createIndex("byDate", "createdAt");
      d.createObjectStore("outbox", { keyPath: "id" });
      d.createObjectStore("synced", { keyPath: "id" });
    },
  });
}

let account: string | null = null;
let dbp: Promise<IDBPDatabase<DovliDB>> | null = null;

/**
 * Keep this device's data for this account only. Call once, before anything reads the database
 * (the app does it as it starts, with the account from the server-checked session).
 */
export function setAccountStorage(accountId: string) {
  if (account === accountId) return;
  if (dbp) throw new Error("[dovli] storage was opened before the account was known");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) throw new Error("[dovli] unexpected account id");
  account = accountId;
}

/** True when pages are kept per account (the sign-in gate is on). */
export const perAccountStorage = () => account !== null;

export function db() {
  dbp ??= open(account ? `dovli-u-${account}` : UNOWNED_DB);
  return dbp;
}

export async function loadAllPages(): Promise<Record<string, Page>> {
  const all = await (await db()).getAll("pages");
  return Object.fromEntries(all.map((p) => [p.id, p]));
}

/** Write changed pages and remove deleted ones in one transaction. */
export async function writePages(changed: Page[], removed: string[]) {
  const d = await db();
  const tx = d.transaction("pages", "readwrite");
  await Promise.all([...changed.map((p) => tx.store.put(p)), ...removed.map((id) => tx.store.delete(id)), tx.done]);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await (await db()).put("meta", value, key);
}

/** Wipe this workspace's data on this device: the signed-in account's, or everything without accounts. */
export async function clearDevice() {
  const d = await db();
  await Promise.all(STORES.map((s) => d.clear(s)));
}

/* ---------- Pages saved before accounts ---------- */

/** Whether the old shared database exists, without creating it when it doesn't. */
async function unownedExists(): Promise<boolean> {
  const list = (indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }).databases;
  if (!list) return true; // older browsers can't list them; opening an empty one is harmless
  try {
    return (await list.call(indexedDB)).some((d) => d.name === UNOWNED_DB);
  } catch {
    return true;
  }
}

/** How many pages (not in the trash) were saved on this device before accounts. 0 without accounts. */
export async function unownedPageCount(): Promise<number> {
  if (!account || !(await unownedExists())) return 0;
  const d = await open(UNOWNED_DB);
  try {
    return (await d.getAll("pages")).filter((p) => !p.deletedAt).length;
  } finally {
    d.close();
  }
}

/**
 * Move the pages, files and backups saved before accounts into this account, then empty the old
 * database so nobody else on this device can take them too. Where a page exists in both (the
 * sample pages), the more recently edited copy is kept. Returns how many pages moved.
 */
export async function moveUnownedIntoAccount(): Promise<number> {
  if (!account) return 0;
  const from = await open(UNOWNED_DB);
  try {
    const [pages, files, backups] = await Promise.all([from.getAll("pages"), from.getAll("files"), from.getAll("backups")]);
    const to = await db();
    const tx = to.transaction(["pages", "files", "backups", "outbox"], "readwrite");
    const writes: Promise<unknown>[] = [];
    for (const p of pages) {
      writes.push(
        tx.objectStore("pages").get(p.id).then((mine) => {
          if (mine && (p.updatedAt ?? 0) <= (mine.updatedAt ?? 0)) return;
          // Also note it for sync, so it goes up to the account's cloud copy.
          return Promise.all([tx.objectStore("pages").put(p), tx.objectStore("outbox").put({ id: p.id, base: null, baseRev: null })]);
        }),
      );
    }
    for (const f of files) writes.push(tx.objectStore("files").put(f));
    for (const b of backups) writes.push(tx.objectStore("backups").put(b));
    await Promise.all([...writes, tx.done]);
    await Promise.all(STORES.map((s) => from.clear(s)));
    return pages.length;
  } finally {
    from.close();
  }
}

/** Delete the pages saved before accounts, for good. */
export async function deleteUnowned() {
  if (!account) return;
  const from = await open(UNOWNED_DB);
  try {
    await Promise.all(STORES.map((s) => from.clear(s)));
  } finally {
    from.close();
  }
}
