// How a page shows up in lists: a row (Recent, the page tree, search, trash) and a card
// (Favourites). Plus the page actions menu, the same choices as the web app's page menu.

import { Pressable, StyleSheet, Text, View } from "react-native";
import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;
import { displayTitle, previewLines, timeAgo, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Icon, T, lift, tap, usePalette } from "./ui";

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
  onLongPress,
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
  /** A long press: usually the page's actions sheet. */
  onLongPress?: () => void;
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
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityActions={onLongPress ? [{ name: "longpress", label: "Page actions" }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && onLongPress?.()}
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
export function PageCard({ page, onPress, onLongPress }: { page: Page; onPress: () => void; onLongPress?: () => void }) {
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
      onLongPress={onLongPress}
      delayLongPress={350}
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

/** The page's actions sheet (favourite, duplicate, share, AI, a page inside, info, trash). `from`
 *  says it was opened on the page itself, so moving it to the trash leaves the page too. */
export function openPageActions(router: Router, page: Pick<Page, "id">, from?: "page") {
  tap();
  router.push({ pathname: "/actions/[id]", params: from ? { id: page.id, from } : { id: page.id } });
}

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space.md, paddingRight: space.lg, paddingVertical: 9 },
  card: { width: 158, height: 172, padding: 14 },
});
