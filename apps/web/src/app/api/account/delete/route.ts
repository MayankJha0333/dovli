// Deletes a signed-in person's account and everything in the cloud: pages, share links, files and
// AI usage. Needs the service key, because only the server may remove an account.

import { NextResponse } from "next/server";
import { supabaseAdmin, userFromRequest } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Account deletion needs SUPABASE_SERVICE_ROLE_KEY on the server." }, { status: 501 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please sign in again, then try once more." }, { status: 401 });

  // Files first: remove every object in the person's folder, page by page.
  for (;;) {
    const { data: list, error } = await admin.storage.from("files").list(user.id, { limit: 100 });
    if (error || !list?.length) break;
    await admin.storage.from("files").remove(list.map((f) => `${user.id}/${f.name}`));
    if (list.length < 100) break;
  }

  // Rows go with the account (on delete cascade), but delete explicitly so nothing lingers.
  await admin.from("shares").delete().eq("user_id", user.id);
  await admin.from("pages").delete().eq("user_id", user.id);
  await admin.from("ai_usage").delete().eq("user_id", user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Couldn't delete the account. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
