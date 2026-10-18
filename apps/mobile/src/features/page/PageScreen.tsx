import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayTitle, timeAgo, type Page } from "@dovli/core";
import { getStyle, space, touchTarget } from "@dovli/theme";
import { Glass } from "@/components/Glass";
import { usePalette } from "@/components/ui";
import { store, usePages } from "@/lib/store";
import PageEditorDom from "@/dom/PageEditorDom";

export function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const page = usePages((x) => x[id]);
  const pages = usePages((x) => x);
  // The editor keeps its own copy while you type; give it the page once, when it opens.
  const [initial] = useState<Page | undefined>(() => store.getPages()[id]);
  const others = useMemo(
    () =>
      Object.values(pages)
        .filter((x) => x.id !== id)
        .map(({ id: pid, title, mark, kind, parentId, deletedAt, updatedAt, createdAt, order }) => ({ id: pid, title, mark, kind, parentId, deletedAt, updatedAt, createdAt, order })),
    [pages, id],
  );

  useEffect(() => store.markOpened(id), [id]);

  const titleRef = useRef<TextInputInstance>(null);
  const onExitTop = useCallback(async () => titleRef.current?.focus(), []);

  const onSave = useCallback(async (blocks: any[]) => store.updatePage(id, { blocks }), [id]);
  const onOpenPage = useCallback(async (to: string) => void router.push({ pathname: "/page/[id]", params: { id: to } }), [router]);
  const onCreatePage = useCallback(async (newId: string, kind: "doc" | "board", title: string) => void store.createPage({ id: newId, kind, title, parentId: id }), [id]);

  if (!page || !initial || page.deletedAt) {
    return (
      <View style={{ flex: 1, alignItems: "center", paddingTop: insets.top + space.xxl, backgroundColor: p.bg }}>
        <Text style={{ color: p.ink3 }}>This page is in the trash or was deleted.</Text>
      </View>
    );
  }

  const style = getStyle(page.style);
  const paper = style ? style.paper : p.panel;
  const ink = style ? style.ink : p.ink;

  const more = () =>
    Alert.alert(displayTitle(page), undefined, [
      { text: page.favorite ? "Remove from favourites" : "Add to favourites", onPress: () => store.toggleFavorite(page.id) },
      {
        text: "Move to trash",
        style: "destructive",
        onPress: () => {
          store.trashPage(page.id);
          router.back();
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top + 56, paddingHorizontal: space.xl - 4 }}>
        <View style={[styles.markTile, { backgroundColor: p.accentSoft, borderRadius: p.radius.lg }]}>
          <Text style={{ fontSize: 26, color: style ? style.accent : p.accent }}>{page.mark}</Text>
        </View>
        <TextInput
          ref={titleRef}
          value={page.title}
          onChangeText={(title) => store.updatePage(page.id, { title: title.replace(/\n/g, "") })}
          placeholder={page.kind === "board" ? "Untitled board" : "Untitled"}
          placeholderTextColor={p.ink3}
          accessibilityLabel="Page title"
          multiline
          style={[styles.title, { color: ink, fontWeight: String(p.t.fonts.displayWeight) as any }]}
        />
        <Text style={{ marginTop: space.xs, marginBottom: space.md, color: p.ink3, fontSize: 12.5 }}>Edited {timeAgo(page.updatedAt)}</Text>
      </View>

      {page.kind === "board" ? (
        <View style={{ paddingHorizontal: space.xl - 4 }}>
          <Text style={{ color: ink, fontSize: 15, lineHeight: 22 }}>Whiteboards open on the web for now. They come to the phone app next.</Text>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: space.md }}>
          <PageEditorDom
            page={initial}
            others={others}
            themeId={p.t.id}
            background={paper}
            onSave={onSave}
            onOpenPage={onOpenPage}
            onCreatePage={onCreatePage}
            onExitTop={onExitTop}
            dom={{ style: { flex: 1, backgroundColor: "transparent" }, scrollEnabled: true, contentInsetAdjustmentBehavior: "never" } as any}
          />
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + space.sm }]}>
        <Glass style={styles.round}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.roundHit}>
            <Text style={{ color: p.ink, fontSize: 28, lineHeight: 30, marginTop: -2 }}>‹</Text>
          </Pressable>
        </Glass>
        <Glass style={styles.round}>
          <Pressable accessibilityRole="button" accessibilityLabel="Page actions" onPress={more} style={styles.roundHit}>
            <Text style={{ color: p.ink, fontSize: 20 }}>•••</Text>
          </Pressable>
        </Glass>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  markTile: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  title: { marginTop: space.lg, fontSize: 30, letterSpacing: -1, padding: 0 },
  topBar: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", justifyContent: "space-between" },
  round: { width: touchTarget + 2, height: touchTarget + 2, borderRadius: 999, overflow: "hidden" },
  roundHit: { flex: 1, alignItems: "center", justifyContent: "center" },
});
