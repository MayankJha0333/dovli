// Templates: the same starting points as the web app (meeting notes, project brief, journal…).
// Tapping one makes a new page from it and opens it.

import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { templates, type Template } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { MarkTile } from "@/components/Pages";
import { Header, Icon, SectionHeader, T, lift, tap, usePalette } from "@/components/ui";
import { store } from "@/lib/store";

const GROUPS: Template["group"][] = ["Work", "Personal", "Thinking"];

export function TemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();

  const use = (t: Template) => {
    tap("success");
    const built = t.build();
    const page = store.createPage({ kind: t.kind, title: built.title, mark: t.mark, blocks: built.blocks, board: built.board });
    router.replace({ pathname: "/page/[id]", params: { id: page.id } });
  };

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.7} />
      <Header top={space.sm} title="Templates" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }} showsVerticalScrollIndicator={false}>
        <T v="subhead" tone="ink2" style={{ marginTop: space.xs, paddingHorizontal: space.xs }}>
          Start from a page that's already laid out. Change anything once it's yours.
        </T>
        {GROUPS.map((g) => {
          const list = templates.filter((t) => t.group === g);
          if (!list.length) return null;
          return (
            <View key={g}>
              <SectionHeader title={g} />
              <View style={styles.grid}>
                {list.map((t) => (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name}. ${t.description}`}
                    onPress={() => use(t)}
                    style={({ pressed }) => [styles.card, { backgroundColor: p.panel, borderRadius: p.radius.lg + 2, transform: [{ scale: pressed ? 0.97 : 1 }] }, lift(p)]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <MarkTile page={{ mark: t.mark, kind: t.kind }} size={38} />
                      {t.kind === "board" && <Icon name="easel-outline" size={15} color={p.ink3} />}
                    </View>
                    <T v="headline" style={{ marginTop: space.md }} numberOfLines={1}>
                      {t.name}
                    </T>
                    <T v="footnote" tone="ink3" numberOfLines={3} style={{ marginTop: 3 }}>
                      {t.description}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  card: { width: "47.5%", flexGrow: 1, padding: 14, minHeight: 150 },
});
