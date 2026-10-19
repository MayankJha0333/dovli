// Settings on the phone: your profile (opens Account), how Dovli looks, and a short list of rows
// that each open their own page: AI, Your data, Templates, Trash and About. Everything happens in
// the app; nothing sends you to the web.

import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timeAgo, trashRoots } from "@dovli/core";
import { APP_THEMES, SYSTEM_DARK_THEME, SYSTEM_LIGHT_THEME, getTheme, space, type AppTheme, type ThemePreference } from "@dovli/theme";
import { Avatar, Button, Header, Icon, Label, Row, Section, lift, tap, usePalette } from "@/components/ui";
import { usePhoneAuth } from "@/lib/auth";
import { themeStore, useThemePreference } from "@/lib/theme";
import { useSyncStatus } from "@/lib/sync";
import { usePages } from "@/lib/store";
import { aiLabel, refreshAI, useAI } from "@/lib/ai";
import { Background } from "@/components/Background";

/* ---------------------------------------------------------------- profile */

/** One quiet line about sync: there's nothing to set up, so it's a status, not a section. */
export function useSyncLine(): { title: string; detail: string; text: string; tone: "ok" | "muted" | "warn" | "accent" } {
  const s = useSyncStatus();
  const line = (title: string, detail: string, tone: "ok" | "muted" | "warn" | "accent") => ({ title, detail, tone, text: detail ? `${title} · ${detail}` : title });
  if (s.state === "syncing") return line("Syncing…", "", "accent");
  if (s.state === "offline") return line("Offline", "changes save on this phone", "muted");
  if (s.state === "error") return line("Sync paused", s.error ?? "it tries again soon", "warn");
  if (s.pending > 0) return line(`${s.pending} ${s.pending === 1 ? "change" : "changes"} waiting`, "they sync in a moment", "muted");
  return line("Up to date", s.lastSyncedAt ? `synced ${timeAgo(s.lastSyncedAt)}` : "", "ok");
}

function Profile() {
  const router = useRouter();
  const p = usePalette();
  const a = usePhoneAuth();
  const sync = useSyncLine();
  const signedIn = a.status === "signed-in";
  const dot = sync.tone === "ok" ? p.ok : sync.tone === "warn" ? p.warn : sync.tone === "accent" ? p.accent : p.ink4;

  if (!signedIn) {
    return (
      <View style={[styles.profile, { backgroundColor: p.panel }, lift(p)]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: p.well, alignItems: "center", justifyContent: "center" }}>
            <Icon name="phone-portrait-outline" size={24} color={p.ink3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.ink, fontSize: 18, fontWeight: "700" }}>No account yet</Text>
            <Text style={{ color: p.ink3, fontSize: 13.5, marginTop: 2 }}>Your pages are on this phone only.</Text>
          </View>
        </View>
        {a.status === "signed-out" && (
          <Button title="Sign in or create account" icon="person-circle-outline" onPress={() => router.push("/sign-in")} style={{ marginTop: space.lg }} />
        )}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a.account?.name || "Your account"}, ${a.account?.email ?? ""}. ${sync.text}. Open account`}
      onPress={() => {
        tap("select");
        router.push("/account");
      }}
      style={({ pressed }) => [styles.profile, { backgroundColor: p.panel, transform: [{ scale: pressed ? 0.985 : 1 }] }, lift(p)]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Avatar name={a.account?.name} email={a.account?.email} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.ink, fontSize: 19, fontWeight: "700", letterSpacing: -0.3 }} numberOfLines={1}>
            {a.account?.name || a.account?.email?.split("@")[0] || "Your account"}
          </Text>
          <Text style={{ color: p.ink3, fontSize: 13.5, marginTop: 1 }} numberOfLines={1}>
            {a.account?.email ?? ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
            <Text style={{ color: p.ink3, fontSize: 12.5, fontWeight: "500" }}>{sync.text}</Text>
          </View>
        </View>
        <Icon name="chevron-forward" size={18} color={p.ink4} />
      </View>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- appearance */

/** A tiny picture of the app in a theme: sidebar, a page card with lines, and the accent. */
function ThemeThumb({ theme }: { theme: AppTheme }) {
  const c = theme.colors;
  const solid = (x: string) => (x === "transparent" ? c.bg : x);
  return (
    <View style={{ height: 74, borderRadius: 10, backgroundColor: c.bg, overflow: "hidden", flexDirection: "row", padding: 6, gap: 5 }}>
      <View style={{ width: 18, borderRadius: 5, backgroundColor: solid(c.sidebar), gap: 3, padding: 3 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ height: 3, borderRadius: 2, backgroundColor: c.ink4, opacity: 0.6 }} />
        ))}
      </View>
      <View style={{ flex: 1, borderRadius: 6, backgroundColor: solid(c.panel), padding: 7, gap: 4 }}>
        <View style={{ height: 5, width: "62%", borderRadius: 3, backgroundColor: c.ink }} />
        <View style={{ height: 3, width: "90%", borderRadius: 2, backgroundColor: c.ink3 }} />
        <View style={{ height: 3, width: "76%", borderRadius: 2, backgroundColor: c.ink3 }} />
        <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
          <View style={{ height: 9, width: 22, borderRadius: 5, backgroundColor: c.primary }} />
          <View style={{ height: 9, width: 9, borderRadius: 5, backgroundColor: c.accent }} />
        </View>
      </View>
    </View>
  );
}

function ThemeCard({ value, theme, title, hint, selected }: { value: ThemePreference; theme: AppTheme; title: string; hint: string; selected: boolean }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${hint}`}
      onPress={() => {
        tap("select");
        themeStore.set(value);
      }}
      style={({ pressed }) => [
        styles.themeCard,
        { backgroundColor: p.panel, borderColor: selected ? p.accent : p.line, borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <ThemeThumb theme={theme} />
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 }}>
        <Text style={{ color: p.ink, fontSize: 14, fontWeight: "700", flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
        {selected && <Icon name="checkmark-circle" size={18} color={p.accent} />}
      </View>
      <Text style={{ color: p.ink3, fontSize: 11.5, lineHeight: 15, marginTop: 2 }} numberOfLines={2}>
        {hint}
      </Text>
    </Pressable>
  );
}

function Appearance() {
  const p = usePalette();
  const pref = useThemePreference();
  const light = getTheme(SYSTEM_LIGHT_THEME);
  const dark = getTheme(SYSTEM_DARK_THEME);
  return (
    <View style={{ marginTop: space.xl }}>
      <Label style={{ marginBottom: space.sm, marginLeft: space.xs }}>Appearance</Label>
      <View accessibilityRole="radiogroup" style={styles.themeGrid}>
        {APP_THEMES.map((theme) => (
          <ThemeCard key={theme.id} value={theme.id} theme={theme} title={theme.name} hint={theme.description} selected={pref === theme.id} />
        ))}
      </View>
      <Section style={{ marginTop: space.md }}>
        <Row
          icon="contrast-outline"
          title="Match device"
          detail={`${light.name} by day, ${dark.name} when your phone is in dark mode`}
          right={pref === "system" ? <Icon name="checkmark-circle" size={20} color={p.accent} /> : <View style={[styles.radio, { borderColor: p.ink4 }]} />}
          onPress={() => themeStore.set("system")}
        />
      </Section>
    </View>
  );
}

/* ---------------------------------------------------------------- the page */

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const a = usePhoneAuth();
  const ai = useAI();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const trashed = usePages((x) => trashRoots(x).length);
  const signedIn = a.status === "signed-in";

  useEffect(() => {
    if (signedIn) void refreshAI();
  }, [signedIn]);

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.6} />
      <Header top={insets.top} title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.xxxl }}>
        <Profile />
        <Appearance />

        <Section title="Dovli">
          <Row
            icon="sparkles-outline"
            tint="#A855F7"
            title="AI"
            value={signedIn ? (ai.loaded && !ai.failed ? aiLabel(ai) : undefined) : "Needs an account"}
            onPress={() => router.push("/ai")}
          />
          <Row icon="folder-open-outline" tint="#0EA5E9" title="Your data" detail="Export your pages, or take them anywhere" onPress={() => router.push("/data")} />
        </Section>

        <Section title="Your pages">
          <Row icon="grid-outline" title="Templates" onPress={() => router.push("/templates")} />
          <Row icon="trash-outline" title="Trash" value={trashed ? String(trashed) : "Empty"} onPress={() => router.push("/trash")} />
        </Section>

        <Section>
          <Row icon="information-circle-outline" title="About Dovli" value={`Version ${version}`} onPress={() => router.push("/about")} />
        </Section>

        <Text style={{ color: p.ink4, fontSize: 12, textAlign: "center", marginTop: space.xl }}>Dovli {version} · A calm place to write, plan and sketch</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { borderRadius: 20, padding: space.lg },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  themeCard: { width: "47.5%", flexGrow: 1, borderRadius: 16, padding: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
});
