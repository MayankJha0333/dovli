// Product analytics with Vercel Web Analytics.
//
// Page views are counted on every plan. The named events below are counted on Vercel's Pro plan
// (on Hobby they are sent but not stored), and each carries at most 2 properties, the Pro limit.
// Nothing personal is ever sent: no names, emails, page titles or page ids.

import { track } from "@vercel/analytics";

type Events = {
  /** A "Create free account" button on the landing page. `place`: which one. */
  "Sign-up click": { place: string };
  /** An "Open Dovli" button on the landing page, for people already signed in. */
  "Open app click": { place: string };
  /** Interest in something that isn't out yet. */
  "Coming soon click": { app: "extension" | "android" };
  /** Someone finished signing in. `flow`: the sign-in page, the sign-up page, or the in-app dialog. */
  "Signed in": { method: "google" | "email"; flow: "login" | "signup" | "dialog" };
};

export function trackEvent<K extends keyof Events>(name: K, props: Events[K]) {
  try {
    track(name, props);
  } catch {
    /* analytics must never break the page */
  }
}

/**
 * Page addresses with private ids in them are grouped before they're sent, so the dashboard
 * shows "/s/[id]" instead of one row per shared page (and never the ids themselves).
 */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    u.pathname = u.pathname.replace(/^\/s\/[^/]+/, "/s/[id]").replace(/^\/p\/[^/]+\/[^/]+/, "/p/[workspace]/[page]");
    u.hash = ""; // "#p-…" is a page id inside the app
    // Keep only campaign tags; drop anything else (like ?next= on the sign-in page).
    for (const key of [...u.searchParams.keys()]) if (!key.startsWith("utm_")) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return url;
  }
}
