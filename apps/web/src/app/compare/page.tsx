import type { Metadata } from "next";
import { OverviewPage } from "@/features/compare/ComparePages";
import { SHARE_IMAGE } from "@/lib/seo";

const title = "Notion vs Craft vs Evernote vs Dovli: best note-taking app compared";
const description =
  "Notion, Craft, Evernote and Dovli compared in plain words: what each is best at, free plan limits, whiteboards, offline use, and how to move your notes.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/compare" },
  openGraph: { type: "article", url: "/compare", siteName: "Dovli", title, description, images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
};

export default function ComparePage() {
  return <OverviewPage />;
}
