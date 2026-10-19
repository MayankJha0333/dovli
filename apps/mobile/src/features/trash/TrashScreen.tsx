// Trash: pages you deleted, kept for 30 days. Restore one, delete one for good, or empty it.

import { Alert, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { daysLeftInTrash, descendantIds, displayTitle, trashRoots, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { PageRow } from "@/components/Pages";
import { Button, Card, Header, Icon, T, tap, usePalette } from "@/components/ui";
import { store, usePages } from "@/lib/store";

// Run a change just after an alert closes. A change made inside the alert's own callback isn't
// always drawn until the next touch on iOS.
const afterAlert = (fn: () => void) => () => setTimeout(fn, 0);

export function TrashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pages = usePages((x) => x);
  const list = trashRoots(pages);

  const act = (page: Page) => {
    const inside = descendantIds(pages, page.id).length;
    Alert.alert(displayTitle(page), inside ? `${inside} ${inside === 1 ? "page" : "pages"} inside it come back too.` : undefined, [
      {
        text: "Restore",
        onPress: afterAlert(() => {
          store.restorePages([page.id]);
          tap("success");
        }),
      },
      {
        text: "Delete for good",
        style: "destructive",
        onPress: () =>
          Alert.alert("Delete for good?", "This can't be undone. It's removed from your account on every device.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: afterAlert(() => store.deleteForever([page.id])) },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const emptyAll = () =>
    Alert.alert("Empty the trash?", `${list.length} ${list.length === 1 ? "page is" : "pages are"} deleted for good, on every device. This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Empty trash", style: "destructive", onPress: afterAlert(() => store.emptyTrash()) },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.5} />
      <Header top={insets.top} title="Trash" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <T v="subhead" tone="ink2" style={{ paddingHorizontal: space.xs, marginTop: space.xs, marginBottom: space.lg }}>
          Pages stay here for 30 days, then they're deleted for good. Tap one to restore it.
        </T>
        {list.length ? (
          <>
            <Card>
              {list.map((pg, i) => {
                const left = daysLeftInTrash(pg);
                return <PageRow key={pg.id} page={pg} first={i === 0} meta={`${left} ${left === 1 ? "day" : "days"} left`} onPress={() => act(pg)} right={<Icon name="arrow-undo-outline" size={17} color={p.accent} />} />;
              })}
            </Card>
            <Button title="Empty trash" tone="danger" icon="trash-outline" onPress={emptyAll} style={{ marginTop: space.xl }} />
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
