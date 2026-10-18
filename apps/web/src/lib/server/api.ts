import "server-only";
import { NextResponse } from "next/server";
import { CloudError } from "./cloudCore";
import { CodeError } from "./emailCodeCore";
import { noStore, readJson } from "./http";
import { userFromRequest, type RequestUser } from "./firebaseAdmin";

/** A route for a signed-in person: checks the Firebase ID token, reads the JSON, turns errors into replies. */
export function signedInRoute(handler: (user: RequestUser, body: Record<string, unknown>, req: Request) => Promise<unknown>, maxChars = 2_000) {
  return async (req: Request) => {
    try {
      const user = await userFromRequest(req);
      if (!user) return NextResponse.json({ error: "Please sign in again.", code: "signed_out" }, { status: 401, headers: noStore });
      const body = await readJson(req, maxChars);
      return NextResponse.json(await handler(user, body, req), { headers: noStore });
    } catch (e) {
      if (e instanceof CloudError || e instanceof CodeError) {
        const code = e instanceof CloudError ? e.code : e.kind;
        return NextResponse.json({ error: e.message, code }, { status: e.status, headers: noStore });
      }
      console.error("[dovli] Cloud request failed:", e);
      return NextResponse.json({ error: "Something went wrong on our side. Please try again.", code: "server" }, { status: 500, headers: noStore });
    }
  };
}
