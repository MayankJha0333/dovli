// POST { email } → emails a 6-digit sign-in code. See lib/server/emailCode.ts for the rules.

import { NextResponse } from "next/server";
import { sendCode } from "@/lib/server/emailCode";
import { clientIp, errorReply, noStore, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const result = await sendCode(body.email, clientIp(req));
    return NextResponse.json({ ok: true, ...result }, { headers: noStore });
  } catch (e) {
    return errorReply(e);
  }
}
