import type { MetadataRoute } from "next";

// Dovli's public pages, for search engines.
const SITE = (process.env.APP_URL || "https://dovli.in").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/login`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
