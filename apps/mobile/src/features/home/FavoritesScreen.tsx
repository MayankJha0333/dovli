// Every favourite, from Home's "View all". Long lists load a screenful at a time.

import { useDeferredValue, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { favoritePages, searchPages, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { openPageActions } from "@/components/Pages";
import { Header, T } from "@/components/ui";
import { usePages } from "@/lib/store";
import { FavoriteCard, MoreButton, SearchField, SearchResults } from "./lists";

const PAGE = 20;

export function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pages = usePages((x) => x);
  const favorites = useMemo(() => favoritePages(pages), [pages]);
  const [limit, setLimit] = useState(PAGE);
  const [q, setQ] = useState("");
  // Typing stays smooth on big lists: the search catches up a moment later.
  const query = useDeferredValue(q);
  const hits = useMemo(() => (query.trim() ? searchPages(Object.fromEntries(favorites.map((f) => [f.id, f])), query, 500) : []), [favorites, query]);
  const open = (page: Page) => router.push({ pathname: "/page/[id]", params: { id: page.id } });

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.5} />
      <Header top={insets.top} title="Favourites" onBack={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <T v="subhead" tone="ink2" style={{ paddingHorizontal: space.xs, marginTop: space.xs, marginBottom: space.lg }}>
          {favorites.length ? `${favorites.length} ${favorites.length === 1 ? "page" : "pages"} you starred.` : "Star a page to keep it here."}
        </T>
        {favorites.length > 0 && <SearchField value={q} onChange={setQ} placeholder="Search favourites" />}
        {query.trim() ? (
          <SearchResults key={query} hits={hits} query={query} open={open} actions={(f) => openPageActions(router, f)} />
        ) : (
          <>
            <View style={{ gap: space.sm + 2 }}>
              {favorites.slice(0, limit).map((f) => (
                <FavoriteCard key={f.id} page={f} onPress={() => open(f)} onLongPress={() => openPageActions(router, f)} />
              ))}
            </View>
            <MoreButton shown={Math.min(limit, favorites.length)} total={favorites.length} step={PAGE} onMore={() => setLimit((n) => n + PAGE)} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
