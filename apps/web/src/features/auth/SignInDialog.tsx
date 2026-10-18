import { useState } from "react";
import { Button, Dialog, Field, Icon, Input, toast } from "@dovli/ui";
import { auth } from "@/lib/auth";
import { cloudConfigured } from "@/lib/supabase";
import { ui, useUI } from "@/lib/ui";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

/** Sign in with Google, Apple, or a code sent by email. Used in the dialog and in Settings. */
export function SignInPanel({ onDone }: { onDone?: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!cloudConfigured)
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-well p-4 text-sm text-ink-2">
        <p className="m-0 font-semibold text-ink">Accounts aren't set up on this copy of Dovli</p>
        <p className="m-0">
          Your pages are saved on this device and work offline. To sync across devices, add your Supabase keys
          (<code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) and restart. The README explains the steps.
        </p>
      </div>
    );

  const oauth = async (p: "google" | "apple") => {
    setError("");
    setBusy(true);
    try {
      await auth.signInWith(p);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" block onClick={() => oauth("google")} disabled={busy} className="justify-center">
        <Icon name="google" size={18} />
        Continue with Google
      </Button>
      <Button size="lg" block onClick={() => oauth("apple")} disabled={busy}>
        <Icon name="apple" size={18} />
        Continue with Apple
      </Button>
      <div className="flex items-center gap-3 py-1 text-xs text-ink-4">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
      {!sent ? (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              await auth.sendEmailCode(email.trim());
              setSent(true);
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Email">{(p) => <Input {...p} type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Button type="submit" variant="primary" size="lg" block disabled={busy || !email.includes("@")}>
            {busy ? "Sending" : "Email me a sign-in code"}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              await auth.verifyEmailCode(email.trim(), code.trim());
              toast("Signed in. Your pages will now sync.");
              onDone?.();
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="m-0 text-sm text-ink-2">
            We sent a 6-digit code to <strong className="text-ink">{email}</strong>. Type it below, or click the link in the email.
          </p>
          <Field label="Code">
            {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} className="text-center font-mono text-lg tracking-[0.3em]" />}
          </Field>
          <Button type="submit" variant="primary" size="lg" block disabled={busy || code.length < 6}>
            {busy ? "Checking" : "Sign in"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="m-0 text-xs text-ink-3">Signing in keeps your pages in sync across devices. Pages already on this device are added to your account.</p>
    </div>
  );
}

export function SignInDialog() {
  const open = useUI((s) => s.signIn);
  return (
    <Dialog open={open} onOpenChange={(o) => ui.set({ signIn: o })} title="Sign in to Dovli" description="Sync your pages across your phone and computers." size="sm">
      <SignInPanel onDone={() => ui.set({ signIn: false })} />
    </Dialog>
  );
}

/** The second step of signing in, for accounts with an authenticator app. */
export function SecondStepDialog() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && void auth.signOut()} title="Two-step login" description="Type the 6-digit code from your authenticator app." size="sm">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await auth.verifySecondStep(code);
            toast("Signed in");
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center font-mono text-lg tracking-[0.3em]" />
        {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" size="lg" block disabled={busy || code.length !== 6}>
          {busy ? "Checking" : "Continue"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void auth.signOut()}>
          Cancel and sign out
        </Button>
      </form>
    </Dialog>
  );
}
