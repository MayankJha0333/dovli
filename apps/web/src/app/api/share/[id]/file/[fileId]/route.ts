// Lets people viewing a shared page see its images and files, which live in the owner's private
// folder. The server checks that the file really is part of that shared page, then hands out a
// link that works for a few minutes.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await ctx.params;
  const admin = supabaseAdmin();
  if (!admin) return new NextResponse("Not available", { status: 501 });
  if (!/^[\w-]{6,64}$/.test(id) || !/^[\w-]{6,64}$/.test(fileId)) return new NextResponse("Not found", { status: 404 });

  const { data: owner } = await admin.rpc("shared_file_owner", { p_share: id, p_file: fileId });
  if (!owner) return new NextResponse("Not found", { status: 404 });

  const { data } = await admin.storage.from("files").createSignedUrl(`${owner}/${fileId}`, 300);
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=240" } });
}
