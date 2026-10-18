// Connects the store to the cloud. Every local change is noted in the "outbox" (IndexedDB);
// the shared SyncEngine (@dovli/sync) sends it, pulls other devices' changes and merges conflicts.
// With Firebase set up, pages go to Firestore through Dovli's own server (/api/sync/*), under the
// signed-in person's workspace (workspaces/{id}/pages). See lib/server/cloudCore.ts.

import { useSyncExternalStore } from "react";
import { SyncEngine, httpTransport, supabaseTransport, type SyncHost, type SyncStatus } from "@dovli/sync";
import type { Page } from "@dovli/core";
import { db, getMeta, setMeta } from "./db";
import { filesToUpload, markUploaded, setRemoteFileSource } from "./files";
import { onLocalChange, store } from "./store";
import { auth } from "./auth";
import { authGateOn } from "./authGate";
import { checkInDevice } from "./device";
import { cloudConfigured, supabase } from "./supabase";

/** Pages sync when accounts are on (Firebase), or with the older Supabase setup. */
export const syncOn = authGateOn || cloudConfigured;

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
let status: SyncStatus = syncOn ? { state: "signed-out", pending: 0, lastSyncedAt: null } : localOnly;
const listeners = new Set<() => void>();

let engine: SyncEngine | null = null;

/** Note local changes in the outbox, so they are sent once online and signed in. */
onLocalChange(async (ids, purged) => {
  if (!syncOn) return;
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
  if (!syncOn || engine) return;
  engine = new SyncEngine({
    transport: authGateOn ? httpTransport({ getToken: () => auth.accessToken() }) : supabaseTransport(supabase()!),
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
  if (engine.syncsFiles) setRemoteFileSource((id) => engine!.downloadFile(id), () => engine?.notifyLocalChange());
  // Check for changes from other devices whenever Dovli comes back into view (plus every 30 s).
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && engine?.syncSoon(0));
  window.addEventListener("focus", () => engine?.syncSoon(0));

  let current: string | null = null;
  const onAuth = async () => {
    const a = auth.get();
    const uid = a.status === "signed-in" ? a.account!.id : null;
    if (uid === current) return;
    current = uid;
    if (!uid) return engine!.stop();
    if (authGateOn) void checkInDevice();
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

/**
 * Wait until a page has reached the account (it isn't waiting in the outbox any more), so it can
 * be shared. Gives up quietly after `ms`; the server then says if it's still missing.
 */
export async function waitForPage(id: string, ms = 10_000) {
  if (!syncOn || !engine) return;
  engine.syncSoon(0);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!(await (await db()).get("outbox", id))) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}
