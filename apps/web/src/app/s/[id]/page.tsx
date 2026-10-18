import type { Metadata } from "next";
import { SharedPageLoader } from "@/features/shared/SharedPageLoader";

export const metadata: Metadata = {
  title: "Shared page · Dovli",
  robots: { index: false, follow: false },
};

export default async function SharedPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SharedPageLoader source={{ linkId: id }} />;
}
