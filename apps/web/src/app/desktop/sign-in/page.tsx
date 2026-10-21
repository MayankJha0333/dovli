import type { Metadata } from "next";
import { DesktopSignInPage } from "@/features/desktop/DesktopSignInPage";

export const metadata: Metadata = { title: "Sign in to the Dovli app", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Opened by Dovli for Mac and Windows in the system browser (see lib/server/desktopAuthCore.ts). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const port = Number(one(q.port));
  const challenge = one(q.challenge);
  const valid = Number.isInteger(port) && port >= 1024 && port <= 65535 && /^[A-Za-z0-9_-]{43}$/.test(challenge);
  return <DesktopSignInPage request={valid ? { port, challenge } : null} />;
}
