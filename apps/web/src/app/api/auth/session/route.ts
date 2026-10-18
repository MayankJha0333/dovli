// POST { idToken } → sets the session cookie after a sign-in. DELETE → removes it (signing out).

import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/authGate";
import { CodeError } from "@/lib/server/emailCodeCore";
import { errorReply, noStore, readJson, sameOrigin } from "@/lib/server/http";
import { SessionError, createSession, recordSignIn, sessionCookieOptions } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "That request came from another website.", code: "bad_request" }, { status: 403, headers: noStore });
  try {
    const body = await readJson(req, 8_000);
    const { cookie, maxAge, uid, signInMethod } = await createSession(body.idToken);
    // The person's record in Firestore. A hiccup here mustn't stop the sign-in; the app's next
    // check-in fills it in.
    await recordSignIn(uid, signInMethod).catch((e) => console.error("[dovli] Couldn't save the user record:", e));
    const res = NextResponse.json({ ok: true }, { headers: noStore });
    res.cookies.set(SESSION_COOKIE, cookie, sessionCookieOptions(req, maxAge));
    return res;
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: noStore });
    if (e instanceof CodeError) return errorReply(e);
    console.error("[dovli] Couldn't start a session:", e);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again.", code: "server" }, { status: 500, headers: noStore });
  }
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "That request came from another website.", code: "bad_request" }, { status: 403, headers: noStore });
  const res = NextResponse.json({ ok: true }, { headers: noStore });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(req, 0), maxAge: 0 });
  return res;
}
