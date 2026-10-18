// Files people add to pages (images, PDFs, audio, video). Each is kept on this device in IndexedDB
// and referenced inside pages as dovli-file://<id>, so pages work offline. When signed in, the sync
// layer uploads them to a private cloud folder and other devices download them when first needed.

import { nanoid } from "nanoid";
import { fileIdFromUrl, fileUrl, type StoredFile } from "@dovli/core";
import { db } from "./db";

/** Biggest single file we accept (the cloud plan may allow less). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

const objectUrls = new Map<string, string>();
let remoteFetcher: ((id: string) => Promise<Blob | null>) | null = null;
let onFileAdded: (() => void) | null = null;

/** The sync layer plugs in here, to fetch files this device does not have yet. */
export function setRemoteFileSource(fetcher: ((id: string) => Promise<Blob | null>) | null, added: (() => void) | null) {
  remoteFetcher = fetcher;
  onFileAdded = added;
}

export async function saveFile(file: File | Blob, name = (file as File).name ?? "file"): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`That file is ${(file.size / 1048576).toFixed(0)} MB. The limit is 50 MB.`);
  const id = nanoid(21);
  const record: StoredFile & { blob: Blob; uploaded: boolean } = {
    id,
    name,
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: Date.now(),
    blob: file,
    uploaded: false,
  };
  await (await db()).put("files", record);
  objectUrls.set(id, URL.createObjectURL(file));
  onFileAdded?.();
  return fileUrl(id);
}

export async function getFile(id: string) {
  return (await db()).get("files", id);
}

/** Turn a dovli-file:// address into something the browser can show. Other addresses pass through. */
export async function resolveFileUrl(url: string): Promise<string> {
  const id = fileIdFromUrl(url);
  if (!id) return url;
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const local = await getFile(id);
  if (local) {
    const u = URL.createObjectURL(local.blob);
    objectUrls.set(id, u);
    return u;
  }
  const blob = await remoteFetcher?.(id);
  if (blob) {
    await (await db()).put("files", { id, name: id, type: blob.type, size: blob.size, createdAt: Date.now(), blob, uploaded: true });
    const u = URL.createObjectURL(blob);
    objectUrls.set(id, u);
    return u;
  }
  // Not on this device and not reachable: a transparent pixel keeps the layout steady.
  return "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
}

export async function filesToUpload() {
  const all = await (await db()).getAll("files");
  return all.filter((f) => !f.uploaded);
}

export async function markUploaded(id: string) {
  const d = await db();
  const f = await d.get("files", id);
  if (f) await d.put("files", { ...f, uploaded: true });
}

export async function storageUsed(): Promise<{ files: number; bytes: number }> {
  const all = await (await db()).getAll("files");
  return { files: all.length, bytes: all.reduce((n, f) => n + f.size, 0) };
}
