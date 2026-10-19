// Home: a greeting, search, quick ways to start, your favourites, what you opened lately, every
// page as a tree or a grid (pages inside pages, like the web sidebar), tags, and the trash.

import { useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { favoritePages, pagesWithTag, recentPages, searchPages, tagIndex, templates, trashRoots, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { GradientText } from "@/components/GradientText";
import { PageRow, openPageActions } from "@/components/Pages";
import { Avatar, BrandMark, Card, Icon, IconButton, SectionHeader, T, lift, tap, usePalette, type IconName } from "@/components/ui";
import { firstName, usePhoneAuth } from "@/lib/auth";
import { store, usePages } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import { FavoriteCard, PageGrid, PageTree, ViewAllButton, ViewToggle, childIndex, treeRows } from "./lists";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Today's journal: opens today's page if there is one, otherwise makes it from the template. */
function openJournal(open: (p: Page) => void) {
  const t = templates.find((x) => x.id === "journal");
  if (!t) return open(store.createPage());
  const built = t.build();
  const existing = Object.values(store.getPages()).find((p) => !p.deletedAt && p.title === built.title);
  open(existing ?? store.createPage({ kind: t.kind, title: built.title, mark: t.mark, blocks: built.blocks }));
}

/** Stacked picture cards with a sparkle, beside the greeting. Decoration only. */
function HeroArt() {
  const p = usePalette();
  const back = p.dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)";
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
      <View style={[styles.artCard, { backgroundColor: back, borderColor: p.line, transform: [{ rotate: "-14deg" }], left: 4, top: 22 }]} />
      <View style={[styles.artCard, { backgroundColor: back, borderColor: p.line, transform: [{ rotate: "18deg" }], left: 44, top: 30 }]} />
      <View style={[styles.artCard, styles.artFront, { backgroundColor: p.raised, borderColor: p.line }, lift(p, 2)]}>
        <View style={styles.artPhoto}>
          {/* Dawn over the mountains. */}
          <LinearGradient colors={p.dark ? ["#3A4A8C", "#6A4A8E", "#9A5A86"] : ["#8FB8F8", "#C7B6F6", "#F7C3D9"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.peak, { left: -10, top: 58, backgroundColor: p.dark ? "#4A3F86" : "#9AA6EE" }]} />
          <View style={[styles.peak, { left: 26, top: 46, width: 72, height: 72, backgroundColor: p.dark ? "#3A3570" : "#6F86E6" }]} />
          <View style={[styles.peak, { left: 58, top: 66, width: 50, height: 50, backgroundColor: p.dark ? "#2E2C60" : "#5470DA" }]} />
          <LinearGradient colors={["rgba(255,255,255,0)", p.dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 26 }} />
        </View>
      </View>
      <Icon name="sparkles" size={13} color={p.dark ? "#9CC6FF" : "#8AB4FF"} style={{ position: "absolute", left: -18, top: 10 }} />
      <Icon name="sparkles" size={10} color="#B9A8FF" style={{ position: "absolute", left: 0, bottom: 4 }} />
      <View style={styles.artNote}>
        <T style={[styles.hand, { color: p.ink2 }]}>{"Big ideas\nstart here"}</T>
        <Icon name="arrow-undo-outline" size={18} color={p.accent} style={{ transform: [{ rotate: "-70deg" }], marginTop: 2, marginRight: 14 }} />
      </View>
    </View>
  );
}

function QuickAction({ icon, label, hint, onPress, colors }: { icon: IconName; label: string; hint: string; onPress: () => void; colors: [string, string] }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.quick, { backgroundColor: p.panel, transform: [{ scale: pressed ? 0.96 : 1 }] }, lift(p)]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickIcon}>
        <Icon name={icon} size={19} color="#fff" />
      </LinearGradient>
      <T v="subhead" style={{ fontWeight: "700", marginTop: space.sm + 2 }} numberOfLines={1}>
        {label}
      </T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 1 }}>
        <T v="caption" tone="ink3" numberOfLines={1} style={{ fontWeight: "400", fontSize: 11, flexShrink: 1 }}>
          {hint}
        </T>
        <Icon name="chevron-forward" size={11} color={p.ink4} />
      </View>
    </Pressable>
  );
}

// How much of each list Home shows. The rest is a tap away, on its own screen.
const SHOWN = { favorites: 5, recent: 5, pages: 6 };

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pages = usePages((x) => x);
  const sync = useSyncStatus();
  const auth = usePhoneAuth();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [grid, setGrid] = useState(false);
  const [searching, setSearching] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const open = (page: Page) => router.push({ pathname: "/page/[id]", params: { id: page.id } });
  const actions = (page: Page) => openPageActions(router, page);

  const favorites = useMemo(() => favoritePages(pages), [pages]);
  // One more than shown, to know whether there are more.
  const recent = useMemo(() => recentPages(pages, SHOWN.recent), [pages]);
  const liveCount = useMemo(() => Object.values(pages).filter((x) => !x.deletedAt).length, [pages]);
  const children = useMemo(() => childIndex(pages), [pages]);
  const rows = useMemo(() => treeRows(children), [children]);
  const tops = children.get(null) ?? [];
  const tags = useMemo(() => tagIndex(pages).slice(0, 12), [pages]);
  const trashed = trashRoots(pages).length;
  const hits = useMemo(() => (q.trim() ? searchPages(pages, q, 30) : []), [pages, q]);
  const tagged = tag ? pagesWithTag(pages, tag) : [];
  const name = firstName(auth.account);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const title = { fontSize: 34, lineHeight: 40, fontWeight: "800" as const, letterSpacing: -1 };

  const status: { icon: IconName; text: string; color: string } =
    sync.state === "synced"
      ? { icon: "cloud-done-outline", text: "All changes synced", color: p.ok }
      : sync.state === "syncing"
        ? { icon: "sync-outline", text: "Syncing…", color: p.accent }
        : sync.state === "offline"
          ? { icon: "cloud-offline-outline", text: "Offline · saved on this phone", color: p.ink3 }
          : sync.state === "error"
            ? { icon: "alert-circle-outline", text: "Sync paused", color: p.warn }
            : { icon: "phone-portrait-outline", text: "Saved on this phone", color: p.ink3 };

  return (
    <View style={{ flex: 1 }}>
      <Background />
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 120, paddingHorizontal: space.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.brandRow}>
          <BrandMark size={26} />
          <T v="headline" style={{ fontWeight: "800", fontSize: 20, letterSpacing: -0.5, flex: 1 }}>
            Dovli
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings and account"
            onPress={() => router.push("/settings")}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Avatar name={auth.account?.name} email={auth.account?.email} photo={auth.account?.photoURL} size={38} ring />
          </Pressable>
        </View>

        {/* Greeting, with a little picture beside it */}
        <View style={{ marginTop: space.xl }}>
          <HeroArt />
          <T v="footnote" tone="ink3" style={{ fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 }}>
            {today}
          </T>
          <T accessibilityRole="header" style={[title, { color: p.ink, marginTop: 4 }]}>
            {greeting()}
            {name ? "," : ""}
          </T>
          {name ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessible accessibilityLabel={name}>
              <GradientText style={title} colors={p.dark ? ["#9CC6FF", "#B9A8FF"] : ["#4F6BF2", "#8B5CF6"]}>
                {name}
              </GradientText>
              <T style={{ fontSize: 28 }}>👋</T>
            </View>
          ) : null}
          <T v="callout" tone="ink3" style={{ marginTop: space.sm, maxWidth: "72%" }}>
            Capture your thoughts, organize ideas and make progress.
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${status.text}. Open your account`}
            onPress={() => router.push("/account")}
            style={({ pressed }) => [styles.statusPill, { backgroundColor: p.panel, opacity: pressed ? 0.75 : 1 }, lift(p)]}
          >
            <Icon name={status.icon} size={15} color={status.color} />
            <T v="footnote" tone="ink2" style={{ fontWeight: "500" }}>
              {status.text}
            </T>
            <Icon name="chevron-forward" size={13} color={p.ink4} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.search, { backgroundColor: p.panel, borderColor: searching ? p.accent : "transparent", borderWidth: 1.5 }, lift(p)]}>
          <Icon name="search" size={19} color={searching ? p.accent : p.ink3} />
          <TextInput
            value={q}
            onChangeText={(v) => {
              setQ(v);
              if (v) setTag(null);
            }}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            placeholder="Search pages and tasks…"
            placeholderTextColor={p.ink4}
            accessibilityLabel="Search pages"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
            style={{ flex: 1, color: p.ink, fontSize: 16, paddingVertical: 14 }}
          />
          {q ? <IconButton label="Clear search" icon="close-circle" size={18} color={p.ink3} onPress={() => setQ("")} /> : null}
        </View>

        {q.trim() ? (
          <>
            <SectionHeader title={`${hits.length} ${hits.length === 1 ? "result" : "results"}`} />
            {hits.length ? (
              <Card>
                {hits.map((h, i) => (
                  <PageRow key={h.page.id} page={h.page} first={i === 0} meta={h.snippet?.text} onPress={() => open(h.page)} onLongPress={() => actions(h.page)} />
                ))}
              </Card>
            ) : (
              <Empty icon="search-outline" title="No pages match" text="Try a different word, or check the spelling." />
            )}
          </>
        ) : (
          <>
            {/* Quick ways to start */}
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
              <QuickAction icon="create-outline" label="New page" hint="Blank page" colors={["#A78BFA", "#7C5CF0"]} onPress={() => open(store.createPage())} />
              <QuickAction
                icon="checkbox-outline"
                label="To-do list"
                hint="Checklist"
                colors={["#34D399", "#10B981"]}
                onPress={() => open(store.createPage({ title: "To-do list", mark: "☑", blocks: [{ type: "checkListItem", props: { checked: false }, content: [] }] }))}
              />
              <QuickAction icon="sunny-outline" label="Journal" hint="Daily note" colors={["#FCD34D", "#F59E0B"]} onPress={() => openJournal(open)} />
              <QuickAction icon="grid-outline" label="Templates" hint="Browse" colors={["#60A5FA", "#3B82F6"]} onPress={() => router.push("/templates")} />
            </View>

            {favorites.length > 0 && (
              <>
                <SectionHeader
                  title="Favourites"
                  action={favorites.length > SHOWN.favorites ? `View all ${favorites.length}` : undefined}
                  onAction={() => router.push("/favorites")}
                />
                <View style={{ gap: space.sm + 2 }}>
                  {favorites.slice(0, SHOWN.favorites).map((f) => (
                    <FavoriteCard key={f.id} page={f} onPress={() => open(f)} onLongPress={() => actions(f)} />
                  ))}
                </View>
              </>
            )}

            <SectionHeader title="Recent" />
            {recent.length ? (
              <Card>
                {recent.map((pg, i) => (
                  <PageRow key={pg.id} page={pg} first={i === 0} onPress={() => open(pg)} onLongPress={() => actions(pg)} />
                ))}
              </Card>
            ) : (
              <Empty icon="document-text-outline" title="No pages yet" text="Tap New page to start writing." />
            )}

            {tags.length > 0 && (
              <>
                <SectionHeader title="Tags" action={tag ? "Clear" : undefined} onAction={() => setTag(null)} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {tags.map((t) => {
                    const on = tag === t.tag;
                    return (
                      <Pressable
                        key={t.tag}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          tap("select");
                          setTag(on ? null : t.tag);
                        }}
                        style={[styles.tag, { backgroundColor: on ? p.accent : p.panel }, !on && lift(p)]}
                      >
                        <T v="footnote" style={{ color: on ? p.accentInk : p.ink2, fontWeight: "600" }}>
                          #{t.tag}
                        </T>
                        <T v="caption" style={{ color: on ? p.accentInk : p.ink4 }}>
                          {t.pages.length}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
                {tag && (
                  <Card style={{ marginTop: space.md }}>
                    {tagged.map((pg, i) => (
                      <PageRow key={pg.id} page={pg} first={i === 0} onPress={() => open(pg)} onLongPress={() => actions(pg)} />
                    ))}
                  </Card>
                )}
              </>
            )}

            <View style={styles.allHeader}>
              <T v="title3" accessibilityRole="header" style={{ flex: 1 }}>
                All pages
              </T>
              <ViewToggle grid={grid} onChange={setGrid} />
            </View>
            {grid ? (
              <PageGrid tops={tops.slice(0, SHOWN.pages)} children={children} open={open} actions={actions} />
            ) : (
              <PageTree rows={rows.slice(0, SHOWN.pages)} open={open} actions={actions} />
            )}
            {(grid ? tops.length : rows.length) > SHOWN.pages && <ViewAllButton label={`View all ${liveCount} pages`} onPress={() => router.push("/pages")} />}

            {/* The trash: at the end of the list, where it's out of the way. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Trash, ${trashed ? `${trashed} ${trashed === 1 ? "page" : "pages"}` : "empty"}`}
              onPress={() => router.push("/trash")}
              style={({ pressed }) => [styles.trashRow, { backgroundColor: pressed ? p.hover : p.panel }, lift(p)]}
            >
              <Icon name="trash-outline" size={18} color={p.ink3} />
              <T v="callout" tone="ink2" style={{ flex: 1 }}>
                Trash
              </T>
              <T v="footnote" tone="ink3">
                {trashed ? `${trashed} ${trashed === 1 ? "page" : "pages"}` : "Empty"}
              </T>
              <Icon name="chevron-forward" size={15} color={p.ink4} />
            </Pressable>
          </>
        )}
      </Animated.ScrollView>

      {/* Once the page scrolls, content passes under a soft fade instead of straight under the clock.
          At the top it stays hidden, so the header keeps the background's colour. */}
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 16, opacity: scrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: "clamp" }) }}
      >
        <LinearGradient colors={[p.bg, `${p.bg}00`]} locations={[0.6, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* New page floats at the bottom, over the list. */}
      {!searching && !q.trim() && (
        <View style={[styles.dock, { bottom: insets.bottom + space.md }]} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New page"
            onPress={() => {
              tap();
              open(store.createPage());
            }}
            style={({ pressed }) => [styles.newButton, { backgroundColor: p.primary, shadowColor: p.primary }, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
          >
            <Icon name="create-outline" size={19} color={p.primaryInk} />
            <T v="callout" style={{ color: p.primaryInk, fontWeight: "700" }}>
              New page
            </T>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const p = usePalette();
  return (
    <Card style={{ alignItems: "center", paddingVertical: space.xxl, paddingHorizontal: space.xl }}>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: p.accentSoft }}>
          <Icon name={icon} size={26} color={p.accent} />
        </View>
        <T v="headline" style={{ marginTop: space.md }}>
          {title}
        </T>
        <T v="subhead" tone="ink3" style={{ textAlign: "center", marginTop: 4 }}>
          {text}
        </T>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm + 2, minHeight: 44 },

  art: { position: "absolute", right: -4, top: -8, width: 150, height: 150 },
  artCard: { position: "absolute", width: 96, height: 112, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  artFront: { left: 26, top: 14, padding: 7, transform: [{ rotate: "-6deg" }] },
  artPhoto: { flex: 1, borderRadius: 12, overflow: "hidden" },
  peak: { position: "absolute", width: 60, height: 60, transform: [{ rotate: "45deg" }] },
  artNote: { position: "absolute", right: -2, top: -4, alignItems: "flex-end" },
  hand: { fontFamily: Platform.select({ ios: "Noteworthy-Light", android: "casual" }), fontSize: 12, lineHeight: 15, textAlign: "right" },

  statusPill: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", marginTop: space.lg, paddingHorizontal: 13, height: 34, borderRadius: 999 },
  search: { marginTop: space.lg, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: space.lg, paddingRight: 4, borderRadius: 18 },
  quick: { flex: 1, paddingVertical: 11, paddingHorizontal: 9, borderRadius: 18 },
  quickIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  favorite: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md + 2, borderRadius: 18 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999 },
  allHeader: { flexDirection: "row", alignItems: "center", marginTop: space.xl, marginBottom: space.sm + 2, paddingHorizontal: 4 },
  toggle: { flexDirection: "row", padding: 3, borderRadius: 12, gap: 2 },
  toggleBtn: { width: 36, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm + 2 },
  tile: { width: "48.5%", minHeight: 132, padding: 14, borderRadius: 18 },
  dock: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  trashRow: { marginTop: space.xl, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 52, borderRadius: 16 },
  more: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.sm, marginTop: space.md },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: space.lg, borderRadius: 999 },
  newButton: { minHeight: 52, flexDirection: "row", gap: 7, paddingHorizontal: space.xl, borderRadius: 999, alignItems: "center", justifyContent: "center", shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
});
