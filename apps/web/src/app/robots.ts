import type { MetadataRoute } from "next";

// What search engines may look at: the public pages, never someone's workspace or the API.
const SITE = (process.env.APP_URL || "https://dovli.in").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app", "/p/", "/s/"] },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
