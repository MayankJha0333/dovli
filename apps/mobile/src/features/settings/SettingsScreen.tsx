import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_THEMES, SYSTEM_DARK_THEME, SYSTEM_LIGHT_THEME, getTheme, space, touchTarget, type AppTheme, type ThemePreference } from "@dovli/theme";
import { Button, Card, IconButton, Label, usePalette } from "@/components/ui";
import { themeStore, useThemePreference } from "@/lib/theme";
import { cloudConfigured, supabase } from "@/lib/supabase";
import { syncNow, useSyncStatus } from "@/lib/sync";

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

function Account() {
  const p = usePalette();
  const sync = useSyncStatus();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => setUser(data.session?.user.email ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!cloudConfigured) {
    return (
      <Card style={{ padding: space.lg }}>
        <Text style={{ color: p.ink, fontWeight: "600" }}>Saved on this phone</Text>
        <Text style={{ color: p.ink3, marginTop: 4, lineHeight: 19 }}>Sync isn't set up in this build of the app. Your pages stay on this phone.</Text>
      </Card>
    );
  }

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, after?: () => void) => {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error.message);
    else after?.();
  };
  const sb = supabase()!;

  if (user) {
    const label =
      sync.state === "synced" ? "Up to date" : sync.state === "syncing" ? "Syncing…" : sync.state === "offline" ? "Offline. Changes send when you're back online." : sync.state === "error" ? `Sync problem: ${sync.error ?? "try again"}` : "Waiting";
    return (
      <Card style={{ padding: space.lg, gap: space.md }}>
        <View>
          <Text style={{ color: p.ink, fontWeight: "600" }}>{user}</Text>
          <Text style={{ color: p.ink3, marginTop: 2 }}>{label}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button title="Sync now" tone="secondary" onPress={() => syncNow()} style={{ flex: 1 }} />
          <Button title="Sign out" tone="secondary" onPress={() => void sb.auth.signOut()} style={{ flex: 1 }} />
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <Text style={{ color: p.ink3, lineHeight: 19 }}>Sign in to keep your pages in step across your phone and computer. We email you a 6-digit code.</Text>
      {!sent ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={p.ink3}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            accessibilityLabel="Email"
            style={[styles.input, { backgroundColor: p.well, color: p.ink, borderRadius: p.radius.md }]}
          />
          <Button
            title={busy ? "Sending…" : "Email me a code"}
            disabled={busy || !email.includes("@")}
            onPress={() => run(() => sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }), () => setSent(true))}
          />
        </>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            placeholderTextColor={p.ink3}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            accessibilityLabel="6-digit code"
            style={[styles.input, { backgroundColor: p.well, color: p.ink, borderRadius: p.radius.md, letterSpacing: 4 }]}
          />
          <Button title={busy ? "Checking…" : "Sign in"} disabled={busy || code.length < 6} onPress={() => run(() => sb.auth.verifyOtp({ email: email.trim(), token: code, type: "email" }))} />
          <Pressable accessibilityRole="button" onPress={() => setSent(false)}>
            <Text style={{ color: p.accent, textAlign: "center", paddingVertical: 6 }}>Use a different email</Text>
          </Pressable>
        </>
      )}
      {error && <Text style={{ color: p.danger }}>{error}</Text>}
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
