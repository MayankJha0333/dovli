// Connects the store to the cloud. Every local change is noted in the "outbox" (IndexedDB);
// the shared SyncEngine (@dovli/sync) sends it, pulls other devices' changes and merges conflicts.

import { useSyncExternalStore } from "react";
import { SyncEngine, type SyncHost, type SyncStatus } from "@dovli/sync";
import type { Page } from "@dovli/core";
import { db, getMeta, setMeta } from "./db";
import { filesToUpload, markUploaded, setRemoteFileSource } from "./files";
import { onLocalChange, store } from "./store";
import { auth } from "./auth";
import { cloudConfigured, supabase } from "./supabase";

const CURSOR_KEY = "sync.cursor";
const OWNER_KEY = "sync.owner";

const host: SyncHost = {
  getPage: (id) => store.get().pages[id],
  applyFromCloud: (pages, removed) => store.applyFromCloud(pages, removed),
  pending: async () => (await db()).getAll("outbox"),
  async clearPending(id, pushed) {
    const current = store.get().pages[id] ?? null;
    if (pushed && JSON.stringify(current) !== JSON.stringify(pushed)) return; // changed again since: keep it
    await (await db()).delete("outbox", id);
  },
  getSynced: async (id) => (await db()).get("synced", id),
  setSynced: async (copy) => void (await (await db()).put("synced", copy)),
  removeSynced: async (id) => void (await (await db()).delete("synced", id)),
  getCursor: async () => (await getMeta<number>(CURSOR_KEY)) ?? 0,
  setCursor: (rev) => setMeta(CURSOR_KEY, rev),
  async pendingFiles() {
    return (await filesToUpload()).map((f) => ({ id: f.id, blob: f.blob, type: f.type }));
  },
  markFileUploaded: (id) => markUploaded(id),
};

const localOnly: SyncStatus = { state: "local-only", pending: 0, lastSyncedAt: null };
let status: SyncStatus = cloudConfigured ? { state: "signed-out", pending: 0, lastSyncedAt: null } : localOnly;
const listeners = new Set<() => void>();

let engine: SyncEngine | null = null;

/** Note local changes in the outbox, so they are sent once online and signed in. */
onLocalChange(async (ids, purged) => {
  if (!cloudConfigured) return;
  const d = await db();
  const tx = d.transaction("outbox", "readwrite");
  for (const id of ids) await tx.store.put({ id, base: null, baseRev: null });
  for (const id of purged) await tx.store.put({ id, base: null, baseRev: null, purge: true });
  await tx.done;
  engine?.notifyLocalChange();
});

/** First sync on this device for this account: queue every page the cloud does not know yet. */
async function queueUnsyncedPages() {
  const d = await db();
  const synced = new Set(await d.getAllKeys("synced"));
  const tx = d.transaction("outbox", "readwrite");
  for (const p of Object.values(store.get().pages) as Page[]) if (!synced.has(p.id)) await tx.store.put({ id: p.id, base: null, baseRev: null });
  await tx.done;
}

/** Forget sync bookkeeping when a different account signs in on this device. */
async function prepareFor(userId: string) {
  const owner = await getMeta<string>(OWNER_KEY);
  if (owner === userId) return;
  const d = await db();
  await Promise.all([d.clear("synced"), d.clear("outbox")]);
  await setMeta(CURSOR_KEY, 0);
  await setMeta(OWNER_KEY, userId);
}

export function startSync() {
  if (!cloudConfigured || engine) return;
  engine = new SyncEngine({
    supabase: supabase()!,
    host,
    onOnline: (cb) => {
      window.addEventListener("online", cb);
      return () => window.removeEventListener("online", cb);
    },
  });
  engine.subscribe((s) => {
    status = s;
    listeners.forEach((l) => l());
  });
  setRemoteFileSource((id) => engine!.downloadFile(id), () => engine?.notifyLocalChange());
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && engine?.syncSoon(0));

  let current: string | null = null;
  const onAuth = async () => {
    const a = auth.get();
    const uid = a.status === "signed-in" ? a.account!.id : null;
    if (uid === current) return;
    current = uid;
    if (!uid) return engine!.stop();
    await prepareFor(uid);
    const first = (await getMeta<number>(CURSOR_KEY)) === 0;
    engine!.start(uid);
    if (first) {
      // Pull the cloud first, then send whatever this device has that the cloud does not.
      await engine!.syncNow();
      await queueUnsyncedPages();
      engine!.syncSoon(0);
    }
  };
  auth.subscribe(() => void onAuth());
  void onAuth();
}

export const sync = {
  get: () => status,
  now: () => engine?.syncSoon(0),
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(sync.subscribe, () => status, () => status);
}
