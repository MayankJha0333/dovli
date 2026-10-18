// Phone sync: the same SyncEngine as the web app, with the phone's own storage behind it. Pages go
// to Firestore through the web app's server (EXPO_PUBLIC_API_URL), under the signed-in account.

import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { SyncEngine, httpTransport, type SyncHost, type SyncStatus, type SyncedCopy } from "@dovli/sync";
import { apiUrl, firebaseAuth, firebaseConfigured } from "./firebase";
import { kv } from "./kv";
import { store } from "./store";

const DEVICE = "dovli.device.v1";
const APP_VERSION = "0.1.0";

const SYNCED = "dovli.synced.v1";
const CURSOR = "dovli.cursor.v1";
const OWNER = "dovli.owner.v1";

let synced: Record<string, SyncedCopy> = kv.get(SYNCED, {});
const saveSynced = () => kv.set(SYNCED, synced);

const host: SyncHost = {
  getPage: (id) => store.getPages()[id],
  applyFromCloud: (pages, removed) => store.applyFromCloud(pages, removed),
  pending: async () => store.pending(),
  clearPending: async (id, pushed) => store.clearPending(id, pushed),
  getSynced: async (id) => synced[id],
  setSynced: async (c) => {
    synced[c.id] = c;
    saveSynced();
  },
  removeSynced: async (id) => {
    delete synced[id];
    saveSynced();
  },
  getCursor: async () => kv.get<number>(CURSOR, 0),
  setCursor: async (n) => kv.set(CURSOR, n),
  // Pictures added on the phone come with the next version of the app; nothing to upload yet.
  pendingFiles: async () => [],
  markFileUploaded: async () => {},
};

let status: SyncStatus = { state: firebaseConfigured ? "signed-out" : "local-only", pending: 0, lastSyncedAt: null };
const listeners = new Set<() => void>();
let engine: SyncEngine | null = null;

export function startSync() {
  if (!firebaseConfigured || engine) return;
  const token = async () => (await firebaseAuth()?.currentUser?.getIdToken()) ?? null;
  engine = new SyncEngine({ transport: httpTransport({ baseUrl: apiUrl, getToken: token }), host });
  engine.subscribe((s) => {
    status = s;
    listeners.forEach((l) => l());
  });
  store.onLocalChange(() => engine?.notifyLocalChange());
  AppState.addEventListener("change", (s) => s === "active" && engine?.syncSoon(0));

  const onSession = async (userId: string | null) => {
    if (!userId) return engine!.stop();
    void checkIn(token);
    const owner = kv.get<string | null>(OWNER, null);
    if (owner !== userId) {
      // Someone else used this phone before: their pages stay in their account, not this one.
      if (owner) store.resetForAccount();
      synced = {};
      saveSynced();
      kv.set(CURSOR, 0);
      kv.set(OWNER, userId);
    }
    const first = kv.get<number>(CURSOR, 0) === 0;
    engine!.start(userId);
    if (first) {
      await engine!.syncNow();
      store.queueAll();
      engine!.syncSoon(0);
    }
  };
  onAuthStateChanged(firebaseAuth()!, (u) => void onSession(u?.uid ?? null));
}

/** This phone in the account's record (users/{uid}/devices), once per app start. */
async function checkIn(token: () => Promise<string | null>) {
  try {
    let deviceId = kv.get<string | null>(DEVICE, null);
    if (!deviceId) {
      deviceId = `${Platform.OS}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;
      kv.set(DEVICE, deviceId);
    }
    const t = await token();
    if (!t) return;
    const name = Platform.OS === "ios" ? "iPhone or iPad" : Platform.OS === "android" ? "Android phone" : "Phone";
    const res = await fetch(`${apiUrl}/api/me/device`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
      body: JSON.stringify({ deviceId, platform: Platform.OS === "ios" ? "ios" : "android", name, appVersion: APP_VERSION, installed: true }),
    });
    await res.text();
  } catch {
    /* next time */
  }
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}

export const syncNow = () => engine?.syncSoon(0);
