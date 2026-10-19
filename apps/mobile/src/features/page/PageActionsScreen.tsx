// What you can do with a page, as a sheet that slides up (the ⋯ button, or a long press on a page in
// a list). It replaces the plain system menu: big buttons for the common things, then the rest.

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayTitle, timeAgo, wordCount } from "@dovli/core";
import { space } from "@dovli/theme";
import { MarkTile } from "@/components/Pages";
import { Icon, IconButton, Row, Section, T, tap, usePalette, type IconName } from "@/components/ui";
import { store, usePages } from "@/lib/store";

function BigAction({ icon, label, onPress, on, tint }: { icon: IconName; label: string; onPress: () => void; on?: boolean; tint?: string }) {
  const p = usePalette();
  const color = tint ?? p.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={on === undefined ? undefined : { selected: on }}
      accessibilityLabel={label}
      onPress={() => {
        tap("select");
        onPress();
      }}
      style={({ pressed }) => [styles.big, { backgroundColor: on ? `${color}1F` : p.panel, borderColor: on ? `${color}55` : p.line, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
    >
      <Icon name={icon} size={22} color={color} />
      <Text style={{ color: p.ink, fontSize: 13, fontWeight: "600", marginTop: 6 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PageActionsScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const page = usePages((x) => x[id]);
  const inside = usePages((x) => Object.values(x).filter((c) => c.parentId === id && !c.deletedAt).length);

  if (!page) return null;
  const words = page.kind === "doc" ? wordCount(page) : 0;

  /** Close this sheet, then go somewhere. */
  const go = (to: () => void) => {
    router.back();
    to();
  };

  const trash = () => {
    store.trashPage(page.id);
    tap("success");
    router.back();
    // Opened from the page itself: that page is in the trash now, so leave it too.
    if (from === "page") router.back();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: insets.bottom + space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <MarkTile page={page} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="headline" numberOfLines={1}>
            {displayTitle(page)}
          </T>
          <T v="footnote" tone="ink3" numberOfLines={1}>
            {page.kind === "board" ? "Whiteboard" : `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`} · Edited {timeAgo(page.updatedAt)}
            {inside ? ` · ${inside} inside` : ""}
          </T>
        </View>
        <IconButton label="Close" icon="close" color={p.ink2} onPress={() => router.back()} />
      </View>

      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
        <BigAction icon={page.favorite ? "star" : "star-outline"} label="Favourite" on={!!page.favorite} tint={p.warn} onPress={() => store.toggleFavorite(page.id)} />
        <BigAction
          icon="copy-outline"
          label="Duplicate"
          onPress={() => {
            const copy = store.duplicatePage(page.id);
            if (copy) go(() => router.push({ pathname: "/page/[id]", params: { id: copy.id } }));
          }}
        />
        <BigAction icon="share-outline" label="Share" onPress={() => go(() => router.push({ pathname: "/share/[id]", params: { id: page.id } }))} />
      </View>

      <Section style={{ marginTop: space.lg }}>
        {page.kind === "doc" ? (
          <Row
            icon="add-circle-outline"
            title="New page inside"
            onPress={() => {
              const child = store.createPage({ parentId: page.id });
              go(() => router.push({ pathname: "/page/[id]", params: { id: child.id } }));
            }}
          />
        ) : null}
        {page.kind === "doc" ? (
          <Row
            icon="color-palette-outline"
            title="Style"
            detail="Page style, colours, cover, font and dividers"
            onPress={() => go(() => router.push({ pathname: "/style/[id]", params: { id: page.id } }))}
          />
        ) : null}
        <Row icon="information-circle-outline" title="Page info" detail="Outline, to-dos, links and dates" onPress={() => go(() => router.push({ pathname: "/info/[id]", params: { id: page.id } }))} />
      </Section>

      <Section style={{ marginTop: space.md }}>
        <Row icon="trash-outline" title="Move to trash" detail={inside ? `The ${inside} ${inside === 1 ? "page" : "pages"} inside go too. Restore any time in 30 days.` : "Restore it any time in the next 30 days."} destructive chevron={false} onPress={trash} />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  big: { flex: 1, height: 78, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
});
