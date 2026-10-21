import type { Metadata } from "next";
import { DownloadPage } from "@/features/download/DownloadPage";
import { latestDesktopRelease } from "@/lib/server/desktopRelease";

export const metadata: Metadata = {
  title: "Download Dovli for Mac and Windows",
  description: "Dovli in its own window on your Mac or Windows PC. Works with no internet and syncs with your phone and the web when you're back online. Free.",
  alternates: { canonical: "/download" },
};

export default async function Page() {
  return <DownloadPage release={await latestDesktopRelease()} />;
}
