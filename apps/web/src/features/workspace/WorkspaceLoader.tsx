"use client";

import dynamic from "next/dynamic";
import { setAccountStorage } from "@/lib/db";

// The workspace reads this device's saved pages and uses the editor and whiteboard,
// which only run in a browser. So it renders on the client only.
const Workspace = dynamic(() => import("@/features/workspace/Workspace"), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-bg" aria-busy="true" />,
});

/** `accountId`: the signed-in account (from the server-checked session), or none without accounts. */
export function WorkspaceLoader({ accountId }: { accountId?: string }) {
  // Before anything opens the database, so this account only ever sees its own pages.
  if (accountId && typeof window !== "undefined") setAccountStorage(accountId);
  return <Workspace accountId={accountId} />;
}
