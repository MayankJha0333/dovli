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

let dbp: Promise<IDBPDatabase<DovliDB>> | null = null;

export function db() {
  if (!dbp) {
    dbp = openDB<DovliDB>("dovli", 1, {
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

/** Wipe everything on this device (used by "Delete all data on this device" and sign-out with wipe). */
export async function clearDevice() {
  const d = await db();
  await Promise.all((["pages", "files", "meta", "backups", "outbox", "synced"] as const).map((s) => d.clear(s)));
}
