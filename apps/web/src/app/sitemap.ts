import type { MetadataRoute } from "next";
import { rivals } from "@/features/compare/data";
import { SITE, UPDATED } from "@/lib/seo";

// Dovli's public pages, for search engines. The sign-in page is left out: it's not worth a search result.
// Google reads only the address and lastModified; the frequency and priority are hints for others.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, lastModified: UPDATED.home, changeFrequency: "weekly", priority: 1, images: [`${SITE}/landing/og.jpg`] },
    { url: `${SITE}/download`, lastModified: UPDATED.download, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/compare`, lastModified: UPDATED.compare, changeFrequency: "monthly", priority: 0.8 },
    ...rivals.map((r) => ({ url: `${SITE}/vs/${r.slug}`, lastModified: UPDATED.compare, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${SITE}/signup`, lastModified: UPDATED.signup, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/privacy`, lastModified: UPDATED.privacy, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/delete-account`, lastModified: UPDATED.deleteAccount, changeFrequency: "yearly", priority: 0.2 },
  ];
}
