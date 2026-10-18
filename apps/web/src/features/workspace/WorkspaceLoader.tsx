"use client";

import dynamic from "next/dynamic";

// The workspace reads this device's saved pages and uses the editor and whiteboard,
// which only run in a browser. So it renders on the client only.
const Workspace = dynamic(() => import("@/features/workspace/Workspace"), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-bg" aria-busy="true" />,
});

export function WorkspaceLoader() {
  return <Workspace />;
}
