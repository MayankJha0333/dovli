// Supabase on the phone, when EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.
// Without them the phone app keeps everything on the device.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { asyncStorage } from "./kv";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!client)
    client = createClient(url!, anonKey!, {
      auth: { storage: asyncStorage as any, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  return client;
}
