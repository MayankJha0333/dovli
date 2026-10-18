import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage } from "@/features/auth/AuthPage";
import { authGateOn, safeNext } from "@/lib/authGate";
import { sessionUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Create account · Dovli" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  if (authGateOn && (await sessionUser())) redirect(next);
  return <AuthPage mode="signup" next={next} />;
}
