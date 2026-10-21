"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { Icon, DovliLogo } from "@dovli/ui";
import "@/features/landing/landing.css";
import { APP_PATH, LOGIN_PATH, SIGNUP_PATH, loginUrl } from "@/lib/authGate";
import { auth, initAuth, useAuth } from "@/lib/auth";
import { firebaseConfigured } from "@/lib/firebase";
import { AuthShowcase } from "./AuthShowcase";
import { SignInPanel } from "./SignInDialog";

const delay = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;

const copy = {
  login: {
    badge: "No password needed",
    title: "Welcome back",
    lead: "Sign in with Google, or we'll email you a 6-digit code.",
    pitch: "Pick up where you left off.",
    pitchLead: "Your pages, boards and plans are waiting, on every device you sign in on.",
    switchText: "New to Dovli?",
    switchLink: "Create an account",
  },
  signup: {
    badge: "Free to start",
    title: "Create your Dovli account",
    lead: "Free, and no password to remember. Use Google, or a code we email you.",
    pitch: "A calm place to write, plan and sketch.",
    pitchLead: "Pages inside pages, whiteboards beside your notes, and your own AI apps when you want them.",
    switchText: "Already have an account?",
    switchLink: "Sign in",
  },
};

const points = [
  { icon: "pencil", title: "Write, plan and sketch", text: "Docs, to-dos, flowcharts and whiteboards in one place." },
  { icon: "cloudOff", title: "Works offline", text: "Keep writing without internet. It syncs when you're back." },
  { icon: "sparkles", title: "Use the AI you like", text: "Built-in assistant, or connect your own key or AI app." },
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

  const switchHref = loginUrl(next, mode === "login" ? SIGNUP_PATH : LOGIN_PATH);

  return (
    <div className="grid min-h-dvh bg-bg text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-3 lg:p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Left: the form, with nothing else competing for attention. */}
      <div className="relative isolate flex min-h-dvh flex-col lg:min-h-0">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:hidden">
          <div className="lp-wash absolute -left-24 -right-24 -top-40 h-[340px] opacity-50" />
        </div>

        <header className="flex h-16 items-center justify-between gap-4 px-5 sm:px-10">
          <Link href="/" aria-label="Dovli home" className="rounded-md">
            <DovliLogo size={28} />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-hover hover:text-ink">
            <Icon name="chevronLeft" size={14} />
            Home
          </Link>
        </header>

        <main id="main" className="flex flex-1 flex-col justify-center px-5 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-[400px]">
            <span className="lp-fade inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-xs font-semibold text-accent" style={delay(0)}>
              <Icon name={mode === "login" ? "lock" : "sparkles"} size={12} />
              {t.badge}
            </span>
            <h1 className="lp-fade m-0 mt-4 font-serif text-[36px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[40px]" style={delay(0.05)}>
              {t.title}
            </h1>
            <p className="lp-fade m-0 mb-8 mt-2.5 text-md leading-relaxed text-ink-2" style={delay(0.1)}>
              {t.lead}
            </p>

            <div className="lp-fade" style={delay(0.15)}>
              <SignInPanel mode={mode} onDone={finish} />
            </div>

            <p className="lp-fade m-0 mt-6 text-sm text-ink-2" style={delay(0.2)}>
              {firebaseConfigured ? (
                <>
                  {t.switchText}{" "}
                  <Link href={switchHref} replace className="rounded-sm font-semibold text-accent underline-offset-2 hover:underline">
                    {t.switchLink}
                  </Link>
                </>
              ) : (
                <Link href={APP_PATH} className="rounded-sm font-semibold text-accent underline-offset-2 hover:underline">
                  Open Dovli on this device
                </Link>
              )}
            </p>

            {/* Why Dovli, in three lines: the only picture of the product where the showcase doesn't fit. */}
            <ul className="lp-fade m-0 mt-9 grid list-none gap-3 border-t border-line p-0 pt-6 lg:hidden" style={delay(0.3)}>
              {points.map((p) => (
                <li key={p.text} className="flex items-start gap-3">
                  <span className="grid size-8 flex-none place-items-center rounded-lg bg-well text-accent" aria-hidden="true">
                    <Icon name={p.icon} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{p.title}</span>
                    <span className="block text-sm text-ink-3">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-5 pb-6 text-xs text-ink-3 sm:px-10">
          <span>© {new Date().getFullYear()} Dovli</span>
          <span className="flex items-center gap-1.5">
            <Icon name="shield" size={12} />
            {mode === "signup" ? "By creating an account, you agree to our" : "Your pages are private to your account."}
            <Link href="/privacy" className="font-medium text-ink-2 underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
          </span>
        </footer>
      </div>

      {/* Right: what Dovli looks like (from laptop width; narrower screens get the form on its own). */}
      <AuthShowcase title={t.pitch} lead={t.pitchLead} />
    </div>
  );
}
