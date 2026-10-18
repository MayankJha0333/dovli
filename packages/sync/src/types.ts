import type { Page } from "@dovli/core";

/** One page waiting to go to the cloud. */
export interface PendingChange {
  id: string;
  /** Delete this page in the cloud for good (it was deleted forever on this device). */
  purge?: boolean;
}

/** The last copy of a page that this device and the cloud agreed on. */
export interface SyncedCopy {
  id: string;
  rev: number;
  page: Page;
}

/** A file waiting to be uploaded. */
export interface PendingFile {
  id: string;
  blob: Blob;
  type: string;
}

/**
 * What the sync engine needs from the app on this device. The web app implements it with
 * IndexedDB, the phone app with its own storage. The engine never touches storage directly.
 */
export interface SyncHost {
  /** The page as it is on this device right now. */
  getPage(id: string): Page | undefined;
  /** Put pages from the cloud into the app, without marking them as changed here. */
  applyFromCloud(pages: Page[], removedIds: string[]): void;

  pending(): Promise<PendingChange[]>;
  /** Drop a pending change, but only if the page still matches what was pushed. */
  clearPending(id: string, pushed: Page | null): Promise<void>;

  getSynced(id: string): Promise<SyncedCopy | undefined>;
  setSynced(copy: SyncedCopy): Promise<void>;
  removeSynced(id: string): Promise<void>;

  getCursor(): Promise<number>;
  setCursor(rev: number): Promise<void>;

  pendingFiles(): Promise<PendingFile[]>;
  markFileUploaded(id: string): Promise<void>;
}

export type SyncState =
  /** Supabase keys are not set, so everything stays on this device. */
  | "local-only"
  | "signed-out"
  | "offline"
  | "syncing"
  | "synced"
  | "error";

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncedAt: number | null;
  error?: string;
}

/** One page as the cloud sends it: its latest copy (or null when deleted for good) and revision. */
export interface PageRow {
  id: string;
  data: Page | null;
  rev: number;
  purged: boolean;
}

/** Send one page: `baseRev` is the cloud revision this copy was based on (null for a new page). */
export interface PushRequest {
  id: string;
  data: Page | null;
  baseRev: number | null;
  purged: boolean;
}

/**
 * The cloud's answer. ok: saved as revision `rev`. Not ok: someone changed it first, and `data` /
 * `purged` / `rev` are the cloud's copy to merge with. tooBig: the page is over the size limit.
 */
export interface PushResult {
  ok: boolean;
  rev: number;
  data?: Page | null;
  purged?: boolean;
  tooBig?: boolean;
}

/** Where pages go: Dovli's own server (Firestore) or Supabase. The engine only talks to this. */
export interface SyncTransport {
  /** Pages changed after revision `cursor`, oldest first, at most `limit`. */
  pull(cursor: number, limit: number): Promise<PageRow[]>;
  push(change: PushRequest): Promise<PushResult>;
  /** Optional: file uploads. Without them, files stay on the device they were added on. */
  uploadFile?(userId: string, file: PendingFile): Promise<void>;
  downloadFile?(userId: string, id: string): Promise<Blob | null>;
  fileUrl?(userId: string, id: string): Promise<string | null>;
  /** Optional: call back when the cloud changes, for faster updates. Returns a stop function. */
  watch?(userId: string, onChange: () => void): () => void;
}

/** Pages bigger than this (as JSON text) are kept on the device but not sent: about 900 KB. */
export const MAX_PAGE_CHARS = 900_000;
