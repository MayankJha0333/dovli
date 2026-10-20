import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Landing } from "@/features/landing/Landing";
import { authGateOn } from "@/lib/authGate";

const title = "Dovli · A calm place to write, plan and sketch";
const description = "Notes, docs and whiteboards in one calm place, on the web and on Android. Templates, an AI assistant beside every page, and MCP for the AI apps you already use.";
const shareImage = { url: "/landing/og.jpg", width: 1200, height: 630, alt: "Dovli: a calm place to write, plan and sketch." };

export const metadata: Metadata = {
  title,
  description,
  // Replaces the layout's openGraph as a whole, so its fields are repeated here.
  openGraph: { type: "website", url: "/", siteName: "Dovli", title, description, images: [shareImage] },
  twitter: { card: "summary_large_image", title, description, images: [shareImage] },
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
