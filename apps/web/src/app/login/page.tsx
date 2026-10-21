import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage } from "@/features/auth/AuthPage";
import { authGateOn, safeNext } from "@/lib/authGate";
import { sessionUser } from "@/lib/server/session";

// Kept out of search results (and the sitemap): /signup is the page worth finding.
export const metadata: Metadata = { title: "Sign in · Dovli", alternates: { canonical: "/login" }, robots: { index: false, follow: true } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  // Already signed in: straight on to the app.
  if (authGateOn && (await sessionUser())) redirect(next);
  return <AuthPage mode="login" next={next} />;
}
