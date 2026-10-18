// The Supabase client used by the first version of sync, share links and cloud files.
// Accounts now use Firebase (lib/firebase.ts, lib/auth.ts), and these features are moving to
// Firestore and Firebase Storage. Until then they stay off, whatever keys are set: a Supabase
// session can't come from a Firebase sign-in.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured: boolean = false;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
  }
  return client;
}
