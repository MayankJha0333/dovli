import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayTitle, favoritePages, recentPages, searchPages, timeAgo, type Page } from "@dovli/core";
import { space, touchTarget } from "@dovli/theme";
import { Glass } from "@/components/Glass";
import { Card, IconButton, Label, usePalette } from "@/components/ui";
import { store, usePages } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pages = usePages((x) => x);
  const sync = useSyncStatus();
  const [q, setQ] = useState("");
  const open = (page: Page) => router.push({ pathname: "/page/[id]", params: { id: page.id } });

  const favorites = favoritePages(pages);
  const recent = recentPages(pages, 30);
  const hits = useMemo(() => (q.trim() ? searchPages(pages, q, 30) : []), [pages, q]);
  const list = q.trim() ? hits.map((h) => h.page) : recent;

  const row = (page: Page, i: number, hint?: string) => (
    <Pressable
      key={page.id}
      onPress={() => open(page)}
      accessibilityRole="button"
      accessibilityLabel={displayTitle(page)}
      style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }, pressed && { backgroundColor: p.hover }]}
    >
      <View style={[styles.markTile, { backgroundColor: p.accentSoft, borderRadius: p.radius.sm }]}>
        <Text style={{ fontSize: 16, color: p.accent }}>{page.mark}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: p.ink }]} numberOfLines={1}>
          {displayTitle(page)}
        </Text>
        <Text style={{ color: p.ink3, fontSize: 12.5 }} numberOfLines={1}>
          {hint ?? `${page.kind === "board" ? "Whiteboard · " : ""}${timeAgo(Math.max(page.updatedAt, page.lastOpenedAt ?? 0))}`}
        </Text>
      </View>
    </Pressable>
  );

  const syncText =
    sync.state === "synced" ? "Synced" : sync.state === "syncing" ? "Syncing…" : sync.state === "offline" ? "Offline · saved on this phone" : "Saved on this phone";

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: 140, paddingHorizontal: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Image source={require("../../../assets/images/mark.png")} style={styles.brandMark} accessibilityIgnoresInvertColors />
          <Text style={{ color: p.ink, fontWeight: "700", fontSize: 18, flex: 1 }}>Dovli</Text>
          <IconButton label="Settings" glyph="⚙︎" onPress={() => router.push("/settings")} />
        </View>
        <Text style={{ color: p.ink3, marginTop: space.lg, fontSize: 13 }}>{syncText}</Text>
        <Text style={[styles.title, { color: p.ink, fontWeight: String(p.t.fonts.displayWeight) as any }]} accessibilityRole="header">
          {greeting()}
        </Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search pages"
          placeholderTextColor={p.ink3}
          accessibilityLabel="Search pages"
          returnKeyType="search"
          style={[styles.search, { backgroundColor: p.well, color: p.ink, borderRadius: p.radius.md }]}
        />

        {!q.trim() && favorites.length > 0 && (
          <>
            <Label style={styles.section}>Favourites</Label>
            <Card>{favorites.map((f, i) => row(f, i))}</Card>
          </>
        )}

        <Label style={styles.section}>{q.trim() ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : "Recent"}</Label>
        {list.length ? (
          <Card>{list.map((pg, i) => row(pg, i, q.trim() ? hits[i]?.snippet?.text : undefined))}</Card>
        ) : (
          <Text style={{ color: p.ink3, paddingVertical: space.lg }}>{q.trim() ? "No pages match." : "No pages yet."}</Text>
        )}
      </ScrollView>

      <View style={[styles.dock, { bottom: insets.bottom + space.lg }]}>
        <Glass style={{ borderRadius: 999, padding: 6 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => open(store.createPage())}
            style={({ pressed }) => [styles.newButton, { backgroundColor: p.primary }, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ color: p.primaryInk, fontWeight: "700", fontSize: 15 }}>+  New page</Text>
          </Pressable>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm + 2 },
  brandMark: { width: 26, height: 32 },
  title: { marginTop: 2, marginBottom: space.lg, fontSize: 34, letterSpacing: -1 },
  search: { minHeight: touchTarget, paddingHorizontal: space.lg, fontSize: 16 },
  section: { marginTop: space.xl, marginBottom: space.sm },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 8 },
  markTile: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  dock: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  newButton: { minHeight: touchTarget + 4, paddingHorizontal: space.xl, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
