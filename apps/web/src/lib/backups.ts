// Backups: a copy of every page, kept on this device once a day (the last 7 are kept), plus
// "Download a backup" as a file you can keep anywhere and restore later on any device.

import { nanoid } from "nanoid";
import type { Page } from "@dovli/core";
import { db, getMeta, setMeta, type Backup } from "./db";
import { store } from "./store";

const KEEP = 7;
const DAY = 24 * 60 * 60 * 1000;
export const BACKUP_FORMAT = "dovli-backup";

export async function createBackup(): Promise<Backup> {
  const pages = structuredClone(store.get().pages);
  const backup: Backup = { id: nanoid(10), createdAt: Date.now(), pageCount: Object.values(pages).filter((p) => !p.deletedAt).length, pages };
  const d = await db();
  await d.put("backups", backup);
  const all = await d.getAllFromIndex("backups", "byDate");
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) await d.delete("backups", old.id);
  await setMeta("backup.last", backup.createdAt);
  return backup;
}

/** Called on start: makes today's backup if there is none yet. */
export async function autoBackup() {
  const last = (await getMeta<number>("backup.last")) ?? 0;
  if (Date.now() - last > DAY && Object.keys(store.get().pages).length) await createBackup();
}

export async function listBackups(): Promise<Backup[]> {
  const all = await (await db()).getAllFromIndex("backups", "byDate");
  return all.reverse();
}

export async function restoreBackup(id: string) {
  const b = await (await db()).get("backups", id);
  if (!b) throw new Error("That backup is gone.");
  // Keep a backup of the current state first, so a restore can itself be undone.
  await createBackup();
  store.replaceAll(structuredClone(b.pages));
}

/** A backup as a downloadable file (pages only; images stay on the device and in the cloud). */
export function backupFile(pages: Record<string, Page> = store.get().pages): Blob {
  const body = { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), pages };
  return new Blob([JSON.stringify(body)], { type: "application/json" });
}

export function parseBackupFile(text: string): Record<string, Page> {
  const data = JSON.parse(text);
  if (data?.format !== BACKUP_FORMAT || typeof data.pages !== "object") throw new Error("That file isn't a Dovli backup.");
  return data.pages;
}
