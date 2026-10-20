// Page lists shared by Home, Favourites and All pages: a favourite card, Home's note cards, the page
// tree and grid, the list/grid switch, and the Show more button.

import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { displayTitle, pageTags, previewLines, timeAgo, type Page, type SearchHit } from "@dovli/core";
import { space } from "@dovli/theme";
import { MarkTile, PageRow } from "@/components/Pages";
import { Card, Icon, T, lift, tap, usePalette, type IconName } from "@/components/ui";
import { store } from "@/lib/store";

/** A few lines from the start of a page, joined into one: "Agenda • Action items • Follow ups". */
export function preview(page: Page): string {
  if (page.kind === "board") return "Whiteboard";
  return previewLines(page.blocks ?? [], 4)
    .map((l) => l.text.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" • ");
}

/** A favourite as a wide card: its mark, title, the start of the page, and when it changed. */
export function FavoriteCard({ page, onPress, onLongPress }: { page: Page; onPress: () => void; onLongPress: () => void }) {
  const p = usePalette();
  const line = preview(page);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${displayTitle(page)}, favourite`}
      onPress={() => {
        tap("select");
        onPress();
      }}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.favorite, { backgroundColor: p.panel, transform: [{ scale: pressed ? 0.985 : 1 }] }, lift(p)]}
    >
      <MarkTile page={page} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="headline" numberOfLines={1}>
          {displayTitle(page)}
        </T>
        {line ? (
          <T v="footnote" tone="ink3" numberOfLines={1} style={{ marginTop: 2 }}>
            {line}
          </T>
        ) : null}
        <T v="caption" tone="ink4" style={{ fontWeight: "400", marginTop: 4 }}>
          {timeAgo(page.updatedAt)}
        </T>
      </View>
      <Icon name="star" size={16} color={p.warn} style={{ alignSelf: "flex-start" }} />
    </Pressable>
  );
}

/** Soft card colours that Home's note cards take turns with: a wash for the card and an ink for its chips. */
const TINTS = [
  { wash: "#F1ECFF", ink: "#7C5CF0" },
  { wash: "#E8F3FF", ink: "#2F7BEA" },
  { wash: "#FFF4DE", ink: "#D98A0B" },
  { wash: "#FFEDF4", ink: "#E0457B" },
  { wash: "#E9F8F0", ink: "#14A267" },
] as const;

export function tint(i: number, dark: boolean) {
  const t = TINTS[i % TINTS.length];
  // A pastel card turns into a glare on a dark theme, so there it becomes a faint wash of the ink.
  return { wash: dark ? `${t.ink}22` : t.wash, ink: t.ink, chip: dark ? `${t.ink}33` : `${t.ink}1A` };
}

function Chip({ icon, text, color, bg }: { icon: IconName; text: string; color: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Icon name={icon} size={11} color={color} />
      <T v="caption" numberOfLines={1} style={{ color, fontSize: 11, flexShrink: 1 }}>
        {text}
      </T>
    </View>
  );
}

/** A page as a soft coloured card: its mark and title, the start of the page, and chips for when it
 *  changed and its first tag. `wide` cards fill the row; the others sit in a sideways list. */
export function NoteCard({ page, index, wide, onPress, onLongPress }: { page: Page; index: number; wide?: boolean; onPress: () => void; onLongPress: () => void }) {
  const p = usePalette();
  const c = tint(index, p.dark);
  const line = preview(page);
  const tag = pageTags(page)[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${displayTitle(page)}${page.favorite ? ", favourite" : ""}. Edited ${timeAgo(page.updatedAt)}`}
      onPress={() => {
        tap("select");
        onPress();
      }}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.note, wide ? { alignSelf: "stretch" } : { width: 248 }, { backgroundColor: c.wash, transform: [{ scale: pressed ? 0.985 : 1 }] }, p.dark && lift(p)]}
    >
      {/* The page's mark, large and faint in the corner, like an illustration. */}
      <T style={[styles.noteArt, { color: c.ink }]} accessibilityElementsHidden importantForAccessibility="no">
        {page.mark}
      </T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <T style={{ fontSize: 17, color: c.ink }}>{page.mark}</T>
        <T v="headline" numberOfLines={1} style={{ flex: 1, fontWeight: "700" }}>
          {displayTitle(page)}
        </T>
        {page.favorite ? <Icon name="star" size={14} color={p.warn} /> : null}
      </View>
      <T v="footnote" tone="ink2" numberOfLines={wide ? 2 : 1} style={{ marginTop: 6 }}>
        {line || "Empty page"}
      </T>
      <View style={{ flexDirection: "row", gap: 6, marginTop: space.md }}>
        <Chip icon="calendar-clear-outline" text={timeAgo(page.updatedAt)} color={c.ink} bg={c.chip} />
        {tag ? <Chip icon="pricetag-outline" text={tag} color="#fff" bg={p.dark ? `${c.ink}AA` : c.ink} /> : null}
      </View>
    </Pressable>
  );
}

/** Each page's children in order, built once per change. Same rules as childrenOf (trash left
 *  out), without scanning every page for every row: that grows slow once there are thousands. */
export type Children = Map<string | null, Page[]>;
export function childIndex(pages: Record<string, Page>): Children {
  const index: Children = new Map();
  for (const page of Object.values(pages)) {
    if (page.deletedAt) continue;
    const list = index.get(page.parentId);
    if (list) list.push(page);
    else index.set(page.parentId, [page]);
  }
  for (const list of index.values()) list.sort((a, b) => a.order - b.order);
  return index;
}

/** Every page as a tree: top-level pages, with the pages inside an open page under it. */
export function treeRows(children: Children) {
  const rows: { page: Page; depth: number; count: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const page of children.get(parentId) ?? []) {
      const count = children.get(page.id)?.length ?? 0;
      rows.push({ page, depth, count });
      if (page.expanded && count && depth < 4) walk(page.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

export function PageTree({ rows, open, actions }: { rows: { page: Page; depth: number; count: number }[]; open: (p: Page) => void; actions: (p: Page) => void }) {
  return (
    <Card>
      {rows.map(({ page, depth, count }, i) => (
        <PageRow
          key={page.id}
          page={page}
          depth={depth}
          first={i === 0}
          childCount={count}
          expanded={!!page.expanded}
          onToggle={() => store.toggleExpanded(page.id)}
          onPress={() => open(page)}
          onLongPress={() => actions(page)}
          meta={count ? `${count} ${count === 1 ? "page" : "pages"} inside` : page.kind === "board" ? "Whiteboard" : ""}
        />
      ))}
    </Card>
  );
}

/** Top-level pages as tiles, two to a row. */
export function PageGrid({ tops, children, open, actions }: { tops: Page[]; children: Children; open: (p: Page) => void; actions: (p: Page) => void }) {
  const p = usePalette();
  return (
    <View style={styles.grid}>
      {tops.map((page) => {
        const count = children.get(page.id)?.length ?? 0;
        return (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            accessibilityLabel={displayTitle(page)}
            onPress={() => {
              tap("select");
              open(page);
            }}
            onLongPress={() => actions(page)}
            delayLongPress={350}
            style={({ pressed }) => [styles.tile, { backgroundColor: p.panel, transform: [{ scale: pressed ? 0.97 : 1 }] }, lift(p)]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <MarkTile page={page} size={36} />
              {page.favorite ? <Icon name="star" size={13} color={p.warn} /> : null}
            </View>
            <T v="headline" numberOfLines={2} style={{ marginTop: space.md, fontSize: 15.5, lineHeight: 20 }}>
              {displayTitle(page)}
            </T>
            <T v="caption" tone="ink3" numberOfLines={1} style={{ fontWeight: "400", marginTop: 4 }}>
              {count ? `${count} ${count === 1 ? "page" : "pages"} inside` : page.kind === "board" ? "Whiteboard" : timeAgo(page.updatedAt)}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Below a list that's cut short: "Show 10 more", and "Show less" once it's been opened up. */
export function MoreButton({ shown, total, step, onMore, onLess }: { shown: number; total: number; step: number; onMore: () => void; onLess?: () => void }) {
  const p = usePalette();
  const left = total - shown;
  if (left <= 0 && !onLess) return null;
  return (
    <View style={styles.more}>
      {left > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap("select");
            onMore();
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.moreBtn, { backgroundColor: p.panel, opacity: pressed ? 0.7 : 1 }, lift(p)]}
        >
          <T v="subhead" tone="accent" style={{ fontWeight: "600" }}>
            Show {Math.min(step, left)} more
          </T>
          <Icon name="chevron-down" size={14} color={p.accent} />
        </Pressable>
      ) : null}
      {onLess ? (
        <Pressable accessibilityRole="button" onPress={onLess} hitSlop={6} style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <T v="subhead" tone="ink3" style={{ fontWeight: "600" }}>
            Show less
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** List or grid, for All pages. */
export function ViewToggle({ grid, onChange }: { grid: boolean; onChange: (grid: boolean) => void }) {
  const p = usePalette();
  return (
    <View style={[styles.toggle, { backgroundColor: p.well }]}>
      {([
        ["list", "list-outline", false],
        ["grid", "grid-outline", true],
      ] as const).map(([key, icon, value]) => {
        const on = grid === value;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={value ? "Show as grid" : "Show as list"}
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap("select");
              onChange(value);
            }}
            style={[styles.toggleBtn, on && [{ backgroundColor: p.panel }, lift(p)]]}
          >
            <Icon name={icon} size={17} color={on ? p.accent : p.ink3} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  favorite: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md + 2, borderRadius: 18 },
  note: { padding: space.lg, borderRadius: 24, overflow: "hidden" },
  noteArt: { position: "absolute", right: -6, bottom: -22, fontSize: 96, lineHeight: 110, opacity: 0.08 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 8, maxWidth: 150 },
  toggle: { flexDirection: "row", padding: 3, borderRadius: 12, gap: 2 },
  toggleBtn: { width: 36, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm + 2 },
  tile: { width: "48.5%", minHeight: 132, padding: 14, borderRadius: 18 },
  more: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.sm, marginTop: space.md },
  search: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: space.lg, paddingRight: 6, borderRadius: 16, borderWidth: 1.5, marginBottom: space.lg },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: space.lg, borderRadius: 999 },
});

/** Under a list that Home shows only part of: opens the full list on its own screen. */
export function ViewAllButton({ label, onPress }: { label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <View style={styles.more}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap("select");
          onPress();
        }}
        hitSlop={6}
        style={({ pressed }) => [styles.moreBtn, { backgroundColor: p.panel, opacity: pressed ? 0.7 : 1 }, lift(p)]}
      >
        <T v="subhead" tone="accent" style={{ fontWeight: "600" }}>
          {label}
        </T>
        <Icon name="chevron-forward" size={14} color={p.accent} />
      </Pressable>
    </View>
  );
}

/** A search box for a list screen. Only the screen's own pages are searched. */
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (q: string) => void; placeholder: string }) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, { backgroundColor: p.panel, borderColor: focused ? p.accent : "transparent" }, lift(p)]}>
      <Icon name="search" size={18} color={focused ? p.accent : p.ink3} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={p.ink4}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={{ flex: 1, color: p.ink, fontSize: 16, paddingVertical: 13 }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChange("")} style={{ padding: 6 }}>
          <Icon name="close-circle" size={18} color={p.ink3} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Search results: each page with the words around the match. Shows a few at a time. */
export function SearchResults({ hits, query, open, actions }: { hits: SearchHit[]; query: string; open: (p: Page) => void; actions: (p: Page) => void }) {
  const p = usePalette();
  const [limit, setLimit] = useState(20);
  if (!hits.length)
    return (
      <View style={{ alignItems: "center", paddingVertical: space.xxl }}>
        <Icon name="search-outline" size={28} color={p.ink4} />
        <T v="headline" style={{ marginTop: space.md }}>
          Nothing matches “{query.trim()}”
        </T>
        <T v="subhead" tone="ink3" style={{ marginTop: 4, textAlign: "center" }}>
          Try a different word, or check the spelling.
        </T>
      </View>
    );
  return (
    <>
      <T v="footnote" tone="ink3" style={{ paddingHorizontal: space.xs, marginBottom: space.sm }}>
        {hits.length} {hits.length === 1 ? "result" : "results"}
      </T>
      <Card>
        {hits.slice(0, limit).map((h, i) => (
          <PageRow key={h.page.id} page={h.page} first={i === 0} meta={h.snippet?.text} onPress={() => open(h.page)} onLongPress={() => actions(h.page)} />
        ))}
      </Card>
      <MoreButton shown={Math.min(limit, hits.length)} total={hits.length} step={20} onMore={() => setLimit((n) => n + 20)} />
    </>
  );
}
