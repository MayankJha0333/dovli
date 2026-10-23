import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE, SIGNUP_PATH, authGateOn, loginUrl, sessionLooksLive } from "@/lib/authGate";

// Sends people who aren't signed in to the sign-in page. This is the quick check (it only reads the
// cookie); the app's page checks the cookie's signature on the server too. See lib/authGate.ts.

// "/desktop/sign-in": the desktop app sends people there to sign in, so it can't need a session.
const PUBLIC_PATHS = new Set(["/", "/welcome", "/privacy", "/delete-account", "/compare", "/download", "/apk", "/desktop/sign-in"]);
/** Pages under these are public too: Dovli vs Notion, Craft and Evernote. */
const PUBLIC_PREFIXES = ["/vs/"];

export function proxy(req: NextRequest) {
  if (!authGateOn) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  // The sign-in pages, the landing page ("/", for everyone; "/welcome" is an old address for it), the
  // legal pages, which the app stores and the apps link to, and the comparison pages.
  if (pathname === LOGIN_PATH || pathname === SIGNUP_PATH || PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (sessionLooksLive(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const res = NextResponse.redirect(new URL(loginUrl(pathname + search), req.url));
  res.headers.set("cache-control", "no-store");
  return res;
}

export const config = {
  matcher: [
    // Everything except: API routes (they check sign-in themselves), Next's own files, public share
    // links (/s/…, meant for people without an account), and static files like icons and fonts.
    "/((?!api/|_next/|s/|excalidraw/|favicon\\.ico|icon\\.svg|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|css|m?js|map|txt|json|webmanifest|xml|tgz)$).*)",
  ],
};
