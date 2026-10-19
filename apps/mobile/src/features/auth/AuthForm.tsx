// Sign in and sign up on the phone. Step 1: your email (and name, for a new account). Step 2: the
// 6-digit code we email you. The code signs this phone in to Firebase; then the app opens on its own
// (the route guard in app/_layout.tsx moves you to Home).

import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@dovli/theme";
import { Badge, Button, CodeInput, Header, Icon, TextField, Title, tap, usePalette } from "@/components/ui";
import { AuthError, phoneAuth } from "@/lib/auth";
import { firebaseConfigured } from "@/lib/firebase";
import { Backdrop } from "./Backdrop";
import { GoogleButton, googleConfigured } from "./GoogleButton";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const looksLikeEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());

/** Seconds left until a moment, ticking once a second. */
function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

const copy = {
  login: {
    badge: "No password needed",
    badgeIcon: "lock-closed" as const,
    title: "Welcome back",
    lead: "Enter your email and we'll send you a 6-digit code to sign in.",
    send: "Email me a code",
    finish: "Sign in",
    switchText: "New to Dovli?",
    switchLink: "Create an account",
    switchTo: "/sign-up" as const,
  },
  signup: {
    badge: "Free to start",
    badgeIcon: "sparkles" as const,
    title: "Create your account",
    lead: "Your pages sync across all your devices. No password to remember.",
    send: "Continue",
    finish: "Create account",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchTo: "/sign-in" as const,
  },
};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const t = copy[mode];
  const signup = mode === "signup";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();

  const [step, setStep] = useState<"start" | "code">("start");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "send" | "verify">("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  // From the welcome screen: Google found an account that signs in with a code (see below).
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const resendIn = useCountdown(resendAt);
  const expiresIn = useCountdown(expiresAt);
  const expired = step === "code" && expiresAt > 0 && expiresIn === 0;

  const back = () => {
    if (step === "code") {
      setStep("start");
      setError(null);
      setNotice(null);
      setCode("");
    } else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  async function send(to = email) {
    if (busy) return;
    setError(null);
    setBusy("send");
    try {
      const r = await phoneAuth.sendEmailCode(to);
      setStep("code");
      setCode("");
      setResendAt(Date.now() + r.resendAfter * 1000);
      setExpiresAt(Date.now() + r.expiresIn * 1000);
    } catch (e) {
      // Asked again too soon: still show the code step, and when a resend is possible.
      if (e instanceof AuthError && e.code === "wait" && e.extra.retryAfter) {
        setStep("code");
        setResendAt(Date.now() + e.extra.retryAfter * 1000);
      }
      setError(errorText(e));
      tap("error");
    } finally {
      setBusy("");
    }
  }

  async function verify(value: string) {
    if (busy || value.length !== 6) return;
    setError(null);
    setBusy("verify");
    try {
      await phoneAuth.verifyEmailCode(email, value, signup ? name : undefined);
      tap("success");
      // The route guard takes it from here.
    } catch (e) {
      setError(errorText(e));
      tap("error");
      if (e instanceof AuthError && (e.code === "expired" || e.code === "locked")) {
        setExpiresAt(0);
        setResendAt(0);
      }
      setCode("");
      setBusy("");
    }
  }

  /** Google sign-in found an account for this email that signs in with a code: confirm it, then Google is added. */
  function onGoogleError(e: AuthError) {
    if (e.code === "link-needed" && e.extra.email) {
      setEmail(e.extra.email);
      setNotice(e.message);
      void send(e.extra.email);
    } else setError(e.message);
  }

  useEffect(() => {
    if (!params.email) return;
    setEmail(params.email);
    if (params.notice) setNotice(params.notice);
    void send(params.email);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canSend = looksLikeEmail(email) && (!signup || name.trim().length > 0);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop height={380} />
      <Header top={insets.top} onBack={back} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: insets.bottom + space.xl }}
        >
          {!firebaseConfigured ? (
            <View style={[styles.notice, { backgroundColor: p.panel, borderColor: p.line }]}>
              <Icon name="information-circle-outline" size={22} color={p.accent} />
              <Text style={{ color: p.ink2, flex: 1, lineHeight: 20 }}>
                Accounts aren't set up in this build. Add the Firebase settings to apps/mobile/.env (see .env.example) and restart.
              </Text>
            </View>
          ) : step === "start" ? (
            <>
              <Badge text={t.badge} icon={t.badgeIcon} />
              <Title style={{ marginTop: space.md }}>{t.title}</Title>
              <Text style={{ color: p.ink2, fontSize: 16, lineHeight: 23, marginTop: space.sm }}>{t.lead}</Text>

              <View style={{ gap: space.lg, marginTop: space.xl }}>
                {googleConfigured && (
                  <>
                    <GoogleButton label={signup ? "Sign up with Google" : "Continue with Google"} disabled={!!busy} onBusy={setGoogleBusy} onError={onGoogleError} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: p.lineStrong }} />
                      <Text style={{ color: p.ink3, fontSize: 13 }}>or with email</Text>
                      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: p.lineStrong }} />
                    </View>
                  </>
                )}
                {signup && (
                  <TextField
                    label="Your name"
                    icon="person-outline"
                    value={name}
                    onChangeText={setName}
                    placeholder="First and last name"
                    autoComplete="name"
                    textContentType="name"
                    autoCapitalize="words"
                    returnKeyType="next"
                    maxLength={80}
                    autoFocus={!googleConfigured}
                  />
                )}
                <TextField
                  label="Email"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => canSend && void send()}
                  autoFocus={!signup && !googleConfigured}
                  error={error}
                />
                <Button title={busy === "send" ? "Sending code…" : t.send} size="lg" loading={busy === "send"} disabled={!canSend || googleBusy} onPress={() => void send()} />
              </View>

              <View style={{ flex: 1, minHeight: space.xl }} />

              <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: space.xl }}>
                <Text style={{ color: p.ink2, fontSize: 14.5 }}>{t.switchText}</Text>
                <Pressable accessibilityRole="link" onPress={() => router.replace(t.switchTo)} hitSlop={8}>
                  <Text style={{ color: p.accent, fontSize: 14.5, fontWeight: "700" }}>{t.switchLink}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, marginTop: space.md }}>
                <Icon name="shield-checkmark-outline" size={13} color={p.ink3} />
                <Text style={{ color: p.ink3, fontSize: 12.5 }}>Your pages are private to your account.</Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.mailTile, { backgroundColor: p.accentSoft }]}>
                <Icon name="mail-open-outline" size={28} color={p.accent} />
              </View>
              <Title style={{ marginTop: space.lg }}>Check your email</Title>
              {notice ? (
                <View style={[styles.notice, { backgroundColor: p.accentSoft, borderColor: "transparent", marginTop: space.md, padding: space.md }]}>
                  <Icon name="link-outline" size={18} color={p.accent} />
                  <Text style={{ color: p.ink, flex: 1, lineHeight: 20, fontSize: 14 }}>{notice}</Text>
                </View>
              ) : null}
              <Text style={{ color: p.ink2, fontSize: 16, lineHeight: 23, marginTop: space.sm }}>
                We sent a 6-digit code to <Text style={{ color: p.ink, fontWeight: "700" }}>{email.trim().toLowerCase()}</Text>.
                {expiresAt > 0 && !expired ? <Text style={{ color: p.ink3 }}>{` It works for ${clock(expiresIn)}.`}</Text> : null}
              </Text>

              <View style={{ marginTop: space.xl }}>
                <CodeInput
                  value={code}
                  disabled={busy === "verify"}
                  error={!!error}
                  onChange={(v) => {
                    setCode(v);
                    if (error) setError(null);
                    if (v.length === 6) void verify(v);
                  }}
                />
                {error ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: p.danger, fontSize: 13.5, marginTop: space.md }}>
                    {error}
                  </Text>
                ) : expired ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: p.ink2, fontSize: 13.5, marginTop: space.md }}>
                    This code has expired. Send a new one.
                  </Text>
                ) : null}
              </View>

              <Button
                title={busy === "verify" ? "Signing you in…" : t.finish}
                size="lg"
                loading={busy === "verify"}
                disabled={code.length !== 6 || expired}
                onPress={() => void verify(code)}
                style={{ marginTop: space.xl }}
              />

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: space.md }}>
                <Button title="Different email" tone="ghost" onPress={back} style={{ paddingHorizontal: 4 }} />
                <Button
                  title={resendIn > 0 ? `Send again in ${clock(resendIn)}` : "Send a new code"}
                  tone="ghost"
                  disabled={resendIn > 0 || !!busy}
                  onPress={() => void send()}
                  style={{ paddingHorizontal: 4 }}
                />
              </View>
              <Text style={{ color: p.ink3, fontSize: 12.5, lineHeight: 18, marginTop: space.md }}>
                No email? Check spam or promotions, and make sure the address is right.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: "row", gap: 12, padding: space.lg, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  mailTile: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
