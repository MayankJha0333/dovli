// Signing in (Google, Apple or an email code) and two-step login, through Supabase Auth.
// When the Supabase keys are not set, the app stays in "this device only" mode.

import { useSyncExternalStore } from "react";
import type { Factor, Session } from "@supabase/supabase-js";
import { cloudConfigured, supabase } from "./supabase";

export interface Account {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  provider: string | null;
}

export interface AuthState {
  status: "local-only" | "loading" | "signed-out" | "signed-in";
  account: Account | null;
  /** Signed in with a password-free method but still needs the code from their authenticator app. */
  needsSecondStep: boolean;
}

let state: AuthState = { status: cloudConfigured ? "loading" : "local-only", account: null, needsSecondStep: false };
const listeners = new Set<() => void>();
function set(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function toAccount(session: Session | null): Account | null {
  const u = session?.user;
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? null,
    name: meta.full_name ?? meta.name ?? null,
    avatar: meta.avatar_url ?? meta.picture ?? null,
    provider: (u.app_metadata?.provider as string) ?? null,
  };
}

async function refresh(session: Session | null) {
  const account = toAccount(session);
  if (!account) return set({ status: "signed-out", account: null, needsSecondStep: false });
  let needsSecondStep = false;
  try {
    const { data } = await supabase()!.auth.mfa.getAuthenticatorAssuranceLevel();
    needsSecondStep = data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch {
    /* MFA not available on this project: carry on */
  }
  set({ status: "signed-in", account, needsSecondStep });
}

let started = false;
export function initAuth() {
  if (started || !cloudConfigured) return;
  started = true;
  const sb = supabase()!;
  void sb.auth.getSession().then(({ data }) => refresh(data.session));
  sb.auth.onAuthStateChange((_event, session) => void refresh(session));
}

const redirectTo = () => `${location.origin}${location.pathname}`;

export const auth = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async signInWith(provider: "google" | "apple") {
    const { error } = await supabase()!.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (error) throw error;
  },

  /** Emails a sign-in link that also shows a 6-digit code. */
  async sendEmailCode(email: string) {
    const { error } = await supabase()!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
    if (error) throw error;
  },

  async verifyEmailCode(email: string, token: string) {
    const { error } = await supabase()!.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
  },

  async signOut() {
    await supabase()?.auth.signOut();
  },

  async accessToken(): Promise<string | null> {
    const { data } = (await supabase()?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? null;
  },

  /* ---------------- Two-step login (an authenticator app) ---------------- */

  async factors(): Promise<Factor[]> {
    const { data, error } = await supabase()!.auth.mfa.listFactors();
    if (error) throw error;
    return data.totp ?? [];
  },

  /** Starts setup and returns a QR code (as an SVG data address) and the secret to type in by hand. */
  async enrollAuthenticator(): Promise<{ factorId: string; qr: string; secret: string }> {
    const sb = supabase()!;
    // Clear any half-finished setup first, so a second try works.
    const { data: list } = await sb.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Dovli ${new Date().toLocaleDateString()}` });
    if (error) throw error;
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
  },

  /** Check a 6-digit code against a factor: finishes setup, or completes sign-in. */
  async verifyAuthenticator(factorId: string, code: string) {
    const sb = supabase()!;
    const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId });
    if (e1) throw e1;
    const { error } = await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    if (error) throw error;
    const { data } = await sb.auth.getSession();
    await refresh(data.session);
  },

  /** Complete sign-in for someone with two-step login turned on. */
  async verifySecondStep(code: string) {
    const factors = await auth.factors();
    const f = factors.find((x) => x.status === "verified");
    if (!f) throw new Error("No authenticator app is set up for this account.");
    await auth.verifyAuthenticator(f.id, code);
  },

  async removeAuthenticator(factorId: string) {
    const { error } = await supabase()!.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  },
};

export function useAuth<T>(select: (s: AuthState) => T): T {
  return useSyncExternalStore(auth.subscribe, () => select(state), () => select(state));
}
