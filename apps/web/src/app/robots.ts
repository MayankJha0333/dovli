import type { MetadataRoute } from "next";

import { SITE } from "@/lib/seo";

// What search engines may look at: the public pages, never someone's workspace or the API.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app", "/p/", "/s/"] },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
