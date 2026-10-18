"use client";

import dynamic from "next/dynamic";

const SharedPage = dynamic(() => import("./SharedPage"), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-bg" aria-busy="true" />,
});

export function SharedPageLoader({ shareId }: { shareId: string }) {
  return <SharedPage shareId={shareId} />;
}
