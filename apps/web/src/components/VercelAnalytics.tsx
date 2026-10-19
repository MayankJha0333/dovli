"use client";

// Vercel Web Analytics (page views and named events) and Speed Insights (real-world loading
// speed). Both only send data on Vercel deployments; locally they do nothing. Addresses are
// cleaned of private ids first (see lib/analytics.ts).

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { redactUrl } from "@/lib/analytics";

export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: redactUrl(event.url) })} />
      <SpeedInsights beforeSend={(data) => ({ ...data, url: redactUrl(data.url) })} />
    </>
  );
}
