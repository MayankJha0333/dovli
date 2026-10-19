// Settings on the phone, in the same sections as the web app: your profile and account, how Dovli
// looks, sync and backups, AI, privacy and data, and about. Things only the web app can do yet open
// it in the browser.

import { useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timeAgo, trashRoots } from "@dovli/core";
import { APP_THEMES, SYSTEM_DARK_THEME, SYSTEM_LIGHT_THEME, getTheme, space, type AppTheme, type ThemePreference } from "@dovli/theme";
import { Avatar, Badge, Button, Header, Icon, Label, Row, Section, TextField, tap, usePalette, type IconName } from "@/components/ui";
import { phoneAuth, usePhoneAuth } from "@/lib/auth";
import { apiUrl } from "@/lib/firebase";
import { themeStore, useThemePreference } from "@/lib/theme";
import { syncNow, useSyncStatus } from "@/lib/sync";
import { usePages } from "@/lib/store";
import { Background } from "@/components/Background";

const openWeb = (path = "/app") => apiUrl && Linking.openURL(`${apiUrl}${path}`).catch(() => {});

/* ---------------------------------------------------------------- profile */

function Profile() {
  const router = useRouter();
  const p = usePalette();
  const a = usePhoneAuth();
  const sync = useSyncStatus();
  const signedIn = a.status === "signed-in";
  const title = signedIn ? a.account?.name || a.account?.email?.split("@")[0] || "Your account" : "Using Dovli without an account";
  const sub = signedIn ? (a.account?.email ?? "") : "Your pages are saved on this phone only.";

  return (
    <View style={[styles.profile, { backgroundColor: p.panel, borderColor: p.line, borderWidth: p.dark ? StyleSheet.hairlineWidth : 0 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        {signedIn ? (
          <Avatar name={a.account?.name} email={a.account?.email} size={56} />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.well, alignItems: "center", justifyContent: "center" }}>
            <Icon name="phone-portrait-outline" size={26} color={p.ink3} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.ink, fontSize: 19, fontWeight: "700", letterSpacing: -0.3 }} numberOfLines={1}>
            {title}
          </Text>
          <Text style={{ color: p.ink3, fontSize: 13.5, marginTop: 2 }} numberOfLines={2}>
            {sub}
          </Text>
          {signedIn && (
            <View style={{ marginTop: 8 }}>
              {sync.state === "synced" ? (
                <Badge text="Synced" icon="cloud-done-outline" tone="ok" />
              ) : sync.state === "syncing" ? (
                <Badge text="Syncing…" icon="sync-outline" tone="accent" />
              ) : sync.state === "offline" ? (
                <Badge text="Offline" icon="cloud-offline-outline" tone="muted" />
              ) : sync.state === "error" ? (
                <Badge text="Sync paused" icon="alert-circle-outline" tone="warn" />
              ) : null}
            </View>
          )}
        </View>
      </View>
      {a.status === "signed-out" && (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Text style={{ color: p.ink2, fontSize: 14, lineHeight: 20 }}>Sign in to back up your pages and see them on the web and your other devices.</Text>
          <Button title="Sign in or create account" icon="person-circle-outline" onPress={() => router.push("/sign-in")} />
        </View>
      )}
    </View>
  );
}

/* ---------------------------------------------------------------- account */

function Account() {
  const p = usePalette();
  const a = usePhoneAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  if (a.status !== "signed-in" || !a.account) return null;

  const save = async () => {
    setSaving(true);
    try {
      await phoneAuth.updateName(name);
      tap("success");
      setEditing(false);
    } catch {
      Alert.alert("Couldn't save your name", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Account">
      {editing ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <TextField label="Your name" icon="person-outline" value={name} onChangeText={setName} autoFocus autoCapitalize="words" maxLength={80} returnKeyType="done" onSubmitEditing={() => void save()} />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button title="Cancel" tone="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            <Button title="Save" loading={saving} disabled={!name.trim()} onPress={() => void save()} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Row
          icon="person-outline"
          title="Name"
          value={a.account.name || "Add your name"}
          onPress={() => {
            setName(a.account?.name ?? "");
            setEditing(true);
          }}
        />
      )}
      <Row icon="mail-outline" title="Email" value={a.account.email ?? ""} />
      {a.account.createdAt ? (
        <Row icon="calendar-outline" title="Member since" value={new Date(a.account.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })} />
      ) : null}
    </Section>
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

/* ---------------------------------------------------------------- sync */

function Sync() {
  const router = useRouter();
  const p = usePalette();
  const a = usePhoneAuth();
  const s = useSyncStatus();
  if (a.status !== "signed-in") {
    return (
      <Section title="Sync & backups" footer="Your pages are saved on this phone the moment you type, and work offline.">
        <Row
          icon="cloud-upload-outline"
          title="Back up and sync"
          detail={a.status === "local-only" ? "Accounts aren't set up in this build of the app." : "Sign in to keep your pages in the cloud and on the web."}
          onPress={a.status === "signed-out" ? () => router.push("/sign-in") : undefined}
        />
      </Section>
    );
  }
  const meta: Record<string, { icon: IconName; tint: string; title: string }> = {
    synced: { icon: "cloud-done-outline", tint: p.ok, title: "Up to date" },
    syncing: { icon: "sync-outline", tint: p.accent, title: "Syncing…" },
    offline: { icon: "cloud-offline-outline", tint: p.ink3, title: "Offline" },
    error: { icon: "alert-circle-outline", tint: p.warn, title: "Sync paused" },
  };
  const m = meta[s.state] ?? { icon: "cloud-outline" as IconName, tint: p.accent, title: "Getting ready" };
  const detail = s.state === "error" && s.error ? s.error : s.lastSyncedAt ? `Last synced ${timeAgo(s.lastSyncedAt)}` : "Not synced yet";
  return (
    <Section title="Sync & backups" footer="Pages are saved on this phone first, then sent to your account. Edits made offline sync when you're back online.">
      <Row icon={m.icon} tint={m.tint} title={m.title} detail={detail} />
      {s.pending > 0 ? <Row icon="time-outline" title="Waiting to sync" value={`${s.pending} ${s.pending === 1 ? "change" : "changes"}`} /> : null}
      <Row icon="refresh-outline" title="Sync now" onPress={() => syncNow()} chevron={false} />
    </Section>
  );
}

/* ---------------------------------------------------------------- the rest */

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const a = usePhoneAuth();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const trashed = usePages((x) => trashRoots(x).length);

  const signOut = () =>
    Alert.alert("Sign out of Dovli?", "Your pages stay in your account. You can sign in again any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () =>
          setTimeout(() => {
            void phoneAuth.signOut();
            router.back();
          }, 0),
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.6} />
      {/* On iOS, Settings opens as a sheet below the status bar, so it needs no room for it. */}
      <Header top={Platform.OS === "ios" ? space.sm : insets.top} title="Settings" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.xxxl }}>
        <Profile />
        <Account />
        <Appearance />
        <Sync />

        <Section title="AI" footer="Pick your AI (Dovli AI, or your own Groq, OpenRouter, Anthropic or OpenAI key) in Settings on the web. Your choice applies to your account.">
          <Row icon="sparkles-outline" title="Assistant and Ask AI" detail="On the web app now, coming to the phone next." onPress={apiUrl ? () => openWeb() : undefined} />
        </Section>

        <Section title="Privacy & data">
          <Row icon="shield-checkmark-outline" title="Never used to train AI" detail="Your pages are private to your account and stored encrypted." />
          {a.status === "signed-in" && <Row icon="download-outline" title="Export or delete your data" detail="Opens Dovli on the web" onPress={apiUrl ? () => openWeb() : undefined} />}
        </Section>

        <Section title="Your pages">
          <Row icon="grid-outline" title="Templates" detail="Meeting notes, project briefs, journals and more" onPress={() => router.push("/templates")} />
          <Row icon="trash-outline" title="Trash" value={trashed ? String(trashed) : "Empty"} onPress={() => router.push("/trash")} />
        </Section>

        <Section title="About">
          <Row icon="information-circle-outline" title="About Dovli" value={`Version ${version}`} onPress={() => router.push("/about")} />
          {apiUrl ? <Row icon="globe-outline" title="Dovli on the web" detail="Whiteboards, AI and more" onPress={() => openWeb("/")} /> : null}
        </Section>

        {a.status === "signed-in" && (
          <Section>
            <Row icon="log-out-outline" title="Sign out" destructive onPress={signOut} chevron={false} />
          </Section>
        )}

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
