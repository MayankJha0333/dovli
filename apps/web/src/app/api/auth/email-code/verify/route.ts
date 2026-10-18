// POST { email, code, name? } → { token }: a one-time Firebase custom token the app signs in with.

import { NextResponse } from "next/server";
import { verifyCode } from "@/lib/server/emailCode";
import { errorReply, noStore, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const result = await verifyCode(body.email, body.code, body.name);
    return NextResponse.json(result, { headers: noStore });
  } catch (e) {
    return errorReply(e);
  }
}
