import { redirect } from "next/navigation";
import { WorkspaceLoader } from "@/features/workspace/WorkspaceLoader";
import { authGateOn, loginUrl } from "@/lib/authGate";
import { sessionUser } from "@/lib/server/session";

export default async function HomePage() {
  // The proxy already sent people without a cookie to sign in; here the cookie's signature is checked.
  if (!authGateOn) return <WorkspaceLoader />;
  const user = await sessionUser();
  if (!user) redirect(loginUrl("/"));
  return <WorkspaceLoader accountId={user.id} />;
}
