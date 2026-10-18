// Browser version of the phone's key-value store, used only when previewing the phone app in a
// browser (`expo start --web`). The real web app lives in apps/web.

const ls = () => (typeof localStorage === "undefined" ? null : localStorage);

export const kv = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = ls()?.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      ls()?.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("[dovli] couldn't save", key, err);
    }
  },
  remove(key: string) {
    try {
      ls()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const asyncStorage = {
  getItem: async (key: string) => ls()?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => void ls()?.setItem(key, value),
  removeItem: async (key: string) => void ls()?.removeItem(key),
};
