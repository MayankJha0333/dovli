"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Field, Icon, Input, toast } from "@dovli/ui";
import { AuthError, auth } from "@/lib/auth";
import { firebaseConfigured } from "@/lib/firebase";
import { ui, useUI } from "@/lib/ui";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Seconds left until a moment, ticking once a second. */
function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now()); // start from now, not from the last tick
    if (until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/**
 * Sign in with Google, or with a 6-digit code sent by email. Used on the sign-in and sign-up pages
 * (`mode`), and in the dialog and Settings when Dovli runs without the sign-in gate.
 * `onDone` runs after Firebase has signed the person in; errors it throws are shown here.
 */
export function SignInPanel({ onDone, mode }: { onDone?: () => void | Promise<void>; mode?: "login" | "signup" }) {
  const signup = mode === "signup";
  const [step, setStep] = useState<"start" | "code">("start");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "google" | "send" | "verify" | "finish">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const resendIn = useCountdown(resendAt);
  const expiresIn = useCountdown(expiresAt);
  const codeInput = useRef<HTMLInputElement>(null);

  // An error from coming back after a Google redirect.
  useEffect(() => {
    const e = auth.takeRedirectError();
    if (e) void handleGoogleError(e);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!firebaseConfigured)
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-well p-4 text-sm text-ink-2">
        <p className="m-0 font-semibold text-ink">Accounts aren't set up on this copy of Dovli</p>
        <p className="m-0">
          Your pages are saved on this device and work offline. To turn on sign-in, add your Firebase web config (
          <code className="font-mono text-xs">NEXT_PUBLIC_FIREBASE_*</code>) and restart. The README explains the steps.
        </p>
      </div>
    );

  const signedIn = async () => {
    setBusy("finish");
    await onDone?.();
    if (!mode) toast("Signed in");
  };

  async function send(raw: string, why?: string) {
    const to = raw.trim().toLowerCase();
    setEmail(to);
    setError("");
    setBusy("send");
    try {
      const r = await auth.sendEmailCode(to);
      setStep("code");
      setCode("");
      setResendAt(Date.now() + r.resendAfter * 1000);
      setExpiresAt(Date.now() + r.expiresIn * 1000);
      setNotice(why ?? "");
      requestAnimationFrame(() => codeInput.current?.focus());
    } catch (e) {
      // Asked again too soon: still go to the code step, and show when a resend is possible.
      if (e instanceof AuthError && e.code === "wait" && e.extra.retryAfter) {
        setStep("code");
        setResendAt(Date.now() + e.extra.retryAfter * 1000);
      }
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }

  async function verify(value: string) {
    if (busy) return;
    setError("");
    setBusy("verify");
    try {
      await auth.verifyEmailCode(email.trim(), value, signup ? name : undefined);
      await signedIn();
    } catch (e) {
      setError(errorText(e));
      if (e instanceof AuthError && (e.code === "expired" || e.code === "locked")) {
        setExpiresAt(0);
        setResendAt(0); // a fresh code can be sent straight away
      }
      setCode("");
      requestAnimationFrame(() => codeInput.current?.focus());
    } finally {
      setBusy("");
    }
  }

  async function handleGoogleError(e: unknown) {
    if (e instanceof AuthError && e.code === "link-needed" && e.extra.email) {
      // This email already signs in with a code: send one, then Google gets added to the account.
      setEmail(e.extra.email);
      await send(e.extra.email, e.message);
      return;
    }
    setError(errorText(e));
  }

  async function google() {
    setError("");
    setNotice("");
    setBusy("google");
    try {
      if (await auth.signInWithGoogle()) await signedIn();
    } catch (e) {
      await handleGoogleError(e);
    } finally {
      setBusy("");
    }
  }

  const expired = step === "code" && expiresAt > 0 && expiresIn === 0;

  return (
    <div className="flex flex-col gap-3">
      {step === "start" ? (
        <>
          <Button size="lg" block onClick={google} disabled={!!busy} className="justify-center">
            <Icon name="google" size={18} />
            {busy === "finish" ? "Signing you in…" : busy === "google" ? "Opening Google…" : signup ? "Sign up with Google" : "Continue with Google"}
          </Button>
          <div className="flex items-center gap-3 py-1 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>
          <form
            className="flex flex-col gap-2.5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void send(email.trim());
            }}
          >
            {signup && (
              <Field label="Your name">
                {(p) => (
                  <Input
                    {...p}
                    autoComplete="name"
                    autoFocus
                    maxLength={80}
                    placeholder="First and last name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </Field>
            )}
            <Field label="Email">
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus={mode === "login"}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant="primary" size="lg" block disabled={!!busy || !/\S+@\S+\.\S+/.test(email) || (signup && !name.trim())}>
              {busy === "send" ? "Sending…" : signup ? "Email me a code to create my account" : "Email me a sign-in code"}
            </Button>
          </form>
        </>
      ) : (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) void verify(code);
          }}
        >
          {notice && <p className="m-0 rounded-md bg-accent-soft px-3 py-2 text-sm text-ink">{notice}</p>}
          <p className="m-0 text-sm text-ink-2">
            We emailed a 6-digit code to <strong className="break-all text-ink">{email.trim()}</strong>.{" "}
            {expiresAt > 0 && !expired && <span className="text-ink-3">It works for {clock(expiresIn)}.</span>}
          </p>
          <Field label="Sign-in code">
            {(p) => (
              <Input
                {...p}
                ref={codeInput}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                disabled={busy === "verify" || busy === "finish"}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) void verify(v); // typed or pasted the whole code
                }}
                className="h-12 text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-[0.5em]"
              />
            )}
          </Field>
          <Button type="submit" variant="primary" size="lg" block disabled={!!busy || code.length !== 6 || expired}>
            {busy === "finish" ? "Signing you in…" : busy === "verify" ? "Checking…" : signup ? "Create account" : "Sign in"}
          </Button>
          <div className="flex items-center justify-between gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() => {
                setStep("start");
                setError("");
                setNotice("");
                setCode("");
              }}
            >
              Use a different email
            </Button>
            <Button variant="ghost" size="sm" className="-mr-2" disabled={resendIn > 0 || !!busy} onClick={() => void send(email.trim())}>
              {busy === "send" ? "Sending…" : resendIn > 0 ? `Send again in ${clock(resendIn)}` : "Send a new code"}
            </Button>
          </div>
          {expired && !error && (
            <p role="status" className="m-0 text-sm text-ink-2">
              This code has expired. Send a new one.
            </p>
          )}
          <p className="m-0 text-xs text-ink-3">No email? Check spam or promotions, and make sure the address is right.</p>
        </form>
      )}
      <p role="alert" aria-live="assertive" className="m-0 text-sm text-danger empty:hidden">
        {error}
      </p>
      {step === "start" && !mode && <p className="m-0 text-xs text-ink-3">Pages already on this device stay here. Signing in doesn't change them.</p>}
    </div>
  );
}

export function SignInDialog() {
  const open = useUI((s) => s.signIn);
  return (
    <Dialog open={open} onOpenChange={(o) => ui.set({ signIn: o })} title="Sign in to Dovli" description="Use your Google account, or get a code by email. No password needed." size="sm">
      <SignInPanel onDone={() => ui.set({ signIn: false })} />
    </Dialog>
  );
}
