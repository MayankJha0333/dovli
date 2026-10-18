"use client";

import dynamic from "next/dynamic";
import type { SharedSource } from "./SharedPage";

const SharedPage = dynamic(() => import("./SharedPage"), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-bg" aria-busy="true" />,
});

export function SharedPageLoader({ source }: { source: SharedSource }) {
  return <SharedPage source={source} />;
}
