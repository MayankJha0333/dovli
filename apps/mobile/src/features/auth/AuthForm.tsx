// Sign in and sign up on the phone. Step 1: your email (and name, for a new account). Step 2: the
// 6-digit code we email you. The code signs this phone in to Firebase; then the app opens on its own
// (the route guard in app/_layout.tsx moves you to Home).

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { startActivityAsync } from "expo-intent-launcher";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@dovli/theme";
import { BrandMark, Button, CodeInput, Icon, MARK_GRADIENT, Title, lift, tap, usePalette, type IconName } from "@/components/ui";
import { AuthError, phoneAuth } from "@/lib/auth";
import { firebaseConfigured } from "@/lib/firebase";
import { links, openLink } from "@/lib/links";
import { GoogleButton, googleConfigured } from "./GoogleButton";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const looksLikeEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());

/** Opens the phone's email app at its inbox: Mail on iOS, the default email app on Android. */
function openMailApp() {
  const open =
    Platform.OS === "android"
      ? startActivityAsync("android.intent.action.MAIN", { category: "android.intent.category.APP_EMAIL" })
      : Linking.openURL("message://");
  open.catch(() => {});
}

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

/** Content rising in, one block after another. Replays when `key` changes (a new step). */
function useEntrance(key: string) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rise.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) rise.setValue(1);
      else Animated.timing(rise, { toValue: 1, duration: 620, useNativeDriver: true }).start();
    });
  }, [rise, key]);
  return (order: number) => {
    const from = order * 0.14;
    const range = { inputRange: [from, Math.min(1, from + 0.5)], extrapolate: "clamp" as const };
    return {
      opacity: rise.interpolate({ ...range, outputRange: [0, 1] }),
      transform: [{ translateY: rise.interpolate({ ...range, outputRange: [14, 0] }) }],
    };
  };
}

/** Whether the keyboard is up. The layout tightens while it is, so the button stays in view. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const change = (next: boolean) => (e?: { duration?: number }) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(e?.duration || 250, "keyboard", "opacity"));
      setOpen(next);
    };
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", change(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", change(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

const copy = {
  login: {
    title: "Welcome back",
    lead: "Sign in to pick up right where you left off.",
    send: "Continue with email",
    finish: "Sign in",
    switchText: "New to Dovli?",
    switchLink: "Create an account",
    switchTo: "/sign-up" as const,
  },
  signup: {
    title: "Create your account",
    lead: "Free to start. Syncs across all your devices.",
    send: "Create account",
    finish: "Create account",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchTo: "/sign-in" as const,
  },
};

/** The app icon (or the step's icon) in a crisp raised tile. */
function HeroTile({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <View style={[styles.heroTile, lift(p, 1), { backgroundColor: p.raised, borderColor: p.line }]}>{children}</View>;
}

/** A large text box without a separate label: the icon and placeholder say what goes in. */
function Field({ icon, error, label, ref, ...input }: { icon: IconName; error?: string | null; label: string; ref?: Ref<TextInputInstance> } & TextInputProps) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View
        style={[
          styles.field,
          {
            backgroundColor: focused ? p.raised : p.well,
            borderColor: error ? p.danger : focused ? p.accent : p.dark ? p.line : "transparent",
          },
        ]}
      >
        <Icon name={icon} size={19} color={error ? p.danger : focused ? p.accent : p.ink3} />
        <TextInput
          ref={ref}
          placeholderTextColor={p.ink4}
          accessibilityLabel={label}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={{ flex: 1, color: p.ink, fontSize: 16.5, paddingVertical: 14 }}
        />
      </View>
      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.errorRow}>
          <Icon name="alert-circle" size={15} color={p.danger} />
          <Text style={{ flex: 1, color: p.danger, fontSize: 13.5, lineHeight: 19 }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

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
  const [nameError, setNameError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  // From the welcome screen: Google found an account that signs in with a code (see below).
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const resendIn = useCountdown(resendAt);
  const expiresIn = useCountdown(expiresAt);
  const expired = step === "code" && expiresAt > 0 && expiresIn === 0;
  const enter = useEntrance(step);
  const keyboard = useKeyboardOpen();
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const emailRef = useRef<TextInputInstance>(null);
  const nameRef = useRef<TextInputInstance>(null);

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

  // The button stays tappable and explains what's missing: a greyed-out button doesn't say why.
  function submit() {
    const missingName = signup && !name.trim();
    const badEmail = !looksLikeEmail(email);
    setNameError(missingName ? "Enter your name." : null);
    setError(badEmail ? (email.trim() ? "That doesn't look like an email address." : "Enter your email address.") : null);
    if (missingName || badEmail) {
      tap("error");
      (missingName ? nameRef : emailRef).current?.focus();
      return;
    }
    void send();
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

  // Light themes get a plain white screen, so the form reads crisply; dark themes keep their own background.
  const screen = p.dark ? p.bg : p.raised;
  const footer = (children: ReactNode) => <Animated.View style={[styles.footer, enter(2), keyboard && styles.hidden]}>{children}</Animated.View>;

  return (
    <View style={{ flex: 1, backgroundColor: screen }}>
      <LinearGradient
        pointerEvents="none"
        // Fade to the same colour at zero opacity: "transparent" is transparent black, which leaves a grey band.
        colors={[rgba(MARK_GRADIENT[0], p.dark ? 0.12 : 0.16), rgba(MARK_GRADIENT[1], p.dark ? 0.06 : 0.07), rgba(MARK_GRADIENT[1], 0)]}
        locations={[0, 0.5, 1]}
        style={styles.tint}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={step === "code" ? "Use a different email" : "Back"}
          onPress={() => {
            tap();
            back();
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, { backgroundColor: pressed ? p.hover : "transparent" }]}
        >
          <Icon name="chevron-back" size={24} color={p.ink} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          // Only scrolls when the content can't fit (a small phone, or the keyboard is up).
          scrollEnabled={contentH > viewH + 1}
          onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setContentH(h)}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.lg }}
        >
          <View style={styles.column}>
            {!firebaseConfigured ? (
              <View style={[styles.notice, { backgroundColor: p.panel, borderColor: p.line }]}>
                <Icon name="information-circle-outline" size={22} color={p.accent} />
                <Text style={{ color: p.ink2, flex: 1, lineHeight: 20 }}>
                  Accounts aren't set up in this build. Add the Firebase settings to apps/mobile/.env (see .env.example) and restart.
                </Text>
              </View>
            ) : step === "start" ? (
              <>
                <View style={keyboard ? styles.gapSmall : styles.above} />
                <Animated.View style={[styles.hero, enter(0)]}>
                  {!keyboard && (
                    <HeroTile>
                      <BrandMark size={40} />
                    </HeroTile>
                  )}
                  <Title size={28} style={styles.heroTitle}>
                    {t.title}
                  </Title>
                  <Text style={[styles.lead, { color: p.ink3 }]}>{t.lead}</Text>
                </Animated.View>

                <Animated.View style={[styles.form, enter(1)]}>
                  {googleConfigured && (
                    <>
                      <GoogleButton label={signup ? "Sign up with Google" : "Continue with Google"} disabled={!!busy} onBusy={setGoogleBusy} onError={onGoogleError} />
                      <View style={styles.divider}>
                        <View style={[styles.rule, { backgroundColor: p.line }]} />
                        <Text style={{ color: p.ink4, fontSize: 13, fontWeight: "500" }}>or</Text>
                        <View style={[styles.rule, { backgroundColor: p.line }]} />
                      </View>
                    </>
                  )}
                  {signup && (
                    <Field
                      ref={nameRef}
                      label="Your name"
                      icon="person-outline"
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        if (nameError) setNameError(null);
                      }}
                      placeholder="Your name"
                      autoComplete="name"
                      textContentType="name"
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      submitBehavior="submit"
                      maxLength={80}
                      error={nameError}
                    />
                  )}
                  <Field
                    ref={emailRef}
                    label="Email"
                    icon="mail-outline"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (error) setError(null);
                    }}
                    placeholder="Email address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    error={error}
                  />
                  <Button
                    title={busy === "send" ? "Sending code…" : t.send}
                    size="lg"
                    loading={busy === "send"}
                    disabled={googleBusy}
                    onPress={submit}
                    accessibilityHint="Emails you a 6-digit code to sign in"
                  />
                  <Text style={[styles.hint, { color: p.ink4 }]}>No password needed. We'll email you a sign-in code.</Text>
                </Animated.View>

                <View style={styles.below} />

                {footer(
                  <>
                    <View style={styles.switchRow}>
                      <Text style={{ color: p.ink3, fontSize: 15 }}>{t.switchText}</Text>
                      <Pressable accessibilityRole="link" onPress={() => router.replace(t.switchTo)} hitSlop={10}>
                        <Text style={{ color: p.accent, fontSize: 15, fontWeight: "700" }}>{t.switchLink}</Text>
                      </Pressable>
                    </View>
                    <Text style={[styles.legal, { color: p.ink4 }]}>
                      {signup ? "By creating an account, you agree to our " : "Your pages are private to your account. "}
                      <Text accessibilityRole="link" onPress={() => openLink(links.privacy)} style={{ color: p.ink3, fontWeight: "600", textDecorationLine: "underline" }}>
                        Privacy Policy
                      </Text>
                      {signup ? "." : ""}
                    </Text>
                  </>,
                )}
              </>
            ) : (
              <>
                <View style={keyboard ? styles.gapSmall : styles.above} />
                <Animated.View style={[styles.hero, enter(0)]}>
                  {!keyboard && (
                    <HeroTile>
                      <Icon name="mail-unread-outline" size={30} color={p.accent} />
                    </HeroTile>
                  )}
                  <Title size={28} style={styles.heroTitle}>
                    Check your inbox
                  </Title>
                  <Text style={[styles.lead, { color: p.ink3 }]}>Enter the 6-digit code we sent to</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${email.trim().toLowerCase()}. Change email`}
                    onPress={back}
                    hitSlop={6}
                    style={({ pressed }) => [styles.emailChip, { backgroundColor: p.well, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: p.ink, fontSize: 15, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
                      {email.trim().toLowerCase()}
                    </Text>
                    <Icon name="pencil" size={13} color={p.accent} />
                  </Pressable>
                </Animated.View>

                {notice ? (
                  <Animated.View style={[styles.notice, { backgroundColor: p.accentSoft, borderColor: "transparent", marginTop: space.lg, padding: space.md }, enter(1)]}>
                    <Icon name="link-outline" size={18} color={p.accent} />
                    <Text style={{ color: p.ink, flex: 1, lineHeight: 20, fontSize: 14 }}>{notice}</Text>
                  </Animated.View>
                ) : null}

                <Animated.View style={[styles.form, enter(1)]}>
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
                    <View accessibilityLiveRegion="polite" style={[styles.errorRow, { justifyContent: "center", marginTop: 0 }]}>
                      <Icon name="alert-circle" size={15} color={p.danger} />
                      <Text style={{ color: p.danger, fontSize: 13.5, lineHeight: 19, flexShrink: 1 }}>{error}</Text>
                    </View>
                  ) : (
                    <Text accessibilityLiveRegion="polite" style={{ color: expired ? p.danger : p.ink3, fontSize: 13.5, textAlign: "center" }}>
                      {expired ? "This code has expired. Send a new one below." : expiresAt > 0 ? `Code expires in ${clock(expiresIn)}` : " "}
                    </Text>
                  )}
                  <Button
                    title={busy === "verify" ? "Signing you in…" : t.finish}
                    size="lg"
                    loading={busy === "verify"}
                    disabled={code.length !== 6 || expired}
                    onPress={() => void verify(code)}
                  />
                  {Platform.OS !== "web" && <Button title="Open email app" tone="secondary" icon="mail-outline" onPress={openMailApp} />}
                </Animated.View>

                <View style={styles.below} />

                <Animated.View style={[styles.footer, enter(2)]}>
                  <View style={styles.switchRow}>
                    <Text style={{ color: p.ink3, fontSize: 15 }}>Didn't get it?</Text>
                    {resendIn > 0 ? (
                      <Text style={{ color: p.ink3, fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}>Resend in {clock(resendIn)}</Text>
                    ) : (
                      <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void send()} hitSlop={10}>
                        <Text style={{ color: p.accent, fontSize: 15, fontWeight: "700", opacity: busy ? 0.5 : 1 }}>Send a new code</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={[styles.legal, { color: p.ink4 }]}>Check spam or promotions if it isn't in your inbox.</Text>
                </Animated.View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  tint: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  topBar: { paddingHorizontal: space.sm, paddingBottom: space.xs },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  // One readable column, also on tablets.
  column: { flex: 1, width: "100%", maxWidth: 440, alignSelf: "center" },
  // Space above and below the content: it sits a little above the middle, and both give way to the keyboard.
  above: { flexGrow: 2, minHeight: space.md },
  below: { flexGrow: 3, minHeight: space.xl },
  gapSmall: { height: space.sm },
  hidden: { display: "none" },
  hero: { alignItems: "center" },
  heroTile: { width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, marginBottom: space.lg },
  heroTitle: { textAlign: "center" },
  lead: { textAlign: "center", fontSize: 15.5, lineHeight: 22, marginTop: space.sm, maxWidth: 320 },
  emailChip: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.md, paddingHorizontal: 14, height: 36, borderRadius: 18, maxWidth: "100%" },
  form: { marginTop: space.xxl, gap: space.md },
  field: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: space.lg, borderRadius: 16, borderWidth: 1.5 },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8, paddingHorizontal: 2 },
  divider: { flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: 2 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  hint: { fontSize: 12.5, textAlign: "center" },
  footer: { alignItems: "center", gap: space.sm },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  legal: { fontSize: 12, lineHeight: 17, textAlign: "center", paddingHorizontal: space.md },
  notice: { flexDirection: "row", gap: 12, padding: space.lg, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
});
