import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ancestors, displayTitle, timeAgo, wordCount, type Page } from "@dovli/core";
import { resolveLook, space, touchTarget } from "@dovli/theme";
import { Glass } from "@/components/Glass";
import { showPageActions } from "@/components/Pages";
import { Button, Icon, T, tap, usePalette } from "@/components/ui";
import { store, usePages } from "@/lib/store";
import PageEditorDom, { type PageEditorHandle } from "@/dom/PageEditorDom";

// Only re-draw the editor when its own inputs change. Each re-draw sends its props across to the web
// view again, and one sent while the screen closes fails with "Unable to find the 'DomWebView'".
const Editor = memo(PageEditorDom);

function RoundButton({ label, icon, onPress, color }: { label: string; icon: React.ComponentProps<typeof Icon>["name"]; onPress: () => void; color: string }) {
  return (
    <Glass style={styles.round}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          tap();
          onPress();
        }}
        style={({ pressed }) => [styles.roundHit, pressed && { opacity: 0.6 }]}
      >
        <Icon name={icon} size={21} color={color} />
      </Pressable>
    </Glass>
  );
}

// The editor's web view settings: one object for the app's life, so it never counts as "changed".
const DOM_PROPS = { style: { flex: 1, backgroundColor: "transparent" }, scrollEnabled: true, contentInsetAdjustmentBehavior: "never" } as any;

export function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const page = usePages((x) => x[id]);
  const pages = usePages((x) => x);
  // The editor keeps its own copy while you type; give it the page once, when it opens.
  const [initial] = useState<Page | undefined>(() => store.getPages()[id]);
  // What the editor needs to know about other pages (for links and sub-page cards). Kept stable unless
  // one of those fields really changes: every new value is sent across to the editor's web view, and
  // sending while the screen is closing fails with "Unable to find the 'DomWebView'".
  const othersKey = useMemo(
    () =>
      JSON.stringify(
        Object.values(pages)
          .filter((x) => x.id !== id)
          .map(({ id: pid, title, mark, kind, parentId, deletedAt, createdAt, order }) => [pid, title, mark, kind, parentId, deletedAt ?? null, createdAt, order]),
      ),
    [pages, id],
  );
  const others = useMemo(
    () =>
      (JSON.parse(othersKey) as any[]).map(([pid, title, mark, kind, parentId, deletedAt, createdAt, order]) => ({ id: pid, title, mark, kind, parentId, deletedAt, createdAt, order, updatedAt: createdAt })),
    [othersKey],
  );
  const path = useMemo(() => (page ? ancestors(pages, page.id) : []), [pages, page]);

  useEffect(() => store.markOpened(id), [id]);

  const titleRef = useRef<TextInputInstance>(null);
  const editorRef = useRef<PageEditorHandle>(null);
  const onExitTop = useCallback(async () => titleRef.current?.focus(), []);
  const onSave = useCallback(async (blocks: any[]) => store.updatePage(id, { blocks }), [id]);
  const onOpenPage = useCallback(async (to: string) => void router.push({ pathname: "/page/[id]", params: { id: to } }), [router]);
  const onCreatePage = useCallback(async (newId: string, kind: "doc" | "board", title: string) => void store.createPage({ id: newId, kind, title, parentId: id }), [id]);

  if (!page || !initial || page.deletedAt) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: p.bg }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: p.well, alignItems: "center", justifyContent: "center" }}>
          <Icon name="trash-outline" size={26} color={p.ink3} />
        </View>
        <T v="headline" style={{ marginTop: space.md }}>
          This page isn't here
        </T>
        <T v="subhead" tone="ink3" style={{ textAlign: "center", marginTop: 4 }}>
          It's in the trash or was deleted.
        </T>
        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
          <Button title="Back" tone="secondary" icon="chevron-back" onPress={() => router.back()} />
          {page?.deletedAt ? <Button title="Restore" icon="arrow-undo-outline" onPress={() => store.restorePages([page.id])} /> : null}
        </View>
      </View>
    );
  }

  const style = resolveLook(page.style, page.look).style;
  const paper = style ? style.paper : p.panel;
  const ink = style ? style.ink : p.ink;
  const accent = style ? style.accent : p.accent;
  const words = page.kind === "doc" ? wordCount(page) : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top + 58, paddingHorizontal: space.xl - 4 }}>
        {/* Where this page lives: tap a parent to go there. */}
        {path.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", gap: 4 }} style={{ marginBottom: space.md, flexGrow: 0 }}>
            {path.map((a) => (
              <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/page/[id]", params: { id: a.id } })} hitSlop={6}>
                  <T v="footnote" tone="ink3" numberOfLines={1} style={{ fontWeight: "500", maxWidth: 160 }}>
                    {a.mark} {displayTitle(a)}
                  </T>
                </Pressable>
                <Icon name="chevron-forward" size={11} color={p.ink4} />
              </View>
            ))}
          </ScrollView>
        )}
        <View style={[styles.markTile, { backgroundColor: style ? `${accent}22` : p.accentSoft, borderRadius: p.radius.lg }]}>
          <Text style={{ fontSize: 26, color: accent }}>{page.mark}</Text>
        </View>
        <TextInput
          ref={titleRef}
          value={page.title}
          onChangeText={(title) => store.updatePage(page.id, { title: title.replace(/\n/g, "") })}
          placeholder={page.kind === "board" ? "Untitled board" : "Untitled"}
          placeholderTextColor={p.ink4}
          accessibilityLabel="Page title"
          multiline
          // Return moves down into the page, as on the web, instead of adding a line to the title.
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => editorRef.current?.focusStart()}
          style={[styles.title, { color: ink, fontWeight: String(p.t.fonts.displayWeight) as any }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Page info" onPress={() => router.push({ pathname: "/info/[id]", params: { id: page.id } })} style={styles.meta} hitSlop={6}>
          <T v="footnote" tone="ink3">
            Edited {timeAgo(page.updatedAt)}
            {page.kind === "doc" ? ` · ${words.toLocaleString()} ${words === 1 ? "word" : "words"}` : ""}
          </T>
          <Icon name="information-circle-outline" size={14} color={p.ink4} />
        </Pressable>
      </View>

      {page.kind === "board" ? (
        <View style={{ marginHorizontal: space.xl - 4, padding: space.lg, borderRadius: 16, backgroundColor: p.well, flexDirection: "row", gap: space.md, alignItems: "center" }}>
          <Icon name="easel-outline" size={22} color={p.accent} />
          <T v="subhead" style={{ color: ink, flex: 1 }}>
            Whiteboards open on the web for now. They come to the phone app next.
          </T>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: space.md }}>
          <Editor
            ref={editorRef}
            page={initial}
            others={others}
            themeId={p.t.id}
            background={paper}
            onSave={onSave}
            onOpenPage={onOpenPage}
            onCreatePage={onCreatePage}
            onExitTop={onExitTop}
            dom={DOM_PROPS}
          />
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <RoundButton label="Back" icon="chevron-back" color={p.ink} onPress={() => router.back()} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <RoundButton label={page.favorite ? "Remove from favourites" : "Add to favourites"} icon={page.favorite ? "star" : "star-outline"} color={page.favorite ? p.warn : p.ink} onPress={() => store.toggleFavorite(page.id)} />
          <RoundButton label="Page actions" icon="ellipsis-horizontal" color={p.ink} onPress={() => showPageActions(page, router, { onTrashed: () => router.back() })} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  markTile: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  title: { marginTop: space.lg, fontSize: 30, lineHeight: 36, letterSpacing: -0.9, padding: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: space.xs + 2, marginBottom: space.md, alignSelf: "flex-start" },
  topBar: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", justifyContent: "space-between" },
  round: { width: touchTarget, height: touchTarget, borderRadius: 999, overflow: "hidden" },
  roundHit: { flex: 1, alignItems: "center", justifyContent: "center" },
});
