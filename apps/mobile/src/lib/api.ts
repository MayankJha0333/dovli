// Calls to the web app's server as the signed-in person (the same routes the web app uses).

import { apiUrl, firebaseAuth } from "./firebase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    /** The server's own code for what went wrong, like "not_synced". */
    public code = "",
  ) {
    super(message);
  }
}

/** The signed-in person's token, or null when nobody is signed in. */
export async function idToken(): Promise<string | null> {
  return (await firebaseAuth()?.currentUser?.getIdToken().catch(() => null)) ?? null;
}

/** JSON in, JSON out. Throws an ApiError with the server's own message when it says no. */
export async function api<T = any>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  if (!apiUrl) throw new ApiError("This copy of the app isn't connected to a Dovli server.");
  const token = await idToken();
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), init.timeoutMs ?? 25_000);
  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: stop.signal,
    });
  } catch {
    throw new ApiError("Couldn't reach Dovli. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.", res.status, typeof data?.code === "string" ? data.code : "");
  return data as T;
}
