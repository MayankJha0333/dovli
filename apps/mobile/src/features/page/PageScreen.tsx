import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayTitle, timeAgo } from "@dovli/core";
import { color, font, radius, space, touchTarget } from "@dovli/theme";
import { Glass } from "@/components/Glass";
import { usePages } from "@/lib/store";
import { BlockList } from "./BlockList";

export function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const page = usePages((p) => p[id]);

  if (!page) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.missingText}>This page was deleted.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.cover, { height: insets.top + 190 }]} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 150, paddingBottom: insets.bottom + 48 }}>
        <View style={styles.sheet}>
          <View style={styles.markTile}>
            <Text style={styles.mark}>{page.mark}</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {displayTitle(page)}
          </Text>
          <Text style={styles.meta}>Edited {timeAgo(page.updatedAt)}</Text>
          {page.kind === "board" ? (
            <Text style={styles.note}>Whiteboards open on the web for now. They come to the phone app next.</Text>
          ) : (
            <BlockList blocks={page.blocks ?? []} />
          )}
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + space.sm }]}>
        <Glass tone="clear" style={styles.round}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.roundHit}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  cover: { position: "absolute", left: 0, right: 0, top: 0, backgroundColor: color.cover },
  sheet: { minHeight: 600, backgroundColor: color.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.xl - 2, paddingBottom: space.xxl },
  markTile: { marginTop: -28, width: 56, height: 56, borderRadius: 18, backgroundColor: color.paper, alignItems: "center", justifyContent: "center", shadowColor: "#0A1032", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  mark: { fontSize: 26, color: color.accent },
  title: { marginTop: space.lg, color: color.ink, fontSize: font.size.h1Phone, fontWeight: "800", letterSpacing: -1 },
  meta: { marginTop: space.sm, marginBottom: space.lg, color: color.inkMuted, fontSize: font.size.caption },
  note: { color: color.inkSoft, fontSize: font.size.body, lineHeight: 24 },
  topBar: { position: "absolute", left: space.md + 2 },
  round: { width: touchTarget + 4, height: touchTarget + 4, borderRadius: radius.pill, overflow: "hidden" },
  roundHit: { flex: 1, alignItems: "center", justifyContent: "center" },
  back: { color: color.onGlassClear, fontSize: 30, lineHeight: 32, marginTop: -2 },
  missing: { flex: 1, alignItems: "center" },
  missingText: { color: color.inkMuted },
});
