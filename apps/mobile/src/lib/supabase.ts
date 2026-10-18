// Supabase on the phone: the first version of sync. Accounts now use Firebase (lib/firebase.ts),
// and sync is moving to Firestore, so this stays off until then, whatever keys are set.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { asyncStorage } from "./kv";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured: boolean = false;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!client)
    client = createClient(url!, anonKey!, {
      auth: { storage: asyncStorage as any, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  return client;
}
