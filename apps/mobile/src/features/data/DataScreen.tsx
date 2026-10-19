// Your data: what's in your Dovli, and taking it out: a Dovli backup (imports on the web) or every
// page as Markdown. Deleting your account lives on the Account page.

import { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { Card, Header, Icon, Row, Section, T, tap, usePalette, type IconName } from "@/components/ui";
import { usePhoneAuth } from "@/lib/auth";
import { usePages } from "@/lib/store";
import { shareBackup, shareMarkdownZip } from "@/lib/export";

function Stat({ icon, value, label, tint }: { icon: IconName; value: number; label: string; tint: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: space.lg }}>
      <View style={[styles.statIcon, { backgroundColor: `${tint}22` }]}>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <Text style={{ color: p.ink, fontSize: 22, fontWeight: "800", marginTop: 8, fontVariant: ["tabular-nums"] }}>{value.toLocaleString()}</Text>
      <Text style={{ color: p.ink3, fontSize: 12.5, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

export function DataScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const a = usePhoneAuth();
  const counts = usePages((x) => {
    const live = Object.values(x).filter((pg) => !pg.deletedAt);
    return `${live.filter((pg) => pg.kind === "doc").length}|${live.filter((pg) => pg.kind === "board").length}|${Object.values(x).length - live.length}`;
  });
  const [docs, boards, trashed] = counts.split("|").map(Number);
  const [busy, setBusy] = useState<"backup" | "markdown" | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  const run = async (kind: "backup" | "markdown") => {
    setBusy(kind);
    setNote(null);
    try {
      const shared = kind === "backup" ? await shareBackup() : await shareMarkdownZip();
      if (shared) {
        tap("success");
        setNote({ text: kind === "backup" ? "Backup ready. To restore it, use Settings → Import & export in Dovli on a computer." : "Your pages are in the .zip, one Markdown file each.", ok: true });
      }
    } catch {
      setNote({ text: "Couldn't make the file. Please try again.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.6} />
      <Header top={insets.top} title="Your data" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxxl }}>
        <Card style={{ marginTop: space.md }}>
          <View style={{ flexDirection: "row" }}>
            <Stat icon="document-text-outline" value={docs} label={docs === 1 ? "Page" : "Pages"} tint="#5146D9" />
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: p.line, marginVertical: space.md }} />
            <Stat icon="easel-outline" value={boards} label={boards === 1 ? "Whiteboard" : "Whiteboards"} tint="#F59E0B" />
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: p.line, marginVertical: space.md }} />
            <Stat icon="trash-outline" value={trashed} label="In trash" tint="#64748B" />
          </View>
        </Card>
        <T v="footnote" tone="ink3" style={{ marginTop: space.sm, marginHorizontal: space.xs }}>
          {a.status === "signed-in" ? "Private to your account. Dovli never uses your pages to train AI." : "Saved on this phone only. Sign in to keep them in your account."}
        </T>

        <Section title="Export">
          <Row
            icon="archive-outline"
            title="Dovli backup"
            detail="One .json file with everything, to restore any time."
            right={busy === "backup" ? <ActivityIndicator color={p.accent} /> : <Icon name={Platform.OS === "android" ? "download-outline" : "share-outline"} size={18} color={p.accent} />}
            onPress={busy ? undefined : () => void run("backup")}
          />
          <Row
            icon="logo-markdown"
            title="Markdown files"
            detail="A .zip with one file per page, in folders like your page tree."
            right={busy === "markdown" ? <ActivityIndicator color={p.accent} /> : <Icon name={Platform.OS === "android" ? "download-outline" : "share-outline"} size={18} color={p.accent} />}
            onPress={busy ? undefined : () => void run("markdown")}
          />
        </Section>
        {note ? (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: space.sm, marginHorizontal: space.xs }}>
            <Icon name={note.ok ? "checkmark-circle" : "alert-circle"} size={16} color={note.ok ? p.ok : p.danger} />
            <T v="footnote" style={{ color: note.ok ? p.ink2 : p.danger, flex: 1 }}>
              {note.text}
            </T>
          </View>
        ) : (
          <T v="footnote" tone="ink3" style={{ marginTop: space.sm, marginHorizontal: space.xs }}>
            {Platform.OS === "android" ? "Pick a folder, like Downloads or Drive, and the file is saved there." : "Save to Files, AirDrop it, or send it anywhere from the share sheet."}
          </T>
        )}

        <Section title="One page">
          <Row icon="share-social-outline" title="Share a page as text" detail="Open the page, tap ⋯, then Share." />
        </Section>

        {a.status === "signed-in" && (
          <Section>
            <Row icon="person-circle-outline" title="Delete your account" detail="On the Account page" onPress={() => router.push("/account")} />
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
