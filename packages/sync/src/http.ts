import type { PageRow, PushResult, SyncTransport } from "./types";

/**
 * Pages through Dovli's own server (/api/sync/*, which keeps them in Firestore). Every call
 * carries the signed-in person's Firebase ID token. `baseUrl` is empty on the web (same site)
 * and the web app's address on the phone.
 */
export function httpTransport({ baseUrl = "", getToken }: { baseUrl?: string; getToken: () => Promise<string | null> }): SyncTransport {
  async function call<T>(path: string, body: unknown): Promise<T> {
    const token = await getToken();
    if (!token) throw new Error("Please sign in again to sync.");
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Sync failed (${res.status}).`);
    return data as T;
  }
  return {
    pull: async (cursor, limit) => (await call<{ rows: PageRow[] }>("/api/sync/pull", { cursor, limit })).rows,
    push: (c) => call<PushResult>("/api/sync/push", c),
  };
}
