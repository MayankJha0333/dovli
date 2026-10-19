// The sign-in gate: when Firebase is set up, every part of Dovli except the sign-in pages (and public
// share links) needs an account. Used by the proxy, the server pages and the browser, so it imports
// nothing and only reads public settings.
//
// How it works:
//   1. Signing in (Google or an email code) happens in the browser with Firebase.
//   2. The browser hands its fresh Firebase ID token to /api/auth/session, which swaps it for a
//      Firebase session cookie: httpOnly (scripts can't read it), 14 days, signed by Google.
//   3. proxy.ts sends anyone without a live-looking cookie to /login (a quick check, no network).
//   4. The app's page then checks the cookie's signature on the server before showing anything.
//   5. Signing out deletes the cookie and the browser's Firebase session.

/** On when the Firebase web config is set. Without it Dovli runs in "this device only" mode. */
export const authGateOn = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

export const SESSION_COOKIE = "__session";
/** Firebase allows session cookies of up to 14 days. */
export const SESSION_DAYS = 14;

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
/** The app itself (your workspace). "/" is the landing page, for everyone. */
export const APP_PATH = "/app";

/**
 * Where to go after signing in: only a path on this site (never "//elsewhere" or a full URL).
 * Anything else, and the landing page itself, means the app. Old page links ("/#p-…") go to the app too.
 */
export function safeNext(raw: unknown): string {
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? String(raw[0] ?? "") : "";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 500) return APP_PATH;
  if (v === LOGIN_PATH || v === SIGNUP_PATH || v.startsWith(`${LOGIN_PATH}?`) || v.startsWith(`${SIGNUP_PATH}?`)) return APP_PATH;
  if (v === "/" || v.startsWith("/#") || v.startsWith("/?")) return APP_PATH + v.slice(1);
  return v;
}

/** The sign-in page's address, remembering where to come back to. */
export function loginUrl(next = APP_PATH, path = LOGIN_PATH): string {
  const n = safeNext(next);
  return n === APP_PATH ? path : `${path}?next=${encodeURIComponent(n)}`;
}

/**
 * A quick look at the cookie without checking its signature (that happens on the server page):
 * is it a session cookie for this project that hasn't run out yet?
 */
export function sessionLooksLive(cookie: string | undefined, projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, nowSec = Date.now() / 1000): boolean {
  if (!cookie || cookie.length > 4096) return false;
  const part = cookie.split(".")[1];
  if (!part) return false;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(part.length + ((4 - (part.length % 4)) % 4), "="));
    const claims = JSON.parse(json) as { exp?: number; aud?: string };
    return typeof claims.exp === "number" && claims.exp > nowSec && (!projectId || claims.aud === projectId);
  } catch {
    return false;
  }
}
