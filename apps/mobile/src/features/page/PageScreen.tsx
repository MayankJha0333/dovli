import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ancestors, daysLeftInTrash, displayTitle, timeAgo, wordCount, type BoardData, type Page } from "@dovli/core";
import { isDarkColor, resolveLook, space, touchTarget } from "@dovli/theme";
import { Glass } from "@/components/Glass";
import { openPageActions } from "@/components/Pages";
import { Button, Icon, T, tap, usePalette } from "@/components/ui";
import { store, usePages } from "@/lib/store";
import PageEditorDom, { type PageEditorHandle } from "@/dom/PageEditorDom";
import BoardDom from "@/dom/BoardDom";

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

/** On a page in the trash: how long it stays, and restore or delete it for good, right here. */
function TrashBanner({ page, onDeleted }: { page: Page; onDeleted: () => void }) {
  const p = usePalette();
  const [sure, setSure] = useState(false);
  const left = daysLeftInTrash(page);
  return (
    <View style={[styles.banner, { backgroundColor: sure ? p.dangerSoft : p.well }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={sure ? "warning-outline" : "trash-outline"} size={17} color={sure ? p.danger : p.ink2} />
        <T v="subhead" style={{ flex: 1, fontWeight: "600", color: sure ? p.danger : p.ink }}>
          {sure ? "Delete this page for good? This can't be undone." : `In the trash · deleted for good in ${left} ${left === 1 ? "day" : "days"}`}
        </T>
      </View>
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
        {sure ? (
          <>
            <Button title="Keep it" tone="secondary" onPress={() => setSure(false)} style={{ flex: 1 }} />
            <Button
              title="Delete for good"
              tone="danger"
              onPress={() => {
                store.deleteForever([page.id]);
                tap("success");
                onDeleted();
              }}
              style={{ flex: 1 }}
            />
          </>
        ) : (
          <>
            <Button
              title="Restore"
              icon="arrow-undo-outline"
              onPress={() => {
                store.restorePages([page.id]);
                tap("success");
              }}
              style={{ flex: 1 }}
            />
            <Button title="Delete for good" tone="danger" onPress={() => setSure(true)} style={{ flex: 1 }} />
          </>
        )}
      </View>
    </View>
  );
}

// The editor's web view settings: one object for the app's life, so it never counts as "changed".
const DOM_PROPS = { style: { flex: 1, backgroundColor: "transparent" }, scrollEnabled: true, contentInsetAdjustmentBehavior: "never" } as any;
// The whiteboard handles its own panning and zooming, so its web view doesn't scroll or bounce.
const BOARD_PROPS = { style: { flex: 1, backgroundColor: "transparent" }, scrollEnabled: false, bounces: false, contentInsetAdjustmentBehavior: "never" } as any;
const Board = memo(BoardDom);

/** A solid colour from a style's backdrop (its base gradient), shown until the page's web view draws. */
function backdropBase(css: string, fallback: string): string {
  const i = css.lastIndexOf("linear-gradient(");
  return (i >= 0 ? css.slice(i) : css).match(/#[0-9a-f]{6}\b/i)?.[0] ?? fallback;
}

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
  const onSave = useCallback(async (blocks: any[]) => store.updatePage(id, { blocks }), [id]);
  const onOpenPage = useCallback(async (to: string) => void router.push({ pathname: "/page/[id]", params: { id: to } }), [router]);
  const onCreatePage = useCallback(async (newId: string, kind: "doc" | "board", title: string) => void store.createPage({ id: newId, kind, title, parentId: id }), [id]);
  const onSaveBoard = useCallback(async (board: BoardData, quiet: boolean) => store.updatePage(id, { board }, !quiet), [id]);
  const onTitleChange = useCallback(async (title: string) => store.updatePage(id, { title }), [id]);
  const onOpenInfo = useCallback(async () => void router.push({ pathname: "/info/[id]", params: { id } }), [router, id]);

  // Once the title scrolls up under the buttons, a small copy of it shows in the top bar.
  const [titleHidden, setTitleHidden] = useState(false);
  const onTitleHidden = useCallback(async (hidden: boolean) => setTitleHidden(hidden), []);
  const barTitle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barTitle, { toValue: titleHidden ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [barTitle, titleHidden]);

  // Breadcrumbs for the editor, kept the same object until a label really changes (every new
  // value is sent across to its web view).
  const crumbsKey = JSON.stringify(path.map((a) => [a.id, `${a.mark} ${displayTitle(a)}`]));
  const crumbs = useMemo(() => (JSON.parse(crumbsKey) as [string, string][]).map(([cid, label]) => ({ id: cid, label })), [crumbsKey]);

  if (!page || !initial) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: p.bg }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: p.well, alignItems: "center", justifyContent: "center" }}>
          <Icon name="trash-outline" size={26} color={p.ink3} />
        </View>
        <T v="headline" style={{ marginTop: space.md }}>
          This page isn't here
        </T>
        <T v="subhead" tone="ink3" style={{ textAlign: "center", marginTop: 4 }}>
          It was deleted for good.
        </T>
        <Button title="Back" tone="secondary" icon="chevron-back" onPress={() => router.back()} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  const style = resolveLook(page.style, page.look).style;
  const paper = style ? style.paper : p.panel;
  const ink = style ? style.ink : p.ink;
  const words = page.kind === "doc" ? wordCount(page) : 0;
  const trashed = !!page.deletedAt;
  const board = page.kind === "board";
  // A styled page, as on the web: its art fills the screen, and the page sits on a paper sheet over it.
  const styled = !!style && !board;
  const base = style ? backdropBase(style.backdrop, paper) : paper;
  const meta = `Edited ${timeAgo(page.updatedAt)}${board ? " · Whiteboard" : ` · ${words.toLocaleString()} ${words === 1 ? "word" : "words"}`}`;

  const topBar = (
    <View style={[styles.topBar, { top: insets.top + space.sm }]} pointerEvents="box-none">
      <RoundButton label="Back" icon="chevron-back" color={p.ink} onPress={() => router.back()} />
      <Animated.View style={[styles.barTitle, { opacity: barTitle }]} pointerEvents={titleHidden ? "auto" : "none"}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${displayTitle(page)}. Back to the top`} onPress={() => editorRef.current?.scrollToTop()} hitSlop={6}>
          <Glass style={styles.barTitleGlass}>
            <T v="subhead" numberOfLines={1} style={{ fontWeight: "700", color: p.ink }}>
              {page.mark} {displayTitle(page)}
            </T>
          </Glass>
        </Pressable>
      </Animated.View>
      {trashed ? (
        <View style={{ width: touchTarget }} />
      ) : (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <RoundButton label={page.favorite ? "Remove from favourites" : "Add to favourites"} icon={page.favorite ? "star" : "star-outline"} color={page.favorite ? p.warn : p.ink} onPress={() => store.toggleFavorite(page.id)} />
          <RoundButton label="Page actions" icon="ellipsis-horizontal" color={p.ink} onPress={() => openPageActions(router, page, "page")} />
        </View>
      )}
    </View>
  );

  if (board)
    return (
      <View style={{ flex: 1, backgroundColor: paper }}>
        <View style={{ paddingTop: insets.top + 58, paddingHorizontal: space.xl - 4 }}>
          <TextInput
            ref={titleRef}
            value={page.title}
            onChangeText={(title) => store.updatePage(page.id, { title: title.replace(/\n/g, "") })}
            placeholder="Untitled board"
            placeholderTextColor={p.ink4}
            accessibilityLabel="Page title"
            editable={!trashed}
            multiline
            submitBehavior="blurAndSubmit"
            style={[styles.title, { marginTop: 0, fontSize: 24, lineHeight: 30, color: ink, fontWeight: String(p.t.fonts.displayWeight) as any }]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Page info" onPress={() => void onOpenInfo()} style={styles.meta} hitSlop={6}>
            <T v="footnote" tone="ink3">
              {meta}
            </T>
            <Icon name="information-circle-outline" size={14} color={p.ink4} />
          </Pressable>
          {trashed && <TrashBanner page={page} onDeleted={() => router.back()} />}
        </View>
        <View style={[styles.board, { borderColor: p.line }]}>
          <Board board={initial.board ?? {}} dark={p.dark} readOnly={trashed} onSave={onSaveBoard} dom={BOARD_PROPS} />
        </View>
        {topBar}
      </View>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: styled ? base : paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {styled && <StatusBar style={isDarkColor(base) ? "light" : "dark"} />}
      {/* The whole page (cover, icon, title and text) scrolls together inside the editor. */}
      <Editor
        ref={editorRef}
        page={initial}
        others={others}
        themeId={p.t.id}
        background={styled ? base : paper}
        mark={page.mark}
        cover={page.cover ?? null}
        path={crumbs}
        meta={meta}
        topInset={insets.top + 60}
        bottomInset={Math.max(insets.bottom, space.sm) + 6}
        readOnly={trashed}
        onTitleChange={onTitleChange}
        onOpenInfo={onOpenInfo}
        onTitleHidden={onTitleHidden}
        onSave={onSave}
        onOpenPage={onOpenPage}
        onCreatePage={onCreatePage}
        dom={DOM_PROPS}
      />
      {trashed && (
        <View style={[styles.trashDock, { bottom: insets.bottom + space.md }]}>
          <TrashBanner page={page} onDeleted={() => router.back()} />
        </View>
      )}
      {topBar}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: space.md, borderRadius: 16, padding: space.md + 2 },
  board: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  trashDock: { position: "absolute", left: space.lg, right: space.lg, shadowColor: "#0a0e28", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  barTitle: { flex: 1, alignItems: "center", paddingHorizontal: space.sm },
  barTitleGlass: { borderRadius: 999, overflow: "hidden", height: touchTarget, paddingHorizontal: space.lg, justifyContent: "center", maxWidth: "100%" },
  title: { marginTop: space.lg, fontSize: 30, lineHeight: 36, letterSpacing: -0.9, padding: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: space.xs + 2, marginBottom: space.md, alignSelf: "flex-start" },
  topBar: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", justifyContent: "space-between" },
  round: { width: touchTarget, height: touchTarget, borderRadius: 999, overflow: "hidden" },
  roundHit: { flex: 1, alignItems: "center", justifyContent: "center" },
});
