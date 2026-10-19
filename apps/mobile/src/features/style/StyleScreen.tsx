// A page's Style, as a sheet from its ⋯ menu: the same choices as the web app's Style panel.
// The panel itself is a small web page (dom/StylePanelDom.tsx), since page styles are CSS art.

import { memo, useCallback } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayTitle, type PageLook } from "@dovli/core";
import { space } from "@dovli/theme";
import { IconButton, T, tap, usePalette } from "@/components/ui";
import StylePanelDom from "@/dom/StylePanelDom";
import { store, usePages } from "@/lib/store";

const Panel = memo(StylePanelDom);
const PANEL_DOM = { style: { flex: 1, backgroundColor: "transparent" }, scrollEnabled: true, contentInsetAdjustmentBehavior: "never" } as any;

export function StyleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const page = usePages((x) => x[id]);

  const onSetStyle = useCallback(async (style: string | null) => {
    tap("select");
    store.updatePage(id, { style: style ?? undefined });
  }, [id]);
  const onSetLook = useCallback(async (look: PageLook | null) => store.updatePage(id, { look: look ?? undefined }), [id]);
  const onSetCover = useCallback(async (cover: string | null) => {
    tap("select");
    store.updatePage(id, { cover });
  }, [id]);

  if (!page) return null;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="headline">Style</T>
          <T v="footnote" tone="ink3" numberOfLines={1}>
            Changes only {page.mark} {displayTitle(page)}. Your app theme stays the same.
          </T>
        </View>
        <IconButton label="Close" icon="close" color={p.ink2} onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <Panel
          styleId={page.style ?? null}
          look={page.look ?? null}
          cover={page.cover ?? null}
          themeId={p.t.id}
          onSetStyle={onSetStyle}
          onSetLook={onSetLook}
          onSetCover={onSetCover}
          dom={PANEL_DOM}
        />
      </View>
    </View>
  );
}
