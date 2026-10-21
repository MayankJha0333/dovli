import { useState, type CSSProperties } from "react";
import { Button, DovliLogo, Icon } from "@dovli/ui";
import "@/features/landing/landing.css";
import { AuthShowcase } from "@/features/auth/AuthShowcase";
import { SignInPanel } from "@/features/auth/SignInDialog";
import { desktop, useBrowserSignIn } from "@/lib/desktop";

// The first screen of the desktop app: sign in, and your pages come down from your account. Once
// Firebase reports the sign-in, DesktopApp swaps this for the workspace.

const delay = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;
const system = desktop?.platform === "win32" ? "Windows" : "Mac";

const points = [
  { icon: "cloudOff", title: "Works offline", text: "Everything is saved on this computer. It syncs when you're back online." },
  { icon: "sync", title: "On all your devices", text: "The same pages on your phone, the web and every computer you sign in on." },
  { icon: "lock", title: "Private to you", text: "Your pages are only in your account and on your devices." },
] as const;

export function SignInScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const waiting = useBrowserSignIn();

  return (
    <div className="grid min-h-dvh bg-bg pt-[var(--dt-bar)] text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-3 lg:p-3 lg:pt-[var(--dt-bar)]">
      <div className="relative isolate flex min-h-0 flex-col overflow-y-auto">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:hidden">
          <div className="lp-wash absolute -left-24 -right-24 -top-40 h-[340px] opacity-50" />
        </div>

        <main id="main" className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-12">
          <div className="mx-auto w-full max-w-[400px]">
            <DovliLogo size={30} className="lp-fade" />
            <span className="lp-fade mt-8 inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-xs font-semibold text-accent" style={delay(0.03)}>
              <Icon name="monitor" size={12} />
              Dovli for {system}
            </span>
            <h1 className="lp-fade m-0 mt-4 font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.025em]" style={delay(0.06)}>
              {mode === "login" ? "Welcome to Dovli" : "Create your Dovli account"}
            </h1>
            <p className="lp-fade m-0 mb-7 mt-2.5 text-md leading-relaxed text-ink-2" style={delay(0.1)}>
              {mode === "login"
                ? "Sign in and your pages come with you. No password: use Google, or a code we email you."
                : "Free, and no password to remember. Use Google, or a code we email you."}
            </p>

            <div className="lp-fade" style={delay(0.14)}>
              {/* A new panel for each mode, so a half-typed code doesn't carry over. */}
              <SignInPanel key={mode} mode={mode} />
            </div>

            {waiting && (
              <div role="status" className="mt-4 flex items-start gap-3 rounded-lg border border-line bg-well p-3.5 text-sm">
                <Icon name="google" size={18} className="mt-0.5 flex-none" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-semibold text-ink">Finish signing in in your browser</p>
                  <p className="m-0 mt-0.5 text-ink-2">We opened dovli.in in your web browser. You&apos;ll come straight back here.</p>
                </div>
                <Button size="sm" variant="ghost" className="-my-1 -mr-1.5" onClick={() => desktop?.cancelGoogleSignIn()}>
                  Cancel
                </Button>
              </div>
            )}

            <p className="lp-fade m-0 mt-6 text-sm text-ink-2" style={delay(0.2)}>
              {mode === "login" ? "New to Dovli?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="rounded-sm font-semibold text-accent underline-offset-2 hover:underline">
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>

            <ul className="lp-fade m-0 mt-9 grid list-none gap-3 border-t border-line p-0 pt-6 lg:hidden" style={delay(0.28)}>
              {points.map((p) => (
                <li key={p.title} className="flex items-start gap-3">
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

        <footer className="flex items-center gap-1.5 px-6 pb-5 text-xs text-ink-3 sm:px-12">
          <Icon name="shield" size={12} />
          Your pages are private to your account.
          <button type="button" onClick={() => window.open(`${desktop?.siteUrl ?? ""}/privacy`)} className="font-medium text-ink-2 underline-offset-2 hover:underline">
            Privacy Policy
          </button>
        </footer>
      </div>

      <AuthShowcase title="Your pages, on this computer." lead="Write, plan and sketch with or without internet. Dovli keeps every device in step." />
    </div>
  );
}
