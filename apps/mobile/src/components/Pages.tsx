// How a page shows up in lists: a row (Recent, the page tree, search, trash) and a card
// (Favourites). Plus the page actions menu, the same choices as the web app's page menu.

import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;
import { childrenOf, displayTitle, previewLines, timeAgo, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Icon, T, lift, tap, usePalette } from "./ui";
import { store } from "@/lib/store";

/** The page's mark in a soft tile. Whiteboards get a quieter tile. */
export function MarkTile({ page, size = 36 }: { page: Pick<Page, "mark" | "kind">; size?: number }) {
  const p = usePalette();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: page.kind === "board" ? p.well : p.accentSoft,
      }}
    >
      <Text style={{ fontSize: Math.round(size * 0.45), color: p.accent }} accessibilityElementsHidden>
        {page.mark}
      </Text>
    </View>
  );
}

export function PageRow({
  page,
  onPress,
  meta,
  depth = 0,
  childCount = 0,
  expanded,
  onToggle,
  first,
  right,
}: {
  page: Page;
  onPress: () => void;
  /** The grey line under the title. Defaults to when it was edited. */
  meta?: string;
  /** Indent level in the page tree. */
  depth?: number;
  childCount?: number;
  expanded?: boolean;
  /** Show or hide the sub-pages (page tree only). */
  onToggle?: () => void;
  first?: boolean;
  right?: React.ReactNode;
}) {
  const p = usePalette();
  // "Opened" when you last only looked at it, "Edited" when you last changed it.
  const opened = (page.lastOpenedAt ?? 0) > page.updatedAt;
  const line = meta ?? `${page.kind === "board" ? "Whiteboard · " : ""}${opened ? "Opened" : "Edited"} ${timeAgo(opened ? page.lastOpenedAt! : page.updatedAt)}`;
  return (
    <Pressable
      onPress={() => {
        tap("select");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${displayTitle(page)}${childCount ? `, ${childCount} ${childCount === 1 ? "page" : "pages"} inside` : ""}`}
      style={({ pressed }) => [
        styles.row,
        { paddingLeft: space.lg + depth * 18 },
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line },
        pressed && { backgroundColor: p.hover },
      ]}
    >
      {onToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Hide pages inside" : "Show pages inside"}
          hitSlop={10}
          disabled={!childCount}
          onPress={() => {
            tap("select");
            onToggle();
          }}
          style={{ width: 18, alignItems: "center", marginLeft: -6, opacity: childCount ? 1 : 0 }}
        >
          <Icon name={expanded ? "chevron-down" : "chevron-forward"} size={14} color={p.ink3} />
        </Pressable>
      ) : null}
      <MarkTile page={page} size={depth ? 30 : 36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="headline" numberOfLines={1} style={depth ? { fontSize: 15.5 } : undefined}>
          {displayTitle(page)}
        </T>
        {line ? (
          <T v="footnote" tone="ink3" numberOfLines={1} style={{ marginTop: 1 }}>
            {line}
          </T>
        ) : null}
      </View>
      {right ?? (
        <>
          {page.favorite ? <Icon name="star" size={13} color={p.warn} /> : null}
          {childCount && !onToggle ? (
            <T v="caption" tone="ink3">
              {childCount}
            </T>
          ) : null}
          <Icon name="chevron-forward" size={15} color={p.ink4} />
        </>
      )}
    </Pressable>
  );
}

/** A favourite as a small card with the start of the page, for the Favourites shelf. */
export function PageCard({ page, onPress }: { page: Page; onPress: () => void }) {
  const p = usePalette();
  const lines = page.kind === "doc" ? previewLines(page.blocks ?? [], 3).filter((l) => l.text) : [];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={displayTitle(page)}
      onPress={() => {
        tap("select");
        onPress();
      }}
      style={({ pressed }) => [styles.card, { backgroundColor: p.panel, borderRadius: p.radius.lg + 2, transform: [{ scale: pressed ? 0.97 : 1 }] }, lift(p)]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <MarkTile page={page} size={32} />
        <Icon name="star" size={13} color={p.warn} />
      </View>
      <T v="headline" numberOfLines={2} style={{ marginTop: space.md, fontSize: 15.5, lineHeight: 20 }}>
        {displayTitle(page)}
      </T>
      <View style={{ flex: 1, marginTop: 4, gap: 2, overflow: "hidden" }}>
        {lines.slice(0, 2).map((l, i) => (
          <T key={i} v="caption" tone="ink3" numberOfLines={1} style={{ fontWeight: "400" }}>
            {l.kind === "todo" ? "☐ " : l.kind === "li" ? "• " : ""}
            {l.text}
          </T>
        ))}
        {page.kind === "board" && (
          <T v="caption" tone="ink3" style={{ fontWeight: "400" }}>
            Whiteboard
          </T>
        )}
      </View>
      <T v="caption" tone="ink4" style={{ fontWeight: "400" }}>
        {timeAgo(page.updatedAt)}
      </T>
    </Pressable>
  );
}

/** The page menu: favourite, a page inside, duplicate, info, trash. The same choices as the web. */
export function showPageActions(page: Page, router: Router, opts: { onTrashed?: () => void } = {}) {
  tap();
  const choices: { label: string; destructive?: boolean; run: () => void }[] = [
    { label: page.favorite ? "Remove from favourites" : "Add to favourites", run: () => store.toggleFavorite(page.id) },
    ...(page.kind === "doc"
      ? [
          {
            label: "New page inside",
            run: () => {
              const child = store.createPage({ parentId: page.id });
              router.push({ pathname: "/page/[id]", params: { id: child.id } });
            },
          },
        ]
      : []),
    {
      label: "Duplicate",
      run: () => {
        const copy = store.duplicatePage(page.id);
        if (copy) router.push({ pathname: "/page/[id]", params: { id: copy.id } });
      },
    },
    { label: "Page info", run: () => router.push({ pathname: "/info/[id]", params: { id: page.id } }) },
    {
      label: "Move to trash",
      destructive: true,
      run: () => {
        const inside = childrenOf(store.getPages(), page.id).length;
        const go = () => {
          store.trashPage(page.id);
          tap("success");
          opts.onTrashed?.();
        };
        if (inside) Alert.alert("Move to trash?", `The ${inside} ${inside === 1 ? "page" : "pages"} inside go too. You can restore them from Trash for 30 days.`, [{ text: "Cancel", style: "cancel" }, { text: "Move to trash", style: "destructive", onPress: () => setTimeout(go, 0) }]);
        else go();
      },
    },
  ];
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: displayTitle(page),
        options: [...choices.map((c) => c.label), "Cancel"],
        cancelButtonIndex: choices.length,
        destructiveButtonIndex: choices.findIndex((c) => c.destructive),
      },
      // Run after the sheet closes: a change made inside its callback isn't always drawn until the next touch.
      (i) => setTimeout(() => choices[i]?.run(), 0),
    );
  } else {
    Alert.alert(displayTitle(page), undefined, [...choices.map((c) => ({ text: c.label, style: c.destructive ? ("destructive" as const) : undefined, onPress: () => setTimeout(c.run, 0) })), { text: "Cancel", style: "cancel" }]);
  }
}

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space.md, paddingRight: space.lg, paddingVertical: 9 },
  card: { width: 158, height: 172, padding: 14 },
});
