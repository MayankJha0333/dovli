import type { CloudStore, Doc, DocTx } from "./cloudCore";

/**
 * An in-memory stand-in for Firestore with the same all-or-nothing transactions. Used by the
 * tests, and by the server only when testing locally with the Auth emulator and no Firestore
 * emulator. Never with a real Firebase project.
 */
export function memoryCloudStore(): CloudStore & { dump(): Map<string, Doc> } {
  const data = new Map<string, Doc>();
  let queue: Promise<unknown> = Promise.resolve();
  return {
    dump: () => data,
    transaction<T>(fn: (tx: DocTx) => Promise<T>) {
      const run = queue.then(async () => {
        const writes: [string, Doc | null, boolean][] = [];
        const tx: DocTx = {
          get: async (path) => {
            // Firestore refuses a read after a write inside one transaction; so do we.
            if (writes.length) throw new Error(`transaction read ${path} after a write`);
            return structuredClone(data.get(path));
          },
          set: (path, d, merge = false) => void writes.push([path, structuredClone(d), merge]),
          delete: (path) => void writes.push([path, null, false]),
        };
        const out = await fn(tx);
        for (const [path, d, merge] of writes) {
          if (d === null) data.delete(path);
          else data.set(path, merge ? { ...(data.get(path) ?? {}), ...d } : d);
        }
        return out;
      });
      queue = run.catch(() => {});
      return run;
    },
    async listByRev(collection, after, limit) {
      const prefix = `${collection}/`;
      return [...data.entries()]
        .filter(([k, v]) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/") && typeof v.rev === "number" && v.rev > after)
        .map(([, v]) => structuredClone(v))
        .sort((a, b) => a.rev - b.rev)
        .slice(0, limit);
    },
    async list(collection, limit) {
      const prefix = `${collection}/`;
      return [...data.entries()]
        .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
        .slice(0, limit)
        .map(([, v]) => structuredClone(v));
    },
    async deleteTree(path) {
      for (const k of [...data.keys()]) if (k === path || k.startsWith(`${path}/`)) data.delete(k);
    },
  };
}
