"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { DovliLogo, Icon, Spinner } from "@dovli/ui";
import "@/features/landing/landing.css";
import { AuthError, initAuth } from "@/lib/auth";
import { firebaseAuth } from "@/lib/firebase";
import { SignInPanel } from "@/features/auth/SignInDialog";

const delay = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;

/**
 * The desktop app's sign-in, in the system browser (Google's page can't open inside an app window).
 * After signing in here, the browser goes back to the app on this computer with a one-time code.
 */
export function DesktopSignInPage({ request }: { request: { port: number; challenge: string } | null }) {
  const [returning, setReturning] = useState(false);
  useEffect(() => initAuth(), []);

  async function backToApp() {
    if (!request) return;
    const user = firebaseAuth()?.currentUser;
    if (!user) throw new AuthError("Please sign in first.", "signed-out");
    let res: Response;
    try {
      res = await fetch("/api/auth/desktop/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: await user.getIdToken(), challenge: request.challenge }),
      });
    } catch {
      throw new AuthError("Couldn't reach Dovli. Check your connection and try again.", "network");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.code !== "string") throw new AuthError(data.error ?? "Something went wrong. Please try again.", data.code ?? "server");
    setReturning(true);
    // A top-level visit, not fetch: every browser allows it, and the app answers with its own page.
    window.location.assign(`http://127.0.0.1:${request.port}/done?code=${encodeURIComponent(data.code)}`);
    await new Promise(() => {}); // keep "Signing you in…" until the app's page loads
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-bg text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="lp-wash absolute -left-24 -right-24 -top-40 h-[380px] opacity-50" />
      </div>

      <header className="flex h-16 items-center px-5 sm:px-10">
        <DovliLogo size={28} />
      </header>

      <main id="main" className="flex flex-1 flex-col justify-center px-5 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-[400px]">
          <span className="lp-fade inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-xs font-semibold text-accent" style={delay(0)}>
            <Icon name="monitor" size={12} />
            Dovli for Mac and Windows
          </span>
          {!request ? (
            <>
              <h1 className="lp-fade m-0 mt-4 font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.025em]" style={delay(0.05)}>
                Start from the Dovli app
              </h1>
              <p className="lp-fade m-0 mt-2.5 text-md leading-relaxed text-ink-2" style={delay(0.1)}>
                This page signs in the Dovli app on your computer. Open the app and choose <strong className="text-ink">Continue with Google</strong> to come back here.
              </p>
            </>
          ) : returning ? (
            <div role="status" className="lp-fade mt-6 flex items-center gap-3 rounded-lg bg-well p-4" style={delay(0)}>
              <Spinner label="Opening Dovli" />
              <span className="text-md text-ink">Signing you in to the app…</span>
            </div>
          ) : (
            <>
              <h1 className="lp-fade m-0 mt-4 font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.025em]" style={delay(0.05)}>
                Sign in to the Dovli app
              </h1>
              <p className="lp-fade m-0 mb-8 mt-2.5 text-md leading-relaxed text-ink-2" style={delay(0.1)}>
                Use Google or an email code. Then you&apos;re back in the app on your computer.
              </p>
              <div className="lp-fade" style={delay(0.15)}>
                <SignInPanel mode="login" onDone={backToApp} />
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="flex items-center gap-1.5 px-5 pb-6 text-xs text-ink-3 sm:px-10">
        <Icon name="shield" size={12} />
        Only the Dovli app that opened this page can use this sign-in.
      </footer>
    </div>
  );
}
