// Phone sync: the same SyncEngine as the web app, with the phone's own storage behind it.

import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { SyncEngine, type SyncHost, type SyncStatus, type SyncedCopy } from "@dovli/sync";
import { kv } from "./kv";
import { store } from "./store";
import { cloudConfigured, supabase } from "./supabase";

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

let status: SyncStatus = { state: cloudConfigured ? "signed-out" : "local-only", pending: 0, lastSyncedAt: null };
const listeners = new Set<() => void>();
let engine: SyncEngine | null = null;

export function startSync() {
  if (!cloudConfigured || engine) return;
  const sb = supabase()!;
  engine = new SyncEngine({ supabase: sb, host });
  engine.subscribe((s) => {
    status = s;
    listeners.forEach((l) => l());
  });
  store.onLocalChange(() => engine?.notifyLocalChange());
  AppState.addEventListener("change", (s) => s === "active" && engine?.syncSoon(0));

  const onSession = async (userId: string | null) => {
    if (!userId) return engine!.stop();
    if (kv.get<string | null>(OWNER, null) !== userId) {
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
  void sb.auth.getSession().then(({ data }) => onSession(data.session?.user.id ?? null));
  sb.auth.onAuthStateChange((_e, session) => void onSession(session?.user.id ?? null));
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
