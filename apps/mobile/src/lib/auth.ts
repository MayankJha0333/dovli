// Accounts on the phone, with Firebase. Signing in and signing up both use a 6-digit email code:
// the web app's server sends and checks the code (the same rules as on the web) and answers with a
// one-time Firebase token, which signs this phone in. Firebase keeps the sign-in on the phone.
// Dovli needs an account: nothing past the welcome and sign-in screens opens without one.

import { useSyncExternalStore } from "react";
import {
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInWithCredential,
  signInWithCustomToken,
  signOut,
  updateProfile,
  type OAuthCredential,
  type User,
} from "firebase/auth";
import { apiUrl, firebaseAuth, firebaseConfigured } from "./firebase";
import { GoogleError, googleIdToken, googleSignOut } from "./google";

export interface PhoneAccount {
  id: string;
  email: string | null;
  name: string | null;
  /** When the account was made, in ms. */
  createdAt: number | null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public extra: { retryAfter?: number; triesLeft?: number; email?: string } = {},
  ) {
    super(message);
  }
}

export type AuthStatus = "local-only" | "loading" | "signed-out" | "signed-in";

export interface AuthState {
  status: AuthStatus;
  account: PhoneAccount | null;
}

let state: AuthState = {
  status: firebaseConfigured ? "loading" : "local-only",
  account: null,
};
const listeners = new Set<() => void>();
function set(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const toAccount = (u: User): PhoneAccount => ({
  id: u.uid,
  email: u.email,
  name: u.displayName,
  createdAt: u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : null,
});

let started = false;
/** Start listening to Firebase. Safe to call more than once. */
export function startAuth() {
  if (started || !firebaseConfigured) return;
  started = true;
  // If Firebase can't answer quickly (no network on a cold start), don't hold the splash screen.
  const fallback = setTimeout(() => state.status === "loading" && set({ status: "signed-out" }), 4000);
  onAuthStateChanged(firebaseAuth()!, (u) => {
    clearTimeout(fallback);
    set({ status: u ? "signed-in" : "signed-out", account: u ? toAccount(u) : null });
  });
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new AuthError("Couldn't reach Dovli. Check your connection and try again.", "network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(data.error ?? "Something went wrong. Please try again.", data.code ?? "server", { retryAfter: data.retryAfter, triesLeft: data.triesLeft });
  return data as T;
}

/** Tell the server about this sign-in, so the account's record (users/{uid}) is up to date, as on the web. */
async function recordSignIn(u: User) {
  try {
    const idToken = await u.getIdToken();
    await fetch(`${apiUrl}/api/auth/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
  } catch {
    /* the app's next check-in fills it in */
  }
}

/** A Google sign-in waiting to be added to an existing account, once its email code is entered. */
let pendingGoogle: OAuthCredential | null = null;

export const phoneAuth = {
  sendEmailCode: (email: string) => post<{ resendAfter: number; expiresIn: number }>("/api/auth/email-code", { email: email.trim().toLowerCase() }),

  /** Check the code and sign in. `name` comes from the sign-up screen and names a new account. */
  async verifyEmailCode(email: string, code: string, name?: string) {
    const clean = name?.trim() || undefined;
    const { token } = await post<{ token: string }>("/api/auth/email-code/verify", { email: email.trim().toLowerCase(), code, name: clean });
    const a = firebaseAuth()!;
    try {
      await signInWithCustomToken(a, token);
    } catch {
      throw new AuthError("Sign-in didn't work. Please try again.", "firebase");
    }
    // A new account made here gets its name straight away (the server sets it too).
    const u = a.currentUser;
    if (u && clean && !u.displayName) await updateProfile(u, { displayName: clean }).catch(() => {});
    // Signed in to an existing account to add Google to it: add it now.
    if (u && pendingGoogle) {
      await linkWithCredential(u, pendingGoogle).catch(() => {});
      pendingGoogle = null;
    }
    if (u) {
      set({ account: toAccount(u) });
      void recordSignIn(u);
    }
  },

  /**
   * Continue with Google: signs in, or makes the account the first time (with the name and email
   * from Google). Returns false if the person closed Google's sheet.
   */
  async signInWithGoogle(): Promise<boolean> {
    let g: Awaited<ReturnType<typeof googleIdToken>>;
    try {
      g = await googleIdToken();
    } catch (e) {
      throw new AuthError(e instanceof GoogleError ? e.message : "Couldn't sign in with Google. Please try again.", e instanceof GoogleError ? e.code : "google");
    }
    if (!g) return false;
    const a = firebaseAuth()!;
    const credential = GoogleAuthProvider.credential(g.idToken);
    try {
      await signInWithCredential(a, credential);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      console.warn("[dovli] Firebase Google sign-in failed:", code, (e as Error)?.message);
      if (code === "auth/account-exists-with-different-credential" && g.email) {
        // This email already signs in with a code: confirm it with one, then Google is added.
        pendingGoogle = credential;
        throw new AuthError(`${g.email} already has a Dovli account. Enter the code we email you, and Google will be added to it.`, "link-needed", { email: g.email });
      }
      if (code === "auth/network-request-failed") throw new AuthError("Couldn't reach Google. Check your connection and try again.", "network");
      if (code === "auth/user-disabled") throw new AuthError("This account has been turned off. Contact support if you think that's a mistake.", "disabled");
      throw new AuthError(__DEV__ ? `Couldn't sign in with Google (${code ?? "unknown"}). Please try again.` : "Couldn't sign in with Google. Please try again, or use your email.", "google");
    }
    const u = a.currentUser;
    if (u) {
      set({ account: toAccount(u) });
      void recordSignIn(u);
    }
    return true;
  },

  async updateName(name: string) {
    const u = firebaseAuth()?.currentUser;
    if (!u) return;
    await updateProfile(u, { displayName: name.trim() || null });
    set({ account: toAccount(u) });
  },

  async signOut() {
    const a = firebaseAuth();
    if (a) await signOut(a);
    await googleSignOut();
  },
};

export const authStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function usePhoneAuth(): AuthState {
  startAuth();
  return useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);
}

/** Home and pages are only for someone signed in. A build without accounts set up stops at sign-in. */
export function canUseApp(a: AuthState): boolean {
  return a.status === "signed-in";
}

/** First name, for greetings. */
export function firstName(a: PhoneAccount | null): string | null {
  const n = a?.name?.trim();
  return n ? n.split(/\s+/)[0] : null;
}
