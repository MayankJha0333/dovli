// Every page, from Home's "View all": the page tree (or a grid of top-level pages). Big
// workspaces load in steps with Show more, so thousands of pages never draw at once.

import { useDeferredValue, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { searchPages, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { openPageActions } from "@/components/Pages";
import { Header, T } from "@/components/ui";
import { usePages } from "@/lib/store";
import { MoreButton, PageGrid, PageTree, SearchField, SearchResults, ViewToggle, childIndex, treeRows } from "./lists";

const PAGE = 30;

export function AllPagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pages = usePages((x) => x);
  const children = useMemo(() => childIndex(pages), [pages]);
  const rows = useMemo(() => treeRows(children), [children]);
  const tops = children.get(null) ?? [];
  const live = useMemo(() => Object.values(pages).filter((x) => !x.deletedAt).length, [pages]);
  const [grid, setGrid] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [q, setQ] = useState("");
  // Typing stays smooth on big workspaces: the search catches up a moment later.
  const query = useDeferredValue(q);
  const hits = useMemo(() => (query.trim() ? searchPages(pages, query, 500) : []), [pages, query]);
  const open = (page: Page) => router.push({ pathname: "/page/[id]", params: { id: page.id } });
  const actions = (page: Page) => openPageActions(router, page);
  const total = grid ? tops.length : rows.length;

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.5} />
      <Header top={insets.top} title="All pages" onBack={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <SearchField value={q} onChange={setQ} placeholder="Search all pages" />
        {query.trim() ? (
          <SearchResults key={query} hits={hits} query={query} open={open} actions={actions} />
        ) : (
          <>
            <View style={styles.bar}>
              <T v="subhead" tone="ink2" style={{ flex: 1 }}>
                {live} {live === 1 ? "page" : "pages"}
              </T>
              <ViewToggle grid={grid} onChange={setGrid} />
            </View>
            {grid ? (
              <PageGrid tops={tops.slice(0, limit)} children={children} open={open} actions={actions} />
            ) : (
              <PageTree rows={rows.slice(0, limit)} open={open} actions={actions} />
            )}
            <MoreButton shown={Math.min(limit, total)} total={total} step={PAGE} onMore={() => setLimit((n) => n + PAGE)} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", marginTop: space.xs, marginBottom: space.md, paddingHorizontal: space.xs },
});
