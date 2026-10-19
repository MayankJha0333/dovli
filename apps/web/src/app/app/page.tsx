import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceLoader } from "@/features/workspace/WorkspaceLoader";
import { APP_PATH, authGateOn, loginUrl } from "@/lib/authGate";
import { sessionUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Dovli" };

/** The app: your workspace. "/" is the landing page. */
export default async function AppPage() {
  // The proxy already sent people without a cookie to sign in; here the cookie's signature is checked.
  if (!authGateOn) return <WorkspaceLoader />;
  const user = await sessionUser();
  if (!user) redirect(loginUrl(APP_PATH));
  return <WorkspaceLoader accountId={user.id} />;
}
