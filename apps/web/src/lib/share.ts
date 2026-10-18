// Share links: a private, random link to one page that anyone can open, read-only or editable.
// They live in the `shares` table; the page itself is read through get_shared_page().

import { nanoid } from "nanoid";
import { auth } from "./auth";
import { supabase } from "./supabase";
import { sync } from "./sync";

export interface ShareLink {
  id: string;
  page_id: string;
  access: "view" | "edit";
  enabled: boolean;
}

export const shareUrl = (id: string) => `${location.origin}/s/${id}`;

export async function getShare(pageId: string): Promise<ShareLink | null> {
  const sb = supabase();
  const a = auth.get();
  if (!sb || a.status !== "signed-in") return null;
  const { data, error } = await sb.from("shares").select("id,page_id,access,enabled").eq("page_id", pageId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ShareLink) ?? null;
}

/** Turn sharing on (making a link the first time) or change who can edit. */
export async function setShare(pageId: string, patch: { enabled?: boolean; access?: "view" | "edit" }): Promise<ShareLink> {
  const sb = supabase()!;
  const a = auth.get();
  if (a.status !== "signed-in" || !a.account) throw new Error("Sign in to share pages.");
  // The page must be in the cloud before others can open it.
  sync.now();
  const existing = await getShare(pageId);
  if (existing) {
    const { data, error } = await sb.from("shares").update(patch).eq("id", existing.id).select("id,page_id,access,enabled").single();
    if (error) throw new Error(error.message);
    return data as ShareLink;
  }
  const { data, error } = await sb
    .from("shares")
    .insert({ id: nanoid(16), user_id: a.account.id, page_id: pageId, access: patch.access ?? "view", enabled: patch.enabled ?? true })
    .select("id,page_id,access,enabled")
    .single();
  if (error) throw new Error(error.message);
  return data as ShareLink;
}

/** Make a brand-new link, so the old one stops working. */
export async function resetShare(pageId: string): Promise<ShareLink> {
  const sb = supabase()!;
  const existing = await getShare(pageId);
  if (existing) await sb.from("shares").delete().eq("id", existing.id);
  return setShare(pageId, { enabled: true, access: existing?.access ?? "view" });
}
