// Signing in on the phone with a 6-digit email code. The web app's server sends and checks the
// code (the same rules as on the web) and answers with a one-time Firebase token.

import { useSyncExternalStore } from "react";
import { onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { apiUrl, firebaseAuth, firebaseConfigured } from "./firebase";

export interface PhoneAccount {
  id: string;
  email: string | null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public extra: { retryAfter?: number; triesLeft?: number } = {},
  ) {
    super(message);
  }
}

let state: { status: "local-only" | "loading" | "signed-out" | "signed-in"; account: PhoneAccount | null } = {
  status: firebaseConfigured ? "loading" : "local-only",
  account: null,
};
const listeners = new Set<() => void>();

let started = false;
function start() {
  if (started || !firebaseConfigured) return;
  started = true;
  onAuthStateChanged(firebaseAuth()!, (u) => {
    state = { status: u ? "signed-in" : "signed-out", account: u ? { id: u.uid, email: u.email } : null };
    listeners.forEach((l) => l());
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

export const phoneAuth = {
  sendEmailCode: (email: string) => post<{ resendAfter: number; expiresIn: number }>("/api/auth/email-code", { email }),
  async verifyEmailCode(email: string, code: string) {
    const { token } = await post<{ token: string }>("/api/auth/email-code/verify", { email, code });
    try {
      await signInWithCustomToken(firebaseAuth()!, token);
    } catch {
      throw new AuthError("Sign-in didn't work. Please try again.", "firebase");
    }
  },
  async signOut() {
    const a = firebaseAuth();
    if (a) await signOut(a);
  },
};

export function usePhoneAuth() {
  start();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
