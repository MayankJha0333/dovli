import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE, SIGNUP_PATH, authGateOn, loginUrl, sessionLooksLive } from "@/lib/authGate";

// Sends people who aren't signed in to the sign-in page. This is the quick check (it only reads the
// cookie); the app's page checks the cookie's signature on the server too. See lib/authGate.ts.

export function proxy(req: NextRequest) {
  if (!authGateOn) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname === LOGIN_PATH || pathname === SIGNUP_PATH) return NextResponse.next();
  if (sessionLooksLive(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const res = NextResponse.redirect(new URL(loginUrl(pathname + search), req.url));
  res.headers.set("cache-control", "no-store");
  return res;
}

export const config = {
  matcher: [
    // Everything except: API routes (they check sign-in themselves), Next's own files, public share
    // links (/s/…, meant for people without an account), and static files like icons and fonts.
    "/((?!api/|_next/|s/|excalidraw/|favicon\\.ico|icon\\.svg|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|css|js|map|txt|json|webmanifest|xml)$).*)",
  ],
};
