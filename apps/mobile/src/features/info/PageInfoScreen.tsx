// Page info, like the web app's Info panel: words, to-dos, pages inside, links to this page,
// dates, and the page's outline.

import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ancestors, backlinksOf, childrenOf, displayTitle, outline, todoItems, wordCount, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { MarkTile, PageRow } from "@/components/Pages";
import { Card, Icon, IconButton, Row, Section, SectionHeader, T, lift, usePalette, type IconName } from "@/components/ui";
import { usePages } from "@/lib/store";

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const p = usePalette();
  return (
    <View style={[styles.stat, { backgroundColor: p.panel, borderRadius: p.radius.lg }, lift(p)]} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={16} color={p.accent} />
      <T v="title3" style={{ marginTop: 6 }}>
        {value}
      </T>
      <T v="caption" tone="ink3" style={{ fontWeight: "400" }}>
        {label}
      </T>
    </View>
  );
}

const when = (ts: number) => {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), hour: "numeric", minute: "2-digit" });
};

export function PageInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pages = usePages((x) => x);
  const page = pages[id];
  if (!page) return null;

  const open = (pg: Page) => {
    router.back();
    router.push({ pathname: "/page/[id]", params: { id: pg.id } });
  };
  const todos = page.kind === "doc" ? todoItems(page) : [];
  const done = todos.filter((t) => t.checked).length;
  const heads = page.kind === "doc" ? outline(page) : [];
  const inside = childrenOf(pages, page.id);
  const links = backlinksOf(pages, page.id);
  const path = ancestors(pages, page.id);

  return (
    // A sheet wants its scroll view as the outermost view (react-native-screens lays it out that way).
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl }}>
        {/* The sheet's top: which page, and a close button. */}
        <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
          <MarkTile page={page} size={48} />
          <View style={{ flex: 1 }}>
            <T v="caption" tone="ink3" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
              Page info
            </T>
            <T v="title3" numberOfLines={2} accessibilityRole="header">
              {displayTitle(page)}
            </T>
            <T v="footnote" tone="ink3" numberOfLines={1}>
              {path.length ? `In ${path.map((a) => displayTitle(a)).join(" / ")}` : "Top-level page"}
            </T>
          </View>
          <IconButton label="Close" icon="close" color={p.ink} onPress={() => router.back()} />
        </View>

        <View style={{ flexDirection: "row", gap: space.sm + 2, marginTop: space.lg }}>
          <Stat icon="text-outline" value={page.kind === "doc" ? wordCount(page).toLocaleString() : "—"} label="Words" />
          <Stat icon="checkbox-outline" value={todos.length ? `${done}/${todos.length}` : "0"} label="To-dos" />
          <Stat icon="layers-outline" value={String(inside.length)} label="Inside" />
          <Stat icon="link-outline" value={String(links.length)} label="Links here" />
        </View>

        <Section title="Dates">
          <Row icon="add-circle-outline" title="Created" value={when(page.createdAt)} />
          <Row icon="create-outline" title="Last edited" value={when(page.updatedAt)} />
        </Section>

        {heads.length > 0 && (
          <>
            <SectionHeader small title="Outline" />
            <Card style={{ paddingVertical: space.sm }}>
              {heads.map((h) => {
                // Indent relative to the page's biggest heading, so a page of only H2s isn't all indented.
                const depth = h.level - Math.min(...heads.map((x) => x.level));
                return (
                  <T key={h.id} v={depth ? "subhead" : "callout"} tone={depth ? "ink2" : "ink"} numberOfLines={1} style={{ paddingVertical: 7, paddingRight: space.lg, paddingLeft: space.lg + depth * 16, fontWeight: depth ? "400" : "600" }}>
                    {h.text || "Untitled heading"}
                  </T>
                );
              })}
            </Card>
          </>
        )}

        {todos.length > 0 && (
          <>
            <SectionHeader small title={`To-dos · ${done} of ${todos.length} done`} />
            <Card style={{ paddingVertical: space.sm }}>
              {todos.slice(0, 30).map((t) => (
                <View key={t.id} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 7, paddingHorizontal: space.lg }}>
                  <Icon name={t.checked ? "checkbox" : "square-outline"} size={18} color={t.checked ? p.accent : p.ink3} />
                  <T v="subhead" tone={t.checked ? "ink3" : "ink"} style={{ flex: 1, textDecorationLine: t.checked ? "line-through" : "none" }} numberOfLines={2}>
                    {t.text || "Empty to-do"}
                  </T>
                </View>
              ))}
            </Card>
          </>
        )}

        {inside.length > 0 && (
          <>
            <SectionHeader small title="Pages inside" />
            <Card>
              {inside.map((c, i) => (
                <PageRow key={c.id} page={c} first={i === 0} onPress={() => open(c)} />
              ))}
            </Card>
          </>
        )}

        {links.length > 0 && (
          <>
            <SectionHeader small title="Linked from" />
            <Card>
              {links.map((c, i) => (
                <PageRow key={c.id} page={c} first={i === 0} onPress={() => open(c)} />
              ))}
            </Card>
          </>
        )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, alignItems: "flex-start" },
});
