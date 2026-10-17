import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayTitle, timeAgo, type Page } from "@dovli/core";
import { color, font, radius, space, touchTarget } from "@dovli/theme";
import { Glass } from "@/components/Glass";
import { store, usePages } from "@/lib/store";

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pages = usePages((p) => p);
  const recent = Object.values(pages).sort((a, b) => b.updatedAt - a.updatedAt);
  const [latest, ...rest] = recent;
  const open = (page: Page) => router.push({ pathname: "/page/[id]", params: { id: page.id } });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: 140, paddingHorizontal: space.lg }}>
        <View style={styles.brandRow}>
          <View style={styles.brandTile}>
            <Text style={styles.brandLetter}>D</Text>
          </View>
          <Text style={styles.brandName}>Dovli</Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Your pages
        </Text>

        {latest && (
          <Pressable onPress={() => open(latest)} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
            <Text style={styles.heroLabel}>Continue writing</Text>
            <Text style={styles.heroTitle}>{displayTitle(latest)}</Text>
            <Text style={styles.heroMeta}>Edited {timeAgo(latest.updatedAt)}</Text>
          </Pressable>
        )}

        <Text style={styles.section}>Recent</Text>
        <View style={styles.list}>
          {rest.map((page, i) => (
            <Pressable
              key={page.id}
              onPress={() => open(page)}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
            >
              <View style={styles.markTile}>
                <Text style={styles.mark}>{page.mark}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {displayTitle(page)}
                </Text>
                <Text style={styles.rowMeta}>
                  {page.kind === "board" ? "Board · " : ""}
                  {timeAgo(page.updatedAt)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.dock, { bottom: insets.bottom + space.lg }]}>
        <Glass style={styles.dockGlass}>
          <Pressable
            accessibilityRole="button"
            onPress={() => open(store.createPage())}
            style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
          >
            <Text style={styles.newButtonText}>+  New page</Text>
          </Pressable>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paperSubtle },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm + 2 },
  brandTile: { width: 32, height: 32, borderRadius: 10, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" },
  brandLetter: { color: color.paper, fontWeight: "800", fontSize: 16 },
  brandName: { color: color.ink, fontWeight: "700", fontSize: 18 },
  title: { marginTop: space.xl, marginBottom: space.lg, color: color.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  hero: { backgroundColor: color.cover, borderRadius: radius.xl, padding: space.lg + 2, gap: space.xs },
  heroLabel: { color: color.coverGlow, fontSize: font.size.caption, fontWeight: "700" },
  heroTitle: { color: color.onGlassClear, fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  heroMeta: { color: "rgba(255,255,255,0.78)", fontSize: 13 },
  section: { marginTop: space.xl, marginBottom: space.sm, color: color.inkMuted, fontSize: 12.5, fontWeight: "700" },
  list: { backgroundColor: color.paper, borderRadius: radius.lg + 2, overflow: "hidden" },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  rowPressed: { backgroundColor: color.paperSubtle },
  markTile: { width: 34, height: 34, borderRadius: 10, backgroundColor: color.paperSubtle, alignItems: "center", justifyContent: "center" },
  mark: { fontSize: 16, color: color.inkSoft },
  rowTitle: { color: color.ink, fontSize: font.size.body, fontWeight: "600" },
  rowMeta: { color: color.inkMuted, fontSize: font.size.caption },
  dock: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  dockGlass: { borderRadius: radius.pill, padding: 6 },
  newButton: { minHeight: touchTarget + 4, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" },
  newButtonText: { color: color.paper, fontWeight: "700", fontSize: 15 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
