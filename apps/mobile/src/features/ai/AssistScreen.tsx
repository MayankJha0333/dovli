// AI on one page: a summary, or a review (clarity, grammar, structure or tone). The answer shows
// right here; your page isn't changed. Uses the account's AI (Settings → AI).

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { blocksToMarkdown, displayTitle } from "@dovli/core";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { Button, Card, Header, Icon, T, lift, tap, usePalette, type IconName } from "@/components/ui";
import { usePhoneAuth } from "@/lib/auth";
import { usePages } from "@/lib/store";
import { aiLabel, refreshAI, runAI, useAI, type ReviewFocus } from "@/lib/ai";

const MAX_TEXT = 24_000;

type Mode = "summarize" | ReviewFocus;
const MODES: { id: Mode; label: string; icon: IconName; hint: string }[] = [
  { id: "summarize", label: "Summary", icon: "reader-outline", hint: "A few lines and the key points" },
  { id: "clarity", label: "Clarity", icon: "bulb-outline", hint: "Hard-to-follow sentences and vague words" },
  { id: "grammar", label: "Grammar", icon: "text-outline", hint: "Spelling, grammar and punctuation" },
  { id: "structure", label: "Structure", icon: "list-outline", hint: "The order of ideas, and what's missing" },
  { id: "tone", label: "Tone", icon: "chatbubble-ellipses-outline", hint: "How it sounds, and where it's uneven" },
];

/** The answer, with "- " lines drawn as a list. */
function Answer({ text }: { text: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 8 }}>
      {text.split(/\n+/).map((line, i) => {
        const point = /^\s*[-•*]\s+/.test(line);
        const clean = line.replace(/^\s*[-•*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1");
        return point ? (
          <View key={i} style={{ flexDirection: "row", gap: 10 }}>
            <View style={[styles.bullet, { backgroundColor: p.accent }]} />
            <Text style={{ flex: 1, color: p.ink, fontSize: 15.5, lineHeight: 23 }}>{clean}</Text>
          </View>
        ) : (
          <Text key={i} style={{ color: p.ink, fontSize: 15.5, lineHeight: 23 }}>
            {clean}
          </Text>
        );
      })}
    </View>
  );
}

export function AssistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const a = usePhoneAuth();
  const ai = useAI();
  const page = usePages((x) => x[id]);
  const [mode, setMode] = useState<Mode>("summarize");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ mode: Mode; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = a.status === "signed-in";

  useEffect(() => {
    if (signedIn) void refreshAI();
  }, [signedIn]);

  if (!page) return null;
  const text = page.kind === "doc" ? `# ${displayTitle(page)}\n\n${blocksToMarkdown(page.blocks ?? [])}`.slice(0, MAX_TEXT) : "";
  const empty = text.replace(/^#.*$/m, "").trim().length < 20;
  const current = MODES.find((m) => m.id === mode)!;

  const run = async () => {
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const out = mode === "summarize" ? await runAI("summarize", text) : await runAI("review", text, { focus: mode });
      tap("success");
      setAnswer({ mode, text: out || "Nothing to add. This page reads well." });
    } catch (e) {
      tap("error");
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.6} />
      <Header top={insets.top} title="AI" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxxl }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
          <Icon name="document-text-outline" size={16} color={p.ink3} />
          <T v="subhead" tone="ink2" numberOfLines={1} style={{ flex: 1, fontWeight: "600" }}>
            {displayTitle(page)}
          </T>
          {signedIn && ai.loaded && !ai.failed ? (
            <Pressable onPress={() => router.push("/ai")} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Using ${aiLabel(ai)}. Change`}>
              <T v="caption" tone="accent">
                {aiLabel(ai)}
              </T>
            </Pressable>
          ) : null}
        </View>

        {!signedIn ? (
          <Card style={{ marginTop: space.lg, padding: space.lg }}>
            <T v="headline">AI needs a Dovli account</T>
            <T v="subhead" tone="ink3" style={{ marginTop: 4 }}>
              Sign in to summarise and review your pages. Dovli AI is free each month.
            </T>
            <Button title="Sign in or create account" icon="person-circle-outline" onPress={() => router.push("/sign-in")} style={{ marginTop: space.lg }} />
          </Card>
        ) : (
          <>
            <View style={styles.modes}>
              {MODES.map((m) => {
                const on = m.id === mode;
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      tap("select");
                      setMode(m.id);
                    }}
                    style={[styles.mode, { backgroundColor: on ? p.accent : p.panel, borderColor: on ? p.accent : p.line }]}
                  >
                    <Icon name={m.icon} size={15} color={on ? "#fff" : p.ink2} />
                    <Text style={{ color: on ? "#fff" : p.ink, fontSize: 14, fontWeight: "600" }}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <T v="footnote" tone="ink3" style={{ marginTop: space.sm, marginHorizontal: space.xs }}>
              {mode === "summarize" ? current.hint : `Review: ${current.hint.toLowerCase()}`}
            </T>

            <Button
              title={busy ? "Reading your page…" : mode === "summarize" ? "Summarise this page" : `Review ${current.label.toLowerCase()}`}
              icon="sparkles"
              size="lg"
              loading={busy}
              disabled={empty}
              onPress={() => void run()}
              style={{ marginTop: space.lg }}
            />
            {empty ? (
              <T v="footnote" tone="ink3" style={{ marginTop: space.sm, textAlign: "center" }}>
                Write a little more on this page first.
              </T>
            ) : null}

            {error ? (
              <View style={[styles.note, { backgroundColor: p.dangerSoft }]}>
                <Icon name="alert-circle" size={18} color={p.danger} />
                <T v="subhead" style={{ flex: 1, color: p.danger }}>
                  {error}
                </T>
              </View>
            ) : null}

            {busy ? (
              <View style={{ alignItems: "center", marginTop: space.xxl }}>
                <ActivityIndicator color={p.accent} />
              </View>
            ) : answer ? (
              <View style={[styles.answer, { backgroundColor: p.panel }, lift(p)]}>
                <LinearGradient colors={["#7C6CF2", "#A855F7", "#E39AEC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.answerBar} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space.md }}>
                  <Icon name="sparkles" size={14} color="#A855F7" />
                  <Text style={{ color: p.ink3, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>{MODES.find((m) => m.id === answer.mode)!.label.toUpperCase()}</Text>
                </View>
                <Answer text={answer.text} />
                <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
                  <Button title="Run again" tone="secondary" icon="refresh-outline" onPress={() => void run()} style={{ flex: 1 }} />
                  <Button title="Back to page" tone="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
                </View>
              </View>
            ) : null}
            <T v="caption" tone="ink4" style={{ marginTop: space.xl, textAlign: "center", fontWeight: "400" }}>
              AI reads this page to answer. Your page isn't changed.
            </T>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.lg },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  mode: { flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2 },
  note: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: space.md, borderRadius: 14, marginTop: space.lg },
  answer: { marginTop: space.xl, borderRadius: 20, padding: space.lg },
  answerBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
});
