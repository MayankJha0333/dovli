// Your account: name, email, sync, sign out and delete. Confirmations happen right on the page (a
// card opens under the button), not in pop-ups.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { Avatar, Button, Card, Header, Icon, Row, Section, T, TextField, tap, usePalette } from "@/components/ui";
import { phoneAuth, usePhoneAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { store } from "@/lib/store";
import { syncNow } from "@/lib/sync";
import { useSyncLine } from "@/features/settings/SettingsScreen";

/** A card that opens under a button to confirm it: a line of text and two buttons. */
function Confirm({ text, action, danger, busy, error, onCancel, onConfirm }: { text: ReactNode; action: string; danger?: boolean; busy?: boolean; error?: string | null; onCancel: () => void; onConfirm: () => void }) {
  const p = usePalette();
  return (
    <View style={[styles.confirm, { backgroundColor: danger ? p.dangerSoft : p.well }]}>
      <Text style={{ color: p.ink, fontSize: 14.5, lineHeight: 20 }}>{text}</Text>
      {error ? <Text style={{ color: p.danger, fontSize: 13, marginTop: space.sm }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
        <Button title="Cancel" tone="secondary" onPress={onCancel} style={{ flex: 1 }} disabled={busy} />
        <Button title={action} tone={danger ? "danger" : "primary"} loading={busy} onPress={onConfirm} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const a = usePhoneAuth();
  const sync = useSyncLine();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [ask, setAsk] = useState<"sign-out" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  // A confirmation opens at the bottom: bring it into view.
  useEffect(() => {
    if (ask) setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
  }, [ask]);

  const account = a.account;
  if (a.status !== "signed-in" || !account) {
    return (
      <View style={{ flex: 1 }}>
        <Background intensity={0.5} />
        <Header top={insets.top} title="Account" onBack={() => router.back()} />
      </View>
    );
  }

  const saveName = async () => {
    setSaving(true);
    setNameError(null);
    try {
      await phoneAuth.updateName(name);
      tap("success");
      setEditing(false);
    } catch {
      setNameError("Couldn't save your name. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    await phoneAuth.signOut();
    // Signed out, the app goes back to the welcome screen by itself.
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/delete", { method: "POST", timeoutMs: 60_000 });
      // The account and its pages are gone from the cloud: clear this phone's copy too.
      store.resetForAccount();
      tap("success");
      await phoneAuth.signOut();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const since = account.createdAt ? new Date(account.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.6} />
      <Header top={insets.top} title="Account" onBack={() => router.back()} />
      <ScrollView ref={scroller} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginTop: space.md }}>
          <Avatar name={account.name} email={account.email} size={84} />
          <T v="title" style={{ marginTop: space.md, textAlign: "center" }} numberOfLines={1}>
            {account.name || account.email?.split("@")[0] || "Your account"}
          </T>
          <T v="subhead" tone="ink3" style={{ marginTop: 2 }}>
            {account.email ?? ""}
          </T>
        </View>

        <Section title="Profile">
          {editing ? (
            <View style={{ padding: space.lg, gap: space.md }}>
              <TextField label="Your name" icon="person-outline" value={name} onChangeText={setName} autoFocus autoCapitalize="words" maxLength={80} returnKeyType="done" onSubmitEditing={() => void saveName()} error={nameError} />
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button title="Cancel" tone="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} />
                <Button title="Save" loading={saving} disabled={!name.trim()} onPress={() => void saveName()} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <Row
              icon="person-outline"
              title="Name"
              value={account.name || "Add your name"}
              onPress={() => {
                setName(account.name ?? "");
                setNameError(null);
                setEditing(true);
              }}
            />
          )}
          <Row icon="mail-outline" title="Email" value={account.email ?? ""} />
          {since ? <Row icon="calendar-outline" title="Member since" value={since} /> : null}
        </Section>

        <Section title="Sync" footer="Your pages live in your Dovli account. This phone keeps a copy, so they open instantly and keep working offline.">
          <Row
            icon={sync.tone === "warn" ? "alert-circle-outline" : sync.tone === "muted" ? "cloud-offline-outline" : "cloud-done-outline"}
            tint={sync.tone === "ok" ? p.ok : sync.tone === "warn" ? p.warn : p.accent}
            title={sync.title}
            detail={sync.detail ? sync.detail[0].toUpperCase() + sync.detail.slice(1) : undefined}
            right={
              <Button
                title="Sync now"
                tone="ghost"
                onPress={() => {
                  tap();
                  syncNow();
                }}
                style={{ minHeight: 34, paddingHorizontal: 10 }}
              />
            }
          />
        </Section>

        <Card style={{ marginTop: space.xl }}>
          <Row icon="log-out-outline" title="Sign out" chevron={false} onPress={() => setAsk(ask === "sign-out" ? null : "sign-out")} />
        </Card>
        {ask === "sign-out" && (
          <Confirm
            text="Sign out of Dovli on this phone? Your pages stay in your account, ready when you sign in again."
            action="Sign out"
            busy={busy}
            onCancel={() => setAsk(null)}
            onConfirm={() => void signOut()}
          />
        )}

        <Card style={{ marginTop: space.md }}>
          <Row icon="trash-bin-outline" title="Delete account" destructive chevron={false} onPress={() => setAsk(ask === "delete" ? null : "delete")} />
        </Card>
        {ask === "delete" && (
          <Confirm
            danger
            text={
              <>
                <Text style={{ fontWeight: "700" }}>This deletes your account and every page in it, </Text>
                on all your devices. It can't be undone. Export your pages first if you want a copy.
              </>
            }
            action="Delete for good"
            busy={busy}
            error={error}
            onCancel={() => setAsk(null)}
            onConfirm={() => void deleteAccount()}
          />
        )}
        {ask === "delete" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.sm, marginLeft: space.xs }}>
            <Icon name="folder-open-outline" size={14} color={p.accent} />
            <T v="footnote" tone="accent" onPress={() => router.push("/data")} style={{ fontWeight: "600" }}>
              Export my pages first
            </T>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  confirm: { marginTop: space.sm, borderRadius: 16, padding: space.lg },
});
