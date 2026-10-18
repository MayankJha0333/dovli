import type { SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@dovli/core";
import type { PageRow, PushResult, SyncTransport } from "./types";

/** Pages in a Supabase table, pushed through the push_page function (see supabase/migrations). */
export function supabaseTransport(supabase: SupabaseClient, bucket = "files"): SyncTransport {
  return {
    async pull(cursor, limit) {
      const { data, error } = await supabase.from("pages").select("id,data,rev,purged").gt("rev", cursor).order("rev", { ascending: true }).limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as PageRow[];
    },
    async push(c) {
      const { data, error } = await supabase.rpc("push_page", { p_id: c.id, p_data: c.data, p_base_rev: c.baseRev, p_purged: c.purged });
      if (error) throw new Error(error.message);
      return data as PushResult & { data?: Page | null };
    },
    async uploadFile(userId, f) {
      const { error } = await supabase.storage.from(bucket).upload(`${userId}/${f.id}`, f.blob, { upsert: true, contentType: f.type || "application/octet-stream" });
      if (error && !/exists/i.test(error.message)) throw new Error(error.message);
    },
    async downloadFile(userId, id) {
      const { data } = await supabase.storage.from(bucket).download(`${userId}/${id}`);
      return data ?? null;
    },
    async fileUrl(userId, id) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(`${userId}/${id}`, 60 * 60);
      return data?.signedUrl ?? null;
    },
    watch(userId, onChange) {
      const channel = supabase
        .channel(`pages:${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "pages", filter: `user_id=eq.${userId}` }, onChange)
        .subscribe();
      return () => void supabase.removeChannel(channel);
    },
  };
}
