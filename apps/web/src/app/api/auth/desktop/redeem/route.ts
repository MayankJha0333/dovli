// POST { code, verifier } → { token }: the desktop app swaps the code from its sign-in page for a
// Firebase custom token. Only the app knows the verifier. See lib/server/desktopAuthCore.ts.

import { NextResponse } from "next/server";
import { desktopAuth } from "@/lib/server/desktopAuth";
import { CodeError } from "@/lib/server/emailCodeCore";
import { errorReply, noStore, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    return NextResponse.json(await desktopAuth().redeem(body.code, body.verifier), { headers: noStore });
  } catch (e) {
    if (e instanceof CodeError) return errorReply(e);
    console.error("[dovli] Couldn't finish the desktop sign-in:", e);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again.", code: "server" }, { status: 500, headers: noStore });
  }
}
