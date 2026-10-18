// Signing in with Firebase Auth: Google, or a 6-digit code sent by email.
// The email code is checked by Dovli's own server (app/api/auth/email-code), which answers with a
// one-time Firebase token. When Firebase isn't set up, the app stays in "this device only" mode.

import { useSyncExternalStore } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  linkWithCredential,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthCredential,
  type User,
} from "firebase/auth";
import { LOGIN_PATH, authGateOn, loginUrl } from "./authGate";
import { firebaseAuth, firebaseConfigured } from "./firebase";

export interface Account {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  /** "google" or "email" (a sign-in code). */
  provider: "google" | "email";
}

export interface AuthState {
  status: "local-only" | "loading" | "signed-out" | "signed-in";
  account: Account | null;
}

/** A sign-in problem with a message ready to show, and the server's details when it has them. */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public extra: { retryAfter?: number; triesLeft?: number; email?: string } = {},
  ) {
    super(message);
  }
}

let state: AuthState = { status: firebaseConfigured ? "loading" : "local-only", account: null };
const listeners = new Set<() => void>();
function set(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function toAccount(u: User | null): Account | null {
  if (!u) return null;
  const google = u.providerData.find((p) => p.providerId === "google.com");
  return {
    id: u.uid,
    email: u.email,
    name: u.displayName ?? google?.displayName ?? null,
    avatar: u.photoURL ?? google?.photoURL ?? null,
    provider: google ? "google" : "email",
  };
}

/** Firebase's error codes, in plain words. */
function friendly(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  const code = (e as { code?: string })?.code ?? "";
  const text: Record<string, string> = {
    "auth/network-request-failed": "Couldn't reach the sign-in service. Check your connection and try again.",
    "auth/too-many-requests": "Too many tries for now. Please wait a few minutes and try again.",
    "auth/user-disabled": "This account has been turned off. Contact support if that's a mistake.",
    "auth/unauthorized-domain": "This website isn't allowed to use Google sign-in yet. Add it under Firebase → Authentication → Settings → Authorised domains.",
    "auth/operation-not-allowed": "Google sign-in isn't turned on for this Firebase project yet (Authentication → Sign-in method).",
    "auth/invalid-custom-token": "Sign-in failed because the server and the app use different Firebase projects.",
    "auth/custom-token-mismatch": "Sign-in failed because the server and the app use different Firebase projects.",
    "auth/internal-error": "Couldn't open sign-in. Check your connection, or allow this site in any ad or tracker blocker, then try again.",
  };
  return new AuthError(text[code] ?? "Sign-in didn't work. Please try again.", code || "unknown");
}

// When someone first used an email code and now picks Google with the same address, Firebase asks
// to prove it's them. We keep Google's credential, sign them in with a code, then link the two.
let pendingGoogle: { email: string; credential: AuthCredential } | null = null;

async function linkPendingGoogle(user: User) {
  if (!pendingGoogle || pendingGoogle.email !== user.email?.toLowerCase()) return;
  const { credential } = pendingGoogle;
  pendingGoogle = null;
  try {
    const res = await linkWithCredential(user, credential);
    set({ account: toAccount(res.user) });
  } catch (e) {
    if ((e as { code?: string })?.code !== "auth/provider-already-linked") console.warn("[dovli] Couldn't add Google to the account", e);
  }
}

function googleProblem(e: unknown): AuthError {
  const code = (e as { code?: string })?.code;
  if (code === "auth/account-exists-with-different-credential") {
    const email = ((e as { customData?: { email?: string } }).customData?.email ?? "").toLowerCase();
    const credential = GoogleAuthProvider.credentialFromError(e as never);
    if (email && credential) pendingGoogle = { email, credential };
    return new AuthError(`${email || "This email"} already has a Dovli account. Enter the code we email you, and Google will be added to it.`, "link-needed", { email });
  }
  return friendly(e);
}

let sessionStarting: Promise<void> | null = null;
let signingOut = false;

let started = false;
export function initAuth() {
  if (started || !firebaseConfigured) return;
  started = true;
  const a = firebaseAuth()!;
  onAuthStateChanged(a, (u) => set({ status: u ? "signed-in" : "signed-out", account: toAccount(u) }));
  // Coming back from Google after a full-page redirect (when pop-ups weren't possible).
  getRedirectResult(a).catch((e) => {
    redirectError = googleProblem(e);
    listeners.forEach((l) => l());
  });
}

/** An error from a Google redirect sign-in, shown once by the sign-in panel. */
let redirectError: AuthError | null = null;

async function post<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  } catch {
    throw new AuthError("Couldn't reach Dovli. Check your connection and try again.", "network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(data.error ?? "Something went wrong. Please try again.", data.code ?? "server", { retryAfter: data.retryAfter, triesLeft: data.triesLeft });
  return data as T;
}

export const auth = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  /** Take (and clear) the error from a Google redirect, if there was one. */
  takeRedirectError(): AuthError | null {
    const e = redirectError;
    redirectError = null;
    return e;
  },

  /**
   * Google in a pop-up. Falls back to a full-page redirect where pop-ups can't open (blocked, or
   * an installed web app). Resolves with false if the person closed the pop-up.
   */
  async signInWithGoogle(): Promise<boolean> {
    const a = firebaseAuth();
    if (!a) throw new AuthError("Sign-in isn't set up on this copy of Dovli.", "not-configured");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(a, provider);
      return true;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return false;
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(a, provider);
        return true;
      }
      throw googleProblem(e);
    }
  },

  /** Email a 6-digit code. Resolves with seconds until a resend is allowed and until it expires. */
  sendEmailCode(email: string) {
    return post<{ resendAfter: number; expiresIn: number }>("/api/auth/email-code", { email });
  },

  /**
   * Check the code; on success the person is signed in (and Google linked, if it was waiting).
   * `name` comes from the sign-up page and names a brand-new account.
   */
  async verifyEmailCode(email: string, code: string, name?: string) {
    const a = firebaseAuth();
    if (!a) throw new AuthError("Sign-in isn't set up on this copy of Dovli.", "not-configured");
    const { token } = await post<{ token: string }>("/api/auth/email-code/verify", { email, code, name: name?.trim() || undefined });
    try {
      const res = await signInWithCustomToken(a, token);
      await linkPendingGoogle(res.user);
    } catch (e) {
      throw friendly(e);
    }
  },

  /**
   * Turn this browser's fresh Firebase sign-in into the site's session cookie, which the sign-in
   * gate checks. Call it right after signing in. Several calls at once share one request.
   */
  startSession(): Promise<void> {
    sessionStarting ??= (async () => {
      const user = firebaseAuth()?.currentUser;
      if (!user) throw new AuthError("Please sign in first.", "signed-out");
      let idToken: string;
      try {
        idToken = await user.getIdToken();
      } catch (e) {
        throw friendly(e);
      }
      await post("/api/auth/session", { idToken });
    })().finally(() => {
      sessionStarting = null;
    });
    return sessionStarting;
  },

  /**
   * Sign out here: the session cookie and this browser's Firebase sign-in. Then, with the sign-in
   * gate on, off to the sign-in page (pass `{ leave: false }` to stay and finish up first).
   */
  async signOut({ leave = true }: { leave?: boolean } = {}) {
    pendingGoogle = null;
    signingOut = true; // so the app's guard doesn't jump in while this finishes
    await post("/api/auth/session", {}, "DELETE").catch(() => {});
    const a = firebaseAuth();
    if (a) await signOut(a);
    if (authGateOn && leave) window.location.replace(LOGIN_PATH);
  },

  /** Back to the sign-in page, keeping the current place (used when the sign-in has ended). */
  async leaveForSignIn() {
    if (signingOut) return;
    await post("/api/auth/session", {}, "DELETE").catch(() => {});
    window.location.replace(loginUrl(window.location.pathname + window.location.search + window.location.hash));
  },

  /** A fresh Firebase ID token for calls to Dovli's own server, or null when signed out. */
  async accessToken(): Promise<string | null> {
    return (await firebaseAuth()?.currentUser?.getIdToken()) ?? null;
  },
};

export function useAuth<T>(select: (s: AuthState) => T): T {
  return useSyncExternalStore(auth.subscribe, () => select(state), () => select(state));
}
