import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Landing } from "@/features/landing/Landing";
import { authGateOn } from "@/lib/authGate";

export const metadata: Metadata = {
  title: "Dovli · A calm place to write, plan and sketch",
  description: "Notes, docs and whiteboards in one calm place. Templates, MCP for your AI apps, a web clipper and an Android app on the way.",
};

/** The landing page, for everyone. Signed-in people get a way straight into the app. */
export default async function HomePage() {
  return <Landing accounts={authGateOn} signedIn={await isSignedIn()} />;
}

/**
 * Whether this visitor has a session. The sign-in check is loaded only when needed, and any
 * failure in it (a missing setting, a server library that won't load) just shows the signed-out
 * landing page: the front door must never be the thing that breaks.
 */
async function isSignedIn(): Promise<boolean> {
  if (!authGateOn) return false;
  try {
    const { sessionUser } = await import("@/lib/server/session");
    return Boolean(await sessionUser());
  } catch (e) {
    unstable_rethrow(e); // Next's own signals (like "this page reads cookies, render it per request") pass through
    console.error("Landing page: couldn't check the session", e);
    return false;
  }
}
