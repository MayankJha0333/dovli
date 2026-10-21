import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Landing } from "@/features/landing/Landing";
import { authGateOn } from "@/lib/authGate";
import { latestDesktopRelease } from "@/lib/server/desktopRelease";
import { HOME_DESCRIPTION, HOME_TITLE, SHARE_IMAGE, homeJsonLd, ldJson } from "@/lib/seo";

// The words people search for come first ("free note-taking app"), then what makes Dovli different.
const title = { absolute: HOME_TITLE };
const description = HOME_DESCRIPTION;
const shareImage = SHARE_IMAGE;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  // Replaces the layout's openGraph as a whole, so its fields are repeated here.
  openGraph: { type: "website", url: "/", siteName: "Dovli", title: HOME_TITLE, description, images: [shareImage] },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description, images: [shareImage] },
};

/** The landing page, for everyone. Signed-in people get a way straight into the app. */
export default async function HomePage() {
  return (
    <>
      {/* Who makes Dovli, and the web and Android apps, for search engines (see lib/seo.ts). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(homeJsonLd()) }} />
      <Landing accounts={authGateOn} signedIn={await isSignedIn()} desktop={(await latestDesktopRelease())?.version ?? null} />
    </>
  );
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
