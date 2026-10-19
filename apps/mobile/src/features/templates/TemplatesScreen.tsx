// Templates: the same starting points as the web app. Each card shows a small preview of the page
// it makes (its headings, to-dos and lists, or the shapes of a whiteboard), in the template's own
// colour, so you can see what you'll get before you tap. Blank page and blank whiteboard sit on top.

import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { previewLines, templates, type Template } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { Header, Icon, SectionHeader, T, lift, tap, usePalette, type IconName } from "@/components/ui";
import { store } from "@/lib/store";

const GROUPS: Template["group"][] = ["Work", "Personal", "Thinking"];

/** Each template's colour. */
const TINT: Record<string, string> = {
  meeting: "#5146D9",
  brief: "#0EA5E9",
  spec: "#8B5CF6",
  userflow: "#F59E0B",
  weekly: "#10B981",
  journal: "#6366F1",
  decision: "#E11D48",
  reading: "#DB2777",
  brainstorm: "#F97316",
};
const tintOf = (id: string) => TINT[id] ?? "#5146D9";

/** "#RRGGBB" with an alpha. */
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

/** The same colour, fully see-through (for fading into it). Takes "#RRGGBB" or "rgb(r, g, b)". */
const clear = (c: string) => (c.startsWith("rgb(") ? c.replace("rgb(", "rgba(").replace(")", ", 0)") : c.length === 7 ? `${c}00` : "transparent");

/** The start of the page a template makes, drawn small: headings, to-dos, lists and tables. */
function DocPreview({ blocks, tint }: { blocks: any[]; tint: string }) {
  const p = usePalette();
  const lines = previewLines(blocks, 8);
  return (
    <View style={{ gap: 4 }}>
      {lines.map((l, i) => {
        if (l.kind === "rule") return <View key={i} style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: p.line, marginVertical: 2 }} />;
        if (l.kind === "table")
          return (
            <View key={i} style={[styles.table, { borderColor: p.line }]}>
              {[0, 1].map((r) => (
                <View key={r} style={{ flexDirection: "row", borderTopWidth: r ? StyleSheet.hairlineWidth : 0, borderColor: p.line }}>
                  <View style={{ flex: 1, height: 9, borderRightWidth: StyleSheet.hairlineWidth, borderColor: p.line, backgroundColor: r ? "transparent" : alpha(tint, 0.08) }} />
                  <View style={{ flex: 2, height: 9 }} />
                </View>
              ))}
            </View>
          );
        const heading = l.kind.startsWith("h");
        return (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {l.kind === "todo" ? <View style={[styles.box, { borderColor: tint }]} /> : l.kind === "li" ? <View style={[styles.dot, { backgroundColor: p.ink3 }]} /> : null}
            {l.text.trim() ? (
              <Text numberOfLines={1} style={{ flex: 1, color: heading ? p.ink : p.ink3, fontSize: heading ? (l.kind === "h1" ? 10.5 : 9.5) : 8.5, fontWeight: heading ? "700" : "400" }}>
                {l.text}
              </Text>
            ) : (
              // An empty line waiting to be filled in: a faint bar, like a blank on a form.
              <View style={{ height: 4, width: `${48 + ((i * 17) % 30)}%`, borderRadius: 2, backgroundColor: p.well, marginVertical: 3 }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/** A whiteboard template's shapes, scaled to fit the card. */
function BoardPreview({ skeleton, tint }: { skeleton: any[]; tint: string }) {
  const p = usePalette();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const shapes = skeleton.filter((s) => ["rectangle", "ellipse", "diamond"].includes(s.type) && s.width && s.height);
  if (!shapes.length) return null;
  const minX = Math.min(...shapes.map((s) => s.x));
  const minY = Math.min(...shapes.map((s) => s.y));
  const maxX = Math.max(...shapes.map((s) => s.x + s.width));
  const maxY = Math.max(...shapes.map((s) => s.y + s.height));
  const scale = box.w ? Math.min(box.w / (maxX - minX), box.h / (maxY - minY)) : 0;
  const offX = (box.w - (maxX - minX) * scale) / 2;
  const offY = (box.h - (maxY - minY) * scale) / 2;
  return (
    <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {scale > 0 &&
        shapes.map((s, i) => {
          const w = s.width * scale;
          const h = s.height * scale;
          const left = offX + (s.x - minX) * scale;
          const top = offY + (s.y - minY) * scale;
          const fill = s.backgroundColor && s.backgroundColor !== "transparent" ? alpha(tint, 0.18) : p.panel;
          if (s.type === "diamond") {
            const d = Math.min(w, h) * 0.72;
            return <View key={i} style={{ position: "absolute", left: left + (w - d) / 2, top: top + (h - d) / 2, width: d, height: d, borderWidth: 1, borderColor: tint, backgroundColor: fill, borderRadius: 2, transform: [{ rotate: "45deg" }] }} />;
          }
          return <View key={i} style={{ position: "absolute", left, top, width: w, height: h, borderWidth: 1, borderColor: tint, backgroundColor: fill, borderRadius: s.type === "ellipse" ? Math.min(w, h) / 2 : 3 }} />;
        })}
    </View>
  );
}

function TemplateCard({ t, onPress }: { t: Template; onPress: () => void }) {
  const p = usePalette();
  const tint = tintOf(t.id);
  const built = t.build();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.name}. ${t.description}${t.kind === "board" ? " Whiteboard." : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: p.panel, transform: [{ scale: pressed ? 0.97 : 1 }] }, lift(p)]}
    >
      <View style={[styles.stage, { backgroundColor: alpha(tint, p.dark ? 0.22 : 0.1) }]}>
        <View style={[styles.sheet, { backgroundColor: p.panel }, t.kind === "board" && { paddingHorizontal: 8 }]}>
          {t.kind === "board" ? <BoardPreview skeleton={built.board?.skeleton ?? []} tint={tint} /> : <DocPreview blocks={built.blocks ?? []} tint={tint} />}
          {t.kind === "doc" && <LinearGradient colors={[clear(p.panel), p.panel]} style={styles.fade} pointerEvents="none" />}
        </View>
        <View style={[styles.mark, { backgroundColor: tint }]}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{t.mark}</Text>
        </View>
      </View>
      <View style={{ padding: 12, paddingTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <T v="headline" style={{ fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
            {t.name}
          </T>
          {t.kind === "board" && <Icon name="easel-outline" size={13} color={p.ink3} />}
        </View>
        <T v="caption" tone="ink3" numberOfLines={2} style={{ marginTop: 2, fontWeight: "400", lineHeight: 16 }}>
          {t.description}
        </T>
      </View>
    </Pressable>
  );
}

function BlankButton({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={onPress}
      style={({ pressed }) => [styles.blank, { backgroundColor: p.panel, transform: [{ scale: pressed ? 0.97 : 1 }] }, lift(p)]}
    >
      <View style={[styles.blankIcon, { backgroundColor: p.accentSoft }]}>
        <Icon name={icon} size={19} color={p.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="headline" style={{ fontSize: 15 }} numberOfLines={1}>
          {title}
        </T>
        <T v="caption" tone="ink3" style={{ fontWeight: "400" }} numberOfLines={1}>
          {sub}
        </T>
      </View>
    </Pressable>
  );
}

export function TemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const open = (id: string) => router.replace({ pathname: "/page/[id]", params: { id } });
  const use = (t: Template) => {
    tap("success");
    const built = t.build();
    open(store.createPage({ kind: t.kind, title: built.title, mark: t.mark, blocks: built.blocks, board: built.board }).id);
  };
  const blank = (kind: "doc" | "board") => {
    tap("success");
    open(store.createPage(kind === "board" ? { kind, mark: "◇" } : {}).id);
  };

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.7} />
      {/* On iPhone, Templates slides up as a sheet below the status bar; on Android it fills the screen. */}
      <Header top={Platform.OS === "ios" ? space.sm : insets.top} title="New page" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: space.md, marginTop: space.sm }}>
          <BlankButton icon="document-text-outline" title="Blank page" sub="Start writing" onPress={() => blank("doc")} />
          <BlankButton icon="easel-outline" title="Whiteboard" sub="Start drawing" onPress={() => blank("board")} />
        </View>

        {GROUPS.map((g) => {
          const list = templates.filter((t) => t.group === g);
          if (!list.length) return null;
          return (
            <View key={g}>
              <SectionHeader title={g} />
              <View style={styles.grid}>
                {list.map((t) => (
                  <TemplateCard key={t.id} t={t} onPress={() => use(t)} />
                ))}
              </View>
            </View>
          );
        })}
        <T v="footnote" tone="ink3" style={{ marginTop: space.xl, textAlign: "center" }}>
          Every template is just a page. Change anything once it's yours.
        </T>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  card: { width: "47.5%", flexGrow: 1, borderRadius: 18 },
  stage: { height: 132, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 14, paddingHorizontal: 14, overflow: "hidden" },
  sheet: { flex: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingTop: 9, paddingHorizontal: 9, overflow: "hidden" },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 26 },
  mark: { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 3, overflow: "hidden", marginVertical: 1 },
  box: { width: 7, height: 7, borderRadius: 2, borderWidth: 1 },
  dot: { width: 3, height: 3, borderRadius: 2, marginHorizontal: 2 },
  blank: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16 },
  blankIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
