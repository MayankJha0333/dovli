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

/** Row shape of the `pages` table (see supabase/migrations). */
export interface PageRow {
  id: string;
  data: Page | null;
  rev: number;
  purged: boolean;
}
