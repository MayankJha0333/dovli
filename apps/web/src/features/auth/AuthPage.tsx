"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon, DovliLogo } from "@dovli/ui";
import { LOGIN_PATH, SIGNUP_PATH, loginUrl } from "@/lib/authGate";
import { auth, initAuth, useAuth } from "@/lib/auth";
import { firebaseConfigured } from "@/lib/firebase";
import { SignInPanel } from "./SignInDialog";

const copy = {
  login: {
    title: "Welcome back",
    lead: "Sign in to get to your pages.",
    switchText: "New to Dovli?",
    switchLink: "Create an account",
  },
  signup: {
    title: "Create your Dovli account",
    lead: "Free, and no password to remember. Use Google, or a code we email you.",
    switchText: "Already have an account?",
    switchLink: "Sign in",
  },
};

const points = [
  { icon: "pencil", text: "Write, plan and sketch in one calm place" },
  { icon: "lock", text: "Only you can open your workspace" },
  { icon: "cloudOff", text: "Pages keep working offline" },
] as const;

/** The sign-in and sign-up pages. After signing in, the session cookie is set and we go to `next`. */
export function AuthPage({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const t = copy[mode];
  const status = useAuth((s) => s.status);
  const tried = useRef(false);

  useEffect(() => initAuth(), []);

  const leaving = useRef(false);
  function goOn() {
    if (leaving.current) return;
    leaving.current = true;
    // The part after # (a page link) isn't sent to the server, so carry it over by hand.
    const hash = next.includes("#") ? "" : window.location.hash;
    window.location.replace(next + hash);
  }

  async function finish() {
    await auth.startSession();
    goOn();
    await new Promise(() => {}); // keep "Signing you in…" showing until the new page loads
  }

  // Already signed in with Firebase in this browser (for example, back from Google's page, or the
  // cookie ran out): try to start the session quietly. If that sign-in is too old, the form stays.
  useEffect(() => {
    if (status !== "signed-in" || tried.current) return;
    tried.current = true;
    auth.startSession().then(goOn, () => {});
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-bg text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[200px] -top-[240px] h-[600px] w-[720px] rounded-full bg-[var(--d-glow-1)] opacity-[var(--d-glow-1-o)] blur-[120px]" />
        <div className="absolute -right-[180px] bottom-[8%] h-[520px] w-[600px] rounded-full bg-[var(--d-glow-2)] opacity-[var(--d-glow-2-o)] blur-[130px]" />
      </div>

      <header className="flex h-16 items-center px-5 sm:px-8">
        <DovliLogo size={34} tagline />
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-0">
        <div className="grid w-full max-w-[960px] items-center gap-10 md:grid-cols-[1fr_420px]">
          <section className="hidden flex-col gap-6 md:flex" aria-label="About Dovli">
            <p className="m-0 max-w-[420px] font-display text-[40px] font-bold leading-[1.1] tracking-tight text-ink">A calm place to write, plan and sketch.</p>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {points.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-md text-ink-2">
                  <span className="grid size-8 flex-none place-items-center rounded-md bg-accent-soft text-accent" aria-hidden="true">
                    <Icon name={p.icon} size={16} />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </section>

          <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
            <div className="rounded-xl px-6 pb-6 pt-7 surface-raised sm:px-8 sm:pb-8">
              <h1 className="m-0 font-display text-2xl font-bold tracking-tight text-ink">{t.title}</h1>
              <p className="mb-6 mt-1.5 text-sm text-ink-2">{t.lead}</p>
              <SignInPanel mode={mode} onDone={finish} />
            </div>

            {firebaseConfigured ? (
              <p className="m-0 text-center text-sm text-ink-2">
                {t.switchText}{" "}
                <Link
                  href={loginUrl(next, mode === "login" ? SIGNUP_PATH : LOGIN_PATH)}
                  replace
                  className="rounded-sm font-semibold text-accent underline-offset-2 hover:underline"
                >
                  {t.switchLink}
                </Link>
              </p>
            ) : (
              <p className="m-0 text-center text-sm text-ink-2">
                <Link href="/" className="rounded-sm font-semibold text-accent underline-offset-2 hover:underline">
                  Open Dovli on this device
                </Link>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
