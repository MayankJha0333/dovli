import type { Metadata } from "next";
import { Landing } from "@/features/landing/Landing";
import { authGateOn } from "@/lib/authGate";
import { sessionUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Dovli · A calm place to write, plan and sketch",
  description: "Notes, docs and whiteboards in one calm place. Templates, MCP for your AI apps, a web clipper and an Android app on the way.",
};

/** The landing page, for everyone. Signed-in people get a way straight into the app. */
export default async function HomePage() {
  const signedIn = authGateOn ? Boolean(await sessionUser().catch(() => null)) : false;
  return <Landing accounts={authGateOn} signedIn={signedIn} />;
}
