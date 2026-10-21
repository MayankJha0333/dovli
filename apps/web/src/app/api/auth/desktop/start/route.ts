// POST { idToken, challenge } → { code }: the desktop app's sign-in page (app/desktop/sign-in) after
// the person signs in. The code goes back to the app, which redeems it. See lib/server/desktopAuthCore.ts.

import { NextResponse } from "next/server";
import { desktopAuth } from "@/lib/server/desktopAuth";
import { CodeError } from "@/lib/server/emailCodeCore";
import { errorReply, noStore, readJson, sameOrigin } from "@/lib/server/http";
import { SessionError, freshSignIn, recordSignIn } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "That request came from another website.", code: "bad_request" }, { status: 403, headers: noStore });
  try {
    const body = await readJson(req, 8_000);
    const user = await freshSignIn(body.idToken);
    const result = await desktopAuth().start(user, body.challenge);
    await recordSignIn(user.uid, user.signInMethod).catch((e) => console.error("[dovli] Couldn't save the user record:", e));
    return NextResponse.json(result, { headers: noStore });
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: noStore });
    if (e instanceof CodeError) return errorReply(e);
    console.error("[dovli] Couldn't start the desktop sign-in:", e);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again.", code: "server" }, { status: 500, headers: noStore });
  }
}
