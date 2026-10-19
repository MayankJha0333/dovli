// Trash: pages you deleted, kept for 30 days. Tap one to see it, then restore it or delete it for
// good. The little arrow restores in one tap. Emptying the trash asks first, right on the page.

import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { daysLeftInTrash, trashRoots } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { PageRow } from "@/components/Pages";
import { Button, Card, Header, Icon, T, tap, usePalette } from "@/components/ui";
import { store, usePages } from "@/lib/store";

export function TrashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pages = usePages((x) => x);
  const list = trashRoots(pages);
  const [confirm, setConfirm] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.5} />
      <Header top={insets.top} title="Trash" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <T v="subhead" tone="ink2" style={{ paddingHorizontal: space.xs, marginTop: space.xs, marginBottom: space.lg }}>
          Pages stay here for 30 days, then they're deleted for good. Tap one to look inside, or the arrow to bring it back.
        </T>
        {list.length ? (
          <>
            <Card>
              {list.map((pg, i) => {
                const left = daysLeftInTrash(pg);
                return (
                  <PageRow
                    key={pg.id}
                    page={pg}
                    first={i === 0}
                    meta={`${left} ${left === 1 ? "day" : "days"} left`}
                    onPress={() => router.push({ pathname: "/page/[id]", params: { id: pg.id } })}
                    right={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Restore ${pg.title || "Untitled"}`}
                        hitSlop={10}
                        onPress={() => {
                          store.restorePages([pg.id]);
                          tap("success");
                        }}
                        style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? p.hover : p.accentSoft })}
                      >
                        <Icon name="arrow-undo-outline" size={17} color={p.accent} />
                      </Pressable>
                    }
                  />
                );
              })}
            </Card>
            {confirm ? (
              <View style={{ marginTop: space.xl, borderRadius: 16, padding: space.lg, backgroundColor: p.dangerSoft }}>
                <T v="callout">
                  <T v="callout" style={{ fontWeight: "700" }}>
                    Delete {list.length} {list.length === 1 ? "page" : "pages"} for good?
                  </T>{" "}
                  {list.length === 1 ? "It's" : "They're"} removed from your account on every device. This can't be undone.
                </T>
                <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                  <Button title="Cancel" tone="secondary" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
                  <Button
                    title="Delete for good"
                    tone="danger"
                    onPress={() => {
                      store.emptyTrash();
                      tap("success");
                      setConfirm(false);
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <Button title="Empty trash" tone="danger" icon="trash-outline" onPress={() => setConfirm(true)} style={{ marginTop: space.xl }} />
            )}
          </>
        ) : (
          <Card style={{ alignItems: "center", paddingVertical: space.xxxl }}>
            <View style={{ alignItems: "center" }}>
              <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: p.well, alignItems: "center", justifyContent: "center" }}>
                <Icon name="trash-outline" size={28} color={p.ink3} />
              </View>
              <T v="headline" style={{ marginTop: space.md }}>
                Trash is empty
              </T>
              <T v="subhead" tone="ink3" style={{ marginTop: 4 }}>
                Pages you delete show up here.
              </T>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
