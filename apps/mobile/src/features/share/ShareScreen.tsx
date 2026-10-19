// Share a page, as a sheet from the page's ⋯ menu: a link anyone can open (to read, or to edit with
// a Dovli account), the same link the web app's Share window makes, or a PDF of the page.

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayTitle, type Page } from "@dovli/core";
import { space } from "@dovli/theme";
import { Button, Icon, IconButton, Row, Section, T, lift, tap, usePalette } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import BoardPrintDom from "@/dom/BoardPrintDom";
import PageEditorDom from "@/dom/PageEditorDom";
import { sharePdf } from "@/lib/pdf";
import { apiUrl } from "@/lib/firebase";
import { store, usePages } from "@/lib/store";
import { syncNow } from "@/lib/sync";

type Role = "viewer" | "editor";
interface Link {
  id: string;
  role: Role;
  enabled: boolean;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ask the server about this page's sharing. A page made a moment ago may not have reached the
 *  account yet ("not_synced"): sync, give it a moment, and ask again, as the web app does. */
async function share<T>(pageId: string, body: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api<T>("/api/share", { body: { pageId, ...body } });
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== "not_synced" || attempt >= 3) throw e;
      syncNow();
      await wait(2000);
    }
  }
}

const linkUrl = (id: string) => `${apiUrl}/s/${id}`;

const PageForPrint = memo(PageEditorDom);
const BoardForPrint = memo(BoardPrintDom);
const noop = async () => {};
// The print copy draws out of sight; it's read, never shown.
const PRINT_DOM = { style: { flex: 1, backgroundColor: "transparent" }, scrollEnabled: false } as any;

/** Draws the page out of sight, once, and hands back its HTML for the PDF. */
function PrintCopy({ page, onHtml }: { page: Page; onHtml: (html: string) => Promise<void> }) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const others = useMemo(
    () =>
      Object.values(store.getPages())
        .filter((o) => o.id !== page.id)
        .map(({ id, title, mark, kind, parentId, deletedAt, createdAt, order }) => ({ id, title, mark, kind, parentId, deletedAt, createdAt, order, updatedAt: createdAt })),
    [page.id],
  );
  return (
    <View pointerEvents="none" style={[styles.printCopy, { width }]}>
      {page.kind === "board" ? (
        <BoardForPrint board={page.board ?? {}} title={displayTitle(page)} mark={page.mark} onPrint={onHtml} dom={PRINT_DOM} />
      ) : (
        <PageForPrint
          page={page}
          others={others}
          themeId={p.t.id}
          background="#ffffff"
          mark={page.mark}
          cover={page.cover ?? null}
          path={[]}
          meta=""
          topInset={0}
          bottomInset={0}
          readOnly
          onTitleChange={noop}
          onOpenInfo={noop}
          onTitleHidden={noop}
          onSave={noop}
          onOpenPage={noop}
          onCreatePage={noop}
          onPrint={onHtml}
          dom={PRINT_DOM}
        />
      )}
    </View>
  );
}

const ROLES: { role: Role; label: string; icon: React.ComponentProps<typeof Icon>["name"]; text: string }[] = [
  { role: "viewer", label: "Can view", icon: "eye-outline", text: "Anyone with the link can read it. No account needed." },
  { role: "editor", label: "Can edit", icon: "create-outline", text: "Anyone with the link can edit it. Editing needs a Dovli account." },
];

export function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const page = usePages((x) => x[id]);
  const [link, setLink] = useState<Link | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The page as it is when "Send as PDF" is tapped, drawn out of sight until its PDF is ready.
  const [printing, setPrinting] = useState<Page | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const onHtml = useCallback(
    async (html: string) => {
      try {
        await sharePdf(html, displayTitle(store.getPages()[id] ?? { title: "", kind: "doc" }));
      } catch (e) {
        setPdfError((e as Error).message || "Couldn't make the PDF. Please try again.");
        tap("error");
      } finally {
        setPrinting(null);
      }
    },
    [id],
  );
  // If the page never finishes drawing, don't spin for ever.
  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => {
      setPrinting(null);
      setPdfError("Making the PDF took too long. Please try again.");
    }, 25_000);
    return () => clearTimeout(t);
  }, [printing]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await share<{ link: Link | null }>(id, { action: "settings" });
      setLink(s.link);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  /** Turn the link on or off, change what it allows, or make a new one. */
  const change = async (opts: { enabled?: boolean; role?: Role; reset?: boolean }) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setLink(await share<Link>(id, { action: "link", ...opts }));
      tap("success");
    } catch (e) {
      setError((e as Error).message);
      tap("error");
    } finally {
      setBusy(false);
    }
  };

  if (!page) return null;
  const on = !!link?.enabled;
  const role = link?.role ?? "viewer";
  const url = link ? linkUrl(link.id) : "";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: insets.bottom + space.lg }}>
      <View style={styles.head}>
        <View style={[styles.headIcon, { backgroundColor: p.accentSoft }]}>
          <Icon name="share-social-outline" size={22} color={p.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="headline">Share</T>
          <T v="footnote" tone="ink3" numberOfLines={1}>
            {page.mark} {displayTitle(page)}
          </T>
        </View>
        <IconButton label="Close" icon="close" color={p.ink2} onPress={() => router.back()} />
      </View>

      <View style={[styles.card, { backgroundColor: p.panel }, lift(p)]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <T v="headline" style={{ fontSize: 16 }}>
              Share with a link
            </T>
            <T v="footnote" tone="ink3" style={{ marginTop: 2 }}>
              {on ? ROLES.find((r) => r.role === role)!.text : "Off. Only you, and people you invite on the web, can open this page."}
            </T>
          </View>
          {loading ? (
            <ActivityIndicator color={p.accent} />
          ) : (
            <Switch
              accessibilityLabel="Share with a link"
              value={on}
              disabled={busy}
              onValueChange={(v) => void change({ enabled: v })}
              trackColor={{ true: p.accent, false: p.lineStrong }}
              thumbColor="#fff"
            />
          )}
        </View>

        {on && (
          <>
            <View style={[styles.roles, { backgroundColor: p.well }]}>
              {ROLES.map((r) => {
                const selected = role === r.role;
                return (
                  <Pressable
                    key={r.role}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: busy }}
                    disabled={busy || selected}
                    onPress={() => {
                      tap("select");
                      void change({ role: r.role });
                    }}
                    style={[styles.role, selected && [{ backgroundColor: p.panel }, lift(p)]]}
                  >
                    <Icon name={r.icon} size={16} color={selected ? p.accent : p.ink3} />
                    <Text style={{ color: selected ? p.ink : p.ink3, fontSize: 14, fontWeight: "600" }}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.url, { backgroundColor: p.well, borderColor: p.line }]}>
              <Icon name="link-outline" size={16} color={p.ink3} />
              <Text selectable numberOfLines={1} style={{ flex: 1, color: p.ink2, fontSize: 14 }}>
                {url.replace(/^https?:\/\//, "")}
              </Text>
            </View>

            <Button
              title="Share link"
              icon="share-outline"
              size="lg"
              onPress={() => void Share.share({ message: url, url, title: displayTitle(page) }).catch(() => {})}
            />
            <Button
              title="Make a new link"
              tone="ghost"
              disabled={busy}
              onPress={() => void change({ reset: true })}
              accessibilityHint="The old link stops working"
            />
          </>
        )}

        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.error}>
            <Icon name="alert-circle" size={16} color={p.danger} />
            <Text style={{ flex: 1, color: p.danger, fontSize: 13.5, lineHeight: 19 }}>{error}</Text>
            {!link && !loading ? <Button title="Try again" tone="ghost" onPress={() => void load()} /> : null}
          </View>
        ) : null}
      </View>

      <Section title="Or send a copy" style={{ marginTop: space.lg }}>
        <Row
          icon="document-outline"
          title={printing ? "Making the PDF…" : "Send as PDF"}
          detail="The page as it looks, with its pictures and drawings"
          right={printing ? <ActivityIndicator color={p.accent} /> : undefined}
          onPress={
            printing
              ? undefined
              : () => {
                  setPdfError(null);
                  setPrinting(store.getPages()[id] ?? null);
                }
          }
        />
      </Section>
      {pdfError ? (
        <View accessibilityLiveRegion="polite" style={[styles.error, { marginTop: space.sm, paddingHorizontal: space.xs }]}>
          <Icon name="alert-circle" size={16} color={p.danger} />
          <Text style={{ flex: 1, color: p.danger, fontSize: 13.5, lineHeight: 19 }}>{pdfError}</Text>
        </View>
      ) : null}
      {printing && <PrintCopy page={printing} onHtml={onHtml} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  headIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  card: { marginTop: space.lg, borderRadius: 20, padding: space.lg, gap: space.md },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  roles: { flexDirection: "row", padding: 4, borderRadius: 14, gap: 4 },
  role: { flex: 1, height: 40, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  url: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.md, minHeight: 46, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  error: { flexDirection: "row", alignItems: "center", gap: 6 },
  printCopy: { position: "absolute", left: 0, top: 0, height: 700, opacity: 0 },
});
