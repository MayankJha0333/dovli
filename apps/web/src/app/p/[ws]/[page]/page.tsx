import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SharedPageLoader } from "@/features/shared/SharedPageLoader";
import { authGateOn, loginUrl } from "@/lib/authGate";
import { sessionUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Shared page · Dovli",
  robots: { index: false, follow: false },
};

/** A page someone shared with you by email. You need to be signed in (the proxy checks too). */
export default async function InvitedPage({ params }: { params: Promise<{ ws: string; page: string }> }) {
  const { ws, page } = await params;
  if (authGateOn && !(await sessionUser())) redirect(loginUrl(`/p/${encodeURIComponent(ws)}/${encodeURIComponent(page)}`));
  return <SharedPageLoader source={{ workspaceId: ws, pageId: page }} />;
}
