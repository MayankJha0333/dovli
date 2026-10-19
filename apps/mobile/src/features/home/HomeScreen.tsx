// Home: a greeting, search, quick ways to start, your favourites, what you opened lately, every
// page as a tree (pages inside pages, like the web sidebar), tags, and the trash.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { childrenOf, favoritePages, pagesWithTag, recentPages, searchPages, tagIndex, templates, trashRoots, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { Glass } from "@/components/Glass";
import { PageCard, PageRow } from "@/components/Pages";
import { Avatar, BrandMark, Card, Icon, IconButton, SectionHeader, T, lift, tap, usePalette, type IconName } from "@/components/ui";
import { firstName, usePhoneAuth } from "@/lib/auth";
import { store, usePages } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";

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

function QuickAction({ icon, label, hint, onPress, tint, ink = "#fff" }: { icon: IconName; label: string; hint: string; onPress: () => void; tint: string; ink?: string }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.quick, { backgroundColor: p.panel, borderRadius: p.radius.lg + 2, transform: [{ scale: pressed ? 0.97 : 1 }] }, lift(p)]}
    >
      <View style={[styles.quickIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={19} color={ink} />
      </View>
      <T v="subhead" style={{ fontWeight: "700", marginTop: space.sm + 2 }} numberOfLines={1}>
        {label}
      </T>
      <T v="caption" tone="ink3" numberOfLines={1} style={{ fontWeight: "400", marginTop: 1 }}>
        {hint}
      </T>
    </Pressable>
  );
}

/** Every page as a tree: top-level pages, with their pages inside when opened. */
function PageTree({ pages, open }: { pages: Record<string, Page>; open: (p: Page) => void }) {
  const rows: { page: Page; depth: number; count: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const page of childrenOf(pages, parentId)) {
      const count = childrenOf(pages, page.id).length;
      rows.push({ page, depth, count });
      if (page.expanded && count && depth < 4) walk(page.id, depth + 1);
    }
  };
  walk(null, 0);
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
          meta={count ? `${count} ${count === 1 ? "page" : "pages"} inside` : page.kind === "board" ? "Whiteboard" : ""}
        />
      ))}
    </Card>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pages = usePages((x) => x);
  const sync = useSyncStatus();
  const auth = usePhoneAuth();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [allRecent, setAllRecent] = useState(false);
  const [searching, setSearching] = useState(false);
  const open = (page: Page) => router.push({ pathname: "/page/[id]", params: { id: page.id } });

  const favorites = favoritePages(pages);
  const recent = recentPages(pages, allRecent ? 20 : 5);
  const tags = useMemo(() => tagIndex(pages).slice(0, 12), [pages]);
  const trashed = trashRoots(pages).length;
  const hits = useMemo(() => (q.trim() ? searchPages(pages, q, 30) : []), [pages, q]);
  const tagged = tag ? pagesWithTag(pages, tag) : [];
  const name = firstName(auth.account);
  const signedIn = auth.status === "signed-in";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

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
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: 140, paddingHorizontal: space.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.brandRow}>
          <BrandMark size={24} />
          <T v="headline" style={{ fontWeight: "800", fontSize: 18.5, letterSpacing: -0.4, flex: 1 }}>
            Dovli
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings and account"
            onPress={() => router.push("/settings")}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {signedIn ? (
              <Avatar name={auth.account?.name} email={auth.account?.email} size={34} />
            ) : (
              <View style={[styles.roundBtn, { backgroundColor: p.panel }, lift(p)]}>
                <Icon name="settings-outline" size={18} color={p.ink2} />
              </View>
            )}
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={{ marginTop: space.xl }}>
          <T v="footnote" tone="ink3" style={{ fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 }}>
            {today}
          </T>
          <T v="largeTitle" accessibilityRole="header" style={{ marginTop: 4 }}>
            {name ? `${greeting()},\n${name}` : greeting()}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${status.text}. Open sync settings`}
            onPress={() => router.push("/settings")}
            style={[styles.statusPill, { backgroundColor: p.panel }, lift(p)]}
          >
            <Icon name={status.icon} size={13} color={status.color} />
            <T v="caption" tone="ink2">
              {status.text}
            </T>
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.search, { backgroundColor: p.panel, borderColor: searching ? p.accent : "transparent", borderWidth: 1.5 }, lift(p)]}>
          <Icon name="search" size={18} color={searching ? p.accent : p.ink3} />
          <TextInput
            value={q}
            onChangeText={(v) => {
              setQ(v);
              if (v) setTag(null);
            }}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            placeholder="Search pages"
            placeholderTextColor={p.ink4}
            accessibilityLabel="Search pages"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
            style={{ flex: 1, color: p.ink, fontSize: 16, paddingVertical: 13 }}
          />
          {q ? <IconButton label="Clear search" icon="close-circle" size={18} color={p.ink3} onPress={() => setQ("")} /> : null}
        </View>

        {q.trim() ? (
          <>
            <SectionHeader title={`${hits.length} ${hits.length === 1 ? "result" : "results"}`} />
            {hits.length ? (
              <Card>
                {hits.map((h, i) => (
                  <PageRow key={h.page.id} page={h.page} first={i === 0} meta={h.snippet?.text} onPress={() => open(h.page)} />
                ))}
              </Card>
            ) : (
              <Empty icon="search-outline" title="No pages match" text="Try a different word, or check the spelling." />
            )}
          </>
        ) : (
          <>
            {/* Quick ways to start */}
            <View style={{ flexDirection: "row", gap: space.sm + 2, marginTop: space.lg }}>
              <QuickAction
                icon="checkbox-outline"
                label="To-do list"
                hint="Quick checklist"
                tint={p.accent}
                ink={p.accentInk}
                onPress={() => open(store.createPage({ title: "To-do list", mark: "☑", blocks: [{ type: "checkListItem", props: { checked: false }, content: [] }] }))}
              />
              <QuickAction icon="sunny-outline" label="Journal" hint="Today's page" tint="#F59E0B" onPress={() => openJournal(open)} />
              <QuickAction icon="grid-outline" label="Templates" hint="Notes, plans…" tint="#10B981" onPress={() => router.push("/templates")} />
            </View>

            {/* Not signed in: one gentle nudge to back up. */}
            {auth.status === "signed-out" && (
              <Pressable onPress={() => router.push("/sign-in")} accessibilityRole="button" style={[styles.nudge, { backgroundColor: p.accentSoft }]}>
                <Icon name="cloud-upload-outline" size={20} color={p.accent} />
                <View style={{ flex: 1 }}>
                  <T v="subhead" style={{ fontWeight: "700" }}>
                    Back up your pages
                  </T>
                  <T v="caption" tone="ink2" style={{ fontWeight: "400" }}>
                    Sign in to sync with the web and your other devices.
                  </T>
                </View>
                <Icon name="chevron-forward" size={16} color={p.accent} />
              </Pressable>
            )}

            {favorites.length > 0 && (
              <>
                <SectionHeader title="Favourites" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: 6, gap: space.md }}>
                  {favorites.map((f) => (
                    <PageCard key={f.id} page={f} onPress={() => open(f)} />
                  ))}
                </ScrollView>
              </>
            )}

            <SectionHeader title="Recent" action={allRecent ? "Show less" : "Show more"} onAction={recentPages(pages, 6).length > 5 ? () => setAllRecent((v) => !v) : undefined} />
            {recent.length ? (
              <Card>
                {recent.map((pg, i) => (
                  <PageRow key={pg.id} page={pg} first={i === 0} onPress={() => open(pg)} />
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
                      <PageRow key={pg.id} page={pg} first={i === 0} onPress={() => open(pg)} />
                    ))}
                  </Card>
                )}
              </>
            )}

            <SectionHeader title="All pages" />
            <PageTree pages={pages} open={open} />

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/trash")}
              style={({ pressed }) => [styles.trashRow, { backgroundColor: pressed ? p.hover : "transparent" }]}
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
      </ScrollView>

      {/* Content scrolls under a soft fade, not straight under the clock. */}
      <LinearGradient pointerEvents="none" colors={[p.bg, `${p.bg}00`]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 34 }} locations={[0.55, 1]} />

      {!searching && !q.trim() && (
      <View style={[styles.dock, { bottom: insets.bottom + space.md }]} pointerEvents="box-none">
        <Glass style={{ borderRadius: 999, padding: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New page"
            onPress={() => {
              tap();
              open(store.createPage());
            }}
            style={({ pressed }) => [styles.newButton, { backgroundColor: p.primary }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <Icon name="create-outline" size={19} color={p.primaryInk} />
            <T v="callout" style={{ color: p.primaryInk, fontWeight: "700" }}>
              New page
            </T>
          </Pressable>
        </Glass>
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
  roundBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: space.md, paddingHorizontal: 11, height: 28, borderRadius: 999 },
  search: { marginTop: space.lg, minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: space.md + 2, paddingRight: 2, borderRadius: 16 },
  quick: { flex: 1, padding: 13 },
  quickIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  nudge: { marginTop: space.lg, borderRadius: 16, padding: space.md + 2, flexDirection: "row", alignItems: "center", gap: space.md },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999 },
  trashRow: { marginTop: space.lg, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 48, borderRadius: 14 },
  dock: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  newButton: { minHeight: 50, flexDirection: "row", gap: 7, paddingHorizontal: space.xl, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
