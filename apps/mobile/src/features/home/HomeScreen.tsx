// Home: a greeting, search, two big ways to start, how your to-dos are going, shortcuts, your
// favourites, what you opened lately, tags, and every page as a tree or a grid (pages inside pages,
// like the web sidebar). A dock at the bottom keeps New page and the main lists in reach.

import { useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance, type TextInputInstance } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { favoritePages, pagesWithTag, recentPages, searchPages, tagIndex, templates, todoItems, trashRoots, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { PageRow, openPageActions } from "@/components/Pages";
import { Avatar, Card, Icon, IconButton, T, lift, tap, usePalette, type IconName } from "@/components/ui";
import { firstName, usePhoneAuth } from "@/lib/auth";
import { store, usePages } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import { NoteCard, PageGrid, PageTree, ViewAllButton, ViewToggle, childIndex, treeRows } from "./lists";

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

const newTodoList = () => store.createPage({ title: "To-do list", mark: "☑", blocks: [{ type: "checkListItem", props: { checked: false }, content: [] }] });

/** A round button in the top bar. */
function RoundButton({ icon, label, color, onPress }: { icon: IconName; label: string; color?: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={4}
      style={({ pressed }) => [styles.round, { backgroundColor: p.panel, borderColor: p.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={20} color={color ?? p.ink} />
    </Pressable>
  );
}

/** One of the two big coloured cards: "Create / New page". The shapes behind the text are decoration. */
function CreateCard({ label, colors, onPress }: { label: string; colors: [string, string]; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Create ${label}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.create, { shadowColor: colors[1], transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 26 }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 26, overflow: "hidden" }]}>
        <View style={[styles.shape, { right: -26, bottom: -30, width: 110, height: 110, transform: [{ rotate: "28deg" }] }]} />
        <View style={[styles.shape, { right: 30, bottom: -46, width: 80, height: 80, transform: [{ rotate: "-18deg" }] }]} />
        <View style={[styles.shape, { right: 18, top: 16, width: 26, height: 26, borderRadius: 13 }]} />
      </View>
      <View style={styles.plus}>
        <Icon name="add" size={22} color="#fff" />
      </View>
      <View style={{ marginTop: "auto" }}>
        <T v="subhead" style={{ color: "rgba(255,255,255,0.85)", fontWeight: "500" }}>
          Create
        </T>
        <T numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.6 }}>
          {label}
        </T>
      </View>
    </Pressable>
  );
}

/** A pastel tile with its name underneath, in the Shortcuts row. */
function Shortcut({ icon, label, color, wash, badge, onPress }: { icon: IconName; label: string; color: string; wash: string; badge?: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPress={() => {
        tap("select");
        onPress();
      }}
      style={({ pressed }) => [{ flex: 1, alignItems: "center", gap: 8, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      {/* On light themes a white tile lifts off the coloured background; the colour sits on the icon's pad. */}
      <View style={[styles.shortcut, p.dark ? { backgroundColor: `${color}26` } : [{ backgroundColor: p.panel }, lift(p)]]}>
        <View style={[styles.shortcutPad, { backgroundColor: p.dark ? "transparent" : wash }]}>
          <Icon name={icon} size={24} color={color} />
        </View>
      </View>
      <T v="footnote" tone="ink2" numberOfLines={1} style={{ fontWeight: "600" }}>
        {label}
      </T>
    </Pressable>
  );
}

/** A section title with a count under it and an optional action on the right ("See all"). */
function Heading({ title, count, action, onAction }: { title: string; count?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.heading}>
      <View style={{ flex: 1 }}>
        <T v="title" accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800" }}>
          {title}
        </T>
        {count ? (
          <T v="footnote" tone="ink3" style={{ marginTop: 1 }}>
            {count}
          </T>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}>
          <T v="subhead" tone="accent" style={{ fontWeight: "700" }}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

// How much of each list Home shows. The rest is a tap away, on its own screen.
const SHOWN = { favorites: 8, recent: 4, pages: 6 };

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
  const scroller = useRef<ScrollViewInstance>(null);
  const searchBox = useRef<TextInputInstance>(null);
  const open = (page: Page) => router.push({ pathname: "/page/[id]", params: { id: page.id } });
  const actions = (page: Page) => openPageActions(router, page);

  const favorites = useMemo(() => favoritePages(pages), [pages]);
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

  // Every to-do on every page, and the latest-edited page that still has some left, to jump back into.
  const todos = useMemo(() => {
    let done = 0;
    let total = 0;
    let next: Page | null = null;
    for (const page of Object.values(pages)) {
      if (page.deletedAt || page.kind === "board") continue;
      const items = todoItems(page);
      const left = items.filter((x) => !x.checked).length;
      total += items.length;
      done += items.length - left;
      if (left && (!next || page.updatedAt > next.updatedAt)) next = page;
    }
    return { done, total, next };
  }, [pages]);
  const progress = todos.total ? todos.done / todos.total : 0;

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

  const focusSearch = () => {
    scroller.current?.scrollTo({ y: 0, animated: true });
    searchBox.current?.focus();
  };

  return (
    <View style={{ flex: 1 }}>
      <Background />
      <Animated.ScrollView
        ref={scroller}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 120, paddingHorizontal: space.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar: you, and the round buttons */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name ? `Hi, ${name}. ` : ""}Open your account`}
            onPress={() => router.push("/account")}
            hitSlop={6}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar name={auth.account?.name} email={auth.account?.email} photo={auth.account?.photoURL} size={46} ring />
            <T v="callout" numberOfLines={1} style={{ fontWeight: "600", flexShrink: 1 }}>
              Hi{name ? `, ${name}` : " there"} 👋
            </T>
          </Pressable>
          <RoundButton icon={status.icon} label={`${status.text}. Open your account`} color={status.color} onPress={() => router.push("/account")} />
          <RoundButton icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
        </View>

        {/* Greeting */}
        <T accessibilityRole="header" style={[styles.title, { color: p.ink }]}>
          {greeting()}
        </T>
        <T v="callout" tone="ink3" style={{ marginTop: 2 }}>
          Today, {today}
        </T>

        {/* Search */}
        <View style={[styles.search, { backgroundColor: p.panel, borderColor: searching ? p.accent : p.line }, lift(p)]}>
          <Icon name="search" size={20} color={searching ? p.accent : p.ink3} />
          <TextInput
            ref={searchBox}
            value={q}
            onChangeText={(v) => {
              setQ(v);
              if (v) setTag(null);
            }}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            placeholder="Search pages, tasks, tags…"
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
            <Heading title={`${hits.length} ${hits.length === 1 ? "result" : "results"}`} />
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
            {/* Two big ways to start */}
            <View style={{ flexDirection: "row", gap: space.md, marginTop: space.xl }}>
              <CreateCard label="New Page" colors={["#B9A2FF", "#8A6CF4"]} onPress={() => open(store.createPage())} />
              <CreateCard label="To-do List" colors={["#FFD574", "#F5AC2E"]} onPress={() => open(newTodoList())} />
            </View>

            {/* How your to-dos are going */}
            {todos.total > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`To-dos: ${todos.done} of ${todos.total} done.${todos.next ? " Open the latest list with some left." : ""}`}
                disabled={!todos.next}
                onPress={() => todos.next && open(todos.next)}
                style={({ pressed }) => [styles.progressCard, { backgroundColor: p.panel, opacity: pressed ? 0.85 : 1 }, lift(p)]}
              >
                <View style={{ flex: 1 }}>
                  <T v="headline" style={{ fontWeight: "700" }}>
                    {todos.done === todos.total ? "All to-dos done" : "Your to-dos"}
                  </T>
                  <T v="footnote" tone="ink3" style={{ marginTop: 2 }}>
                    {todos.total - todos.done ? `${todos.total - todos.done} left to tick off` : "Nice work"}
                  </T>
                </View>
                <View style={{ width: "42%", alignItems: "flex-end", gap: 8 }}>
                  <View style={[styles.track, { backgroundColor: p.well }]}>
                    <LinearGradient
                      colors={["#A592FF", "#E39AEC", "#FFC48A"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: `${Math.max(progress * 100, 6)}%`, height: "100%", borderRadius: 999 }}
                    />
                  </View>
                  <T v="subhead" style={{ fontWeight: "600" }}>
                    {Math.round(progress * 100)}% Done
                  </T>
                </View>
              </Pressable>
            )}

            {/* Shortcuts */}
            <Heading title="Shortcuts" />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Shortcut icon="sunny" label="Journal" color="#F59E0B" wash="#FFEBC2" onPress={() => openJournal(open)} />
              <Shortcut icon="color-palette" label="Whiteboard" color="#3B82F6" wash="#D9E8FF" onPress={() => open(store.createPage({ kind: "board" }))} />
              <Shortcut icon="albums" label="Templates" color="#8B5CF6" wash="#E7DEFF" onPress={() => router.push("/templates")} />
              <Shortcut
                icon="trash"
                label="Trash"
                color="#EC4899"
                wash="#FFDDEB"
                badge={trashed ? `${trashed} ${trashed === 1 ? "page" : "pages"}` : "empty"}
                onPress={() => router.push("/trash")}
              />
            </View>

            {favorites.length > 0 && (
              <>
                <Heading
                  title="Favourites"
                  count={`${favorites.length} ${favorites.length === 1 ? "page" : "pages"}`}
                  action="See all"
                  onAction={() => router.push("/favorites")}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg, paddingBottom: 4 }}>
                  {favorites.slice(0, SHOWN.favorites).map((f, i) => (
                    <NoteCard key={f.id} page={f} index={i} onPress={() => open(f)} onLongPress={() => actions(f)} />
                  ))}
                </ScrollView>
              </>
            )}

            <Heading title="Recent notes" count={recent.length ? undefined : "Nothing yet"} action={liveCount > SHOWN.recent ? "View all" : undefined} onAction={() => router.push("/pages")} />
            {recent.length ? (
              <View style={{ gap: space.md }}>
                {recent.map((pg, i) => (
                  <NoteCard key={pg.id} page={pg} index={i + 1} wide onPress={() => open(pg)} onLongPress={() => actions(pg)} />
                ))}
              </View>
            ) : (
              <Empty icon="document-text-outline" title="No pages yet" text="Tap New Page to start writing." />
            )}

            {tags.length > 0 && (
              <>
                <Heading title="Tags" action={tag ? "Clear" : undefined} onAction={() => setTag(null)} />
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
              <T v="title" accessibilityRole="header" style={{ flex: 1, fontSize: 22, fontWeight: "800" }}>
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

      {/* The dock floats at the bottom, over the list. */}
      {!searching && !q.trim() && (
        <View style={[styles.dockWrap, { bottom: insets.bottom + space.md }]} pointerEvents="box-none">
          <View style={[styles.dock, { backgroundColor: p.dark ? p.raised : "#1F1840", borderColor: p.dark ? p.lineStrong : "transparent" }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New page"
              onPress={() => {
                tap();
                open(store.createPage());
              }}
              style={({ pressed }) => [styles.dockNew, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
            >
              <LinearGradient colors={["#A592FF", "#E39AEC", "#FFC48A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dockPlus}>
                <Icon name="add" size={22} color="#fff" />
              </LinearGradient>
              <T v="subhead" style={{ color: "#1F1840", fontWeight: "700" }}>
                New page
              </T>
            </Pressable>
            {(
              [
                ["search", "Search", focusSearch],
                ["star-outline", "Favourites", () => router.push("/favorites")],
                ["documents-outline", "All pages", () => router.push("/pages")],
              ] as const
            ).map(([icon, label, go]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => {
                  tap("select");
                  go();
                }}
                style={({ pressed }) => [styles.dockBtn, { backgroundColor: pressed ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)" }]}
              >
                <Icon name={icon} size={20} color="rgba(255,255,255,0.9)" />
              </Pressable>
            ))}
          </View>
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
  topBar: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 52 },
  round: { width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1, marginTop: space.xl },
  search: { marginTop: space.lg, minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: space.lg, paddingRight: 6, borderRadius: 999, borderWidth: 1 },

  create: { flex: 1, height: 168, padding: space.lg, borderRadius: 26, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  shape: { position: "absolute", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)" },
  plus: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.28)" },

  progressCard: { marginTop: space.lg, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: 24 },
  track: { width: "100%", height: 14, borderRadius: 999, overflow: "hidden" },

  heading: { flexDirection: "row", alignItems: "flex-end", marginTop: space.xl + 4, marginBottom: space.md, paddingHorizontal: 2 },
  shortcut: { width: "100%", aspectRatio: 1, maxWidth: 84, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  shortcutPad: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  tag: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999 },
  allHeader: { flexDirection: "row", alignItems: "center", marginTop: space.xl + 4, marginBottom: space.md, paddingHorizontal: 2 },

  dockWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#1F1840",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  dockNew: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingLeft: 5, paddingRight: 18, borderRadius: 999, backgroundColor: "#fff" },
  dockPlus: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  dockBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
