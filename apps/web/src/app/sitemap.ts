import type { MetadataRoute } from "next";
import { rivals } from "@/features/compare/data";
import { SITE } from "@/lib/seo";

// Dovli's public pages, for search engines. The sign-in page is left out: it's not worth a search result.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/compare`, changeFrequency: "monthly", priority: 0.8 },
    ...rivals.map((r) => ({ url: `${SITE}/vs/${r.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${SITE}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/delete-account`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
