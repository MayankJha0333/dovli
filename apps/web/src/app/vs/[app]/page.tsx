import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VsPage } from "@/features/compare/ComparePages";
import { rivalBySlug, rivals } from "@/features/compare/data";
import { SHARE_IMAGE } from "@/lib/seo";

// Dovli vs Notion, Craft and Evernote: one page each, built ahead of time. Any other /vs/… is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return rivals.map((r) => ({ app: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ app: string }> }): Promise<Metadata> {
  const rival = rivalBySlug((await params).app);
  if (!rival) return {};
  const url = `/vs/${rival.slug}`;
  return {
    title: rival.title,
    description: rival.description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, siteName: "Dovli", title: rival.title, description: rival.description, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: rival.title, description: rival.description, images: [SHARE_IMAGE] },
  };
}

export default async function VsRoute({ params }: { params: Promise<{ app: string }> }) {
  const rival = rivalBySlug((await params).app);
  if (!rival) notFound();
  return <VsPage rival={rival} />;
}
