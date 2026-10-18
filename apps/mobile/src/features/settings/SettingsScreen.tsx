import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_THEMES, SYSTEM_DARK_THEME, SYSTEM_LIGHT_THEME, getTheme, space, touchTarget, type AppTheme, type ThemePreference } from "@dovli/theme";
import { Button, Card, IconButton, Label, usePalette } from "@/components/ui";
import { themeStore, useThemePreference } from "@/lib/theme";
import { AuthError, phoneAuth, usePhoneAuth } from "@/lib/auth";

/** A small picture of a theme: its background, a card and an accent dot. */
function Swatch({ theme }: { theme: AppTheme }) {
  const c = theme.colors;
  return (
    <View style={[styles.swatch, { backgroundColor: c.bg, borderColor: c.lineStrong }]}>
      <View style={{ width: 14, alignSelf: "stretch", backgroundColor: c.sidebar === "transparent" ? c.bg : c.sidebar, opacity: 0.9 }} />
      <View style={{ flex: 1, padding: 5, gap: 3 }}>
        <View style={{ height: 4, width: "70%", borderRadius: 2, backgroundColor: c.ink }} />
        <View style={{ height: 3, width: "90%", borderRadius: 2, backgroundColor: c.ink3 }} />
        <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 2 }} />
      </View>
    </View>
  );
}

function ThemeRow({ value, title, hint, theme, selected, first }: { value: ThemePreference; title: string; hint: string; theme: AppTheme; selected: boolean; first: boolean }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${hint}`}
      onPress={() => themeStore.set(value)}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }, pressed && { backgroundColor: p.hover }]}
    >
      <Swatch theme={theme} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.ink, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        <Text style={{ color: p.ink3, fontSize: 12.5 }}>{hint}</Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? p.accent : p.ink3 }]}>{selected && <View style={[styles.radioDot, { backgroundColor: p.accent }]} />}</View>
    </Pressable>
  );
}

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
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Account() {
  const p = usePalette();
  const a = usePhoneAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "send" | "verify">("");
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const resendIn = useCountdown(resendAt);
  const expiresIn = useCountdown(expiresAt);

  if (a.status === "local-only") {
    return (
      <Card style={{ padding: space.lg }}>
        <Text style={{ color: p.ink, fontWeight: "600" }}>Saved on this phone</Text>
        <Text style={{ color: p.ink3, marginTop: 4, lineHeight: 19 }}>Sign-in isn't set up in this build of the app. Your pages stay on this phone.</Text>
      </Card>
    );
  }

  if (a.status === "signed-in") {
    return (
      <Card style={{ padding: space.lg, gap: space.md }}>
        <View>
          <Text style={{ color: p.ink, fontWeight: "600" }}>{a.account?.email}</Text>
          <Text style={{ color: p.ink3, marginTop: 2, lineHeight: 19 }}>Signed in. Pages stay saved on this phone; syncing them through your account is coming next.</Text>
        </View>
        <Button title="Sign out" tone="secondary" onPress={() => void phoneAuth.signOut()} />
      </Card>
    );
  }

  const send = async () => {
    setEmail(email.trim().toLowerCase());
    setBusy("send");
    setError(null);
    try {
      const r = await phoneAuth.sendEmailCode(email.trim());
      setSent(true);
      setCode("");
      setResendAt(Date.now() + r.resendAfter * 1000);
      setExpiresAt(Date.now() + r.expiresIn * 1000);
    } catch (e) {
      if (e instanceof AuthError && e.code === "wait" && e.extra.retryAfter) {
        setSent(true);
        setResendAt(Date.now() + e.extra.retryAfter * 1000);
      }
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  const verify = async (value: string) => {
    if (busy) return;
    setBusy("verify");
    setError(null);
    try {
      await phoneAuth.verifyEmailCode(email.trim(), value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      if (e instanceof AuthError && (e.code === "expired" || e.code === "locked")) {
        setExpiresAt(0);
        setResendAt(0);
      }
      setCode("");
    } finally {
      setBusy("");
    }
  };

  const expired = sent && expiresAt > 0 && expiresIn === 0;

  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      {!sent ? (
        <>
          <Text style={{ color: p.ink3, lineHeight: 19 }}>Sign in with a 6-digit code we email you. No password needed.</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={p.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            accessibilityLabel="Email"
            style={[styles.input, { backgroundColor: p.well, color: p.ink, borderRadius: p.radius.md }]}
          />
          <Button title={busy === "send" ? "Sending…" : "Email me a code"} disabled={!!busy || !/\S+@\S+\.\S+/.test(email)} onPress={() => void send()} />
        </>
      ) : (
        <>
          <Text style={{ color: p.ink2, lineHeight: 19 }}>
            We emailed a code to <Text style={{ color: p.ink, fontWeight: "600" }}>{email.trim()}</Text>.{expiresAt > 0 && !expired ? ` It works for ${clock(expiresIn)}.` : ""}
          </Text>
          <TextInput
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, "").slice(0, 6);
              setCode(digits);
              if (digits.length === 6) void verify(digits);
            }}
            placeholder="000000"
            placeholderTextColor={p.ink3}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            editable={busy !== "verify"}
            accessibilityLabel="6-digit code"
            style={[styles.input, { backgroundColor: p.well, color: p.ink, borderRadius: p.radius.md, letterSpacing: 8, textAlign: "center", fontSize: 22 }]}
          />
          <Button title={busy === "verify" ? "Checking…" : "Sign in"} disabled={!!busy || code.length !== 6 || expired} onPress={() => void verify(code)} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable accessibilityRole="button" onPress={() => { setSent(false); setError(null); }} style={{ paddingVertical: 8 }}>
              <Text style={{ color: p.accent }}>Use a different email</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={resendIn > 0 || !!busy} onPress={() => void send()} style={{ paddingVertical: 8 }}>
              <Text style={{ color: resendIn > 0 ? p.ink3 : p.accent }}>{resendIn > 0 ? `Send again in ${clock(resendIn)}` : "Send a new code"}</Text>
            </Pressable>
          </View>
          {expired && !error && <Text style={{ color: p.ink2 }}>This code has expired. Send a new one.</Text>}
        </>
      )}
      {error && <Text accessibilityLiveRegion="polite" style={{ color: p.danger }}>{error}</Text>}
    </Card>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pref = useThemePreference();
  const auto = getTheme(SYSTEM_LIGHT_THEME);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={{ color: p.ink, fontSize: 20, fontWeight: "700", flex: 1 }} accessibilityRole="header">
          Settings
        </Text>
        <IconButton label="Close" glyph="✕" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <Label style={styles.section}>Theme</Label>
        <Card accessibilityRole="radiogroup">
          {APP_THEMES.map((theme, i) => (
            <ThemeRow key={theme.id} value={theme.id} title={theme.name} hint={theme.description} theme={theme} selected={pref === theme.id} first={i === 0} />
          ))}
          <ThemeRow
            value="system"
            title="Match device"
            hint={`${auto.name} by day, ${getTheme(SYSTEM_DARK_THEME).name} when your phone is in dark mode`}
            theme={pref === "system" ? p.t : auto}
            selected={pref === "system"}
            first={false}
          />
        </Card>

        <Label style={styles.section}>Account and sync</Label>
        <Account />

        <Label style={styles.section}>Privacy</Label>
        <Card style={{ padding: space.lg }}>
          <Text style={{ color: p.ink3, lineHeight: 19 }}>Your pages are never used to train AI. They're stored encrypted, and you can export or delete them at any time from the web app.</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingBottom: space.sm },
  section: { marginTop: space.xl, marginBottom: space.sm },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 10 },
  swatch: { width: 52, height: 38, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", flexDirection: "row" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  input: { minHeight: touchTarget, paddingHorizontal: space.lg, fontSize: 16 },
});
