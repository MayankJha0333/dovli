import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/authGate";
import { adminAuth } from "./firebaseAdmin";

// Firebase session cookies: made from a fresh sign-in, checked on the server before the app shows.

/** How recent a sign-in must be to start a session (Firebase's advice: a few minutes). */
const RECENT_SIGN_IN_SECONDS = 5 * 60;

export class SessionError extends Error {
  constructor(
    public code: "not_configured" | "invalid" | "stale" | "disabled",
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Swap a Firebase ID token from a sign-in that just happened for a session cookie. */
export async function createSession(idToken: unknown): Promise<{ cookie: string; maxAge: number }> {
  const auth = adminAuth();
  if (!auth)
    throw new SessionError("not_configured", "Sign-in isn't finished on this server yet: it needs the Firebase service account (FIREBASE_SERVICE_ACCOUNT).", 503);
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 6000) throw new SessionError("invalid", "That sign-in didn't work. Please try again.", 400);
  let authTime: number;
  try {
    // checkRevoked also refuses turned-off accounts.
    const t = await auth.verifyIdToken(idToken, true);
    authTime = t.auth_time;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/user-disabled") throw new SessionError("disabled", "This account has been turned off. Contact support if that's a mistake.", 403);
    throw new SessionError("invalid", "That sign-in has run out. Please sign in again.", 401);
  }
  // An older sign-in (say, a token copied from somewhere) can't be turned into a two-week session.
  if (Date.now() / 1000 - authTime > RECENT_SIGN_IN_SECONDS) throw new SessionError("stale", "Please sign in again to continue.", 401);
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const cookie = await auth.createSessionCookie(idToken, { expiresIn: maxAge * 1000 });
  return { cookie, maxAge };
}

export interface SessionUser {
  id: string;
  email?: string;
}

/** The signed-in person, from this request's session cookie (signature and expiry checked), or null. */
export async function sessionUser(): Promise<SessionUser | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  const auth = adminAuth();
  if (!value || !auth) return null;
  try {
    const t = await auth.verifySessionCookie(value, false);
    return { id: t.uid, email: t.email };
  } catch {
    return null;
  }
}

/** Cookie settings: unreadable by scripts, sent only to this site, and only over HTTPS when live. */
export function sessionCookieOptions(req: Request, maxAge: number) {
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return { httpOnly: true, secure: https, sameSite: "lax" as const, path: "/", maxAge };
}
