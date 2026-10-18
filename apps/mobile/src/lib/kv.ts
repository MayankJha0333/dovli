// A tiny key-value store on the phone (SQLite underneath, via expo-sqlite). Reads are synchronous,
// so the saved theme and pages are there on the very first frame.

import Storage from "expo-sqlite/kv-store";

export const kv = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = Storage.getItemSync(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      Storage.setItemSync(key, JSON.stringify(value));
    } catch (err) {
      console.warn("[dovli] couldn't save", key, err);
    }
  },
  remove(key: string) {
    try {
      Storage.removeItemSync(key);
    } catch {
      /* ignore */
    }
  },
};

/** The same store, shaped like AsyncStorage, for Supabase to keep the sign-in session. */
export { Storage as asyncStorage };
