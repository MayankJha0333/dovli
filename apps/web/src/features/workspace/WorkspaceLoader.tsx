"use client";

import dynamic from "next/dynamic";

// The workspace reads this browser's saved pages and uses the editor and whiteboard,
// which only run in a browser. So it renders on the client only.
const Workspace = dynamic(() => import("@/features/workspace/Workspace"), {
  ssr: false,
  loading: () => <div className="app-loading" aria-busy="true" />,
});

export function WorkspaceLoader() {
  return <Workspace />;
}
