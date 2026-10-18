import "server-only";
import { NextResponse } from "next/server";
import { CodeError } from "./emailCodeCore";

/** The visitor's network address, as passed on by the host (Vercel, a proxy) or the socket. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
}

/** Read a small JSON body, refusing anything else. */
export async function readJson(req: Request, maxChars = 2_000): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new CodeError("bad_request", "That request didn't make sense.", 415);
  const text = await req.text();
  if (text.length > maxChars) throw new CodeError("bad_request", "That request was too big.", 413);
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : {};
  } catch {
    throw new CodeError("bad_request", "That request didn't make sense.", 400);
  }
}

/** Turn an error into a reply the app can show. Unexpected errors are logged, not shown. */
export function errorReply(e: unknown) {
  if (e instanceof CodeError) {
    const res = NextResponse.json({ error: e.message, code: e.kind, ...e.extra }, { status: e.status });
    if (e.extra.retryAfter) res.headers.set("retry-after", String(e.extra.retryAfter));
    return res;
  }
  console.error("[dovli] Email sign-in failed:", e);
  return NextResponse.json({ error: "Something went wrong on our side. Please try again.", code: "server" }, { status: 500 });
}

export const noStore = { "cache-control": "no-store" };

/** Refuse requests sent from another website (a browser always sends Origin on cross-site POSTs). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
