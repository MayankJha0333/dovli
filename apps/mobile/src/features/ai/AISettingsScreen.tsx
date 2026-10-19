// AI on the phone: which AI your account uses, how much of this month's free allowance is left,
// which model, and connecting your own key (Groq, OpenRouter, Anthropic or OpenAI). The same
// choices as Settings → AI on the web; a change here applies there too.

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { Button, Card, Header, Icon, Row, Section, T, TextField, lift, tap, usePalette } from "@/components/ui";
import { usePhoneAuth } from "@/lib/auth";
import { OWN_PROVIDERS, PROVIDERS, aiLabel, checkKey, connectKey, disconnectKey, modelLabel, refreshAI, useAI, chooseDovliModel, type OwnProviderId, type ProviderId } from "@/lib/ai";

const AI_GRADIENT = ["#7C6CF2", "#A855F7", "#E39AEC"] as const;

/** A tick on the right of a choice row. */
function Tick({ on }: { on: boolean }) {
  const p = usePalette();
  return on ? <Icon name="checkmark-circle" size={21} color={p.accent} /> : <View style={[styles.radio, { borderColor: p.ink4 }]} />;
}

/** The models of one provider as a list of choices. */
function ModelList({ provider, selected, onPick, busy }: { provider: ProviderId; selected: string | null; onPick: (id: string) => void; busy?: string | null }) {
  const p = usePalette();
  return (
    <>
      {PROVIDERS[provider].models.map((m) => (
        <Row
          key={m.id}
          title={m.label}
          detail={m.hint}
          right={busy === m.id ? <ActivityIndicator color={p.accent} /> : <Tick on={selected === m.id} />}
          onPress={() => onPick(m.id)}
        />
      ))}
    </>
  );
}

/** Paste a key, pick a model, connect. The server tests the key first, so a wrong one isn't saved. */
function ConnectForm({ provider, onDone }: { provider: OwnProviderId; onDone: () => void }) {
  const p = usePalette();
  const info = PROVIDERS[provider];
  const [key, setKey] = useState("");
  const [model, setModel] = useState(info.defaultModel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    const bad = checkKey(provider, key);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      await connectKey(provider, model, key);
      tap("success");
      onDone();
    } catch (e) {
      tap("error");
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ padding: space.lg, gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }}>
      <TextField
        label={`${info.name} API key`}
        icon="key-outline"
        value={key}
        onChangeText={(v) => {
          setKey(v);
          setError(null);
        }}
        placeholder={info.keyPrefix ? `${info.keyPrefix}…` : "Paste your key"}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        error={error}
        hint={info.keysSite ? `Make one at ${info.keysSite}. It's stored sealed in your account, never on this phone.` : undefined}
      />
      <View>
        <Text style={{ color: p.ink2, fontSize: 13.5, fontWeight: "600", marginBottom: 6 }}>Model</Text>
        <View style={{ borderRadius: 14, overflow: "hidden", backgroundColor: p.well }}>
          {info.models.map((m, i) => (
            <Pressable
              key={m.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: model === m.id }}
              onPress={() => {
                tap("select");
                setModel(m.id);
              }}
              style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.ink, fontSize: 15, fontWeight: "500" }}>{m.label}</Text>
                <Text style={{ color: p.ink3, fontSize: 12.5 }}>{m.hint}</Text>
              </View>
              <Tick on={model === m.id} />
            </Pressable>
          ))}
        </View>
      </View>
      <Button title={busy ? "Checking your key…" : `Connect ${info.name}`} icon="link-outline" loading={busy} disabled={!key.trim()} onPress={() => void connect()} />
    </View>
  );
}

export function AISettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const a = usePhoneAuth();
  const ai = useAI();
  const [open, setOpen] = useState<OwnProviderId | null>(null);
  const [busyModel, setBusyModel] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedIn = a.status === "signed-in";

  useEffect(() => {
    if (signedIn) void refreshAI();
  }, [signedIn]);

  const own = ai.provider !== "groq";
  const pct = ai.limit ? Math.min(100, Math.round((ai.used / ai.limit) * 100)) : 0;

  const pickDovli = async (model: string) => {
    if (!own && model === ai.model) return;
    setBusyModel(model);
    setError(null);
    try {
      await chooseDovliModel(model);
      tap("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyModel(null);
    }
  };

  const pickOwnModel = async (model: string) => {
    if (model === ai.model || !own) return;
    setBusyModel(model);
    setError(null);
    try {
      await connectKey(ai.provider as OwnProviderId, model, "");
      tap("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyModel(null);
    }
  };

  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await disconnectKey();
      tap("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Background intensity={0.6} />
      <Header top={insets.top} title="AI" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxxl }} keyboardShouldPersistTaps="handled">
        {/* What's in use */}
        <View style={[styles.hero, lift(p, 2)]}>
          <LinearGradient colors={AI_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={styles.heroIcon}>
              <Icon name="sparkles" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>{signedIn && ai.loaded && !ai.failed ? "YOUR AI" : "AI IN DOVLI"}</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {!signedIn || ai.failed ? "Summaries and reviews" : !ai.loaded ? "Checking…" : aiLabel(ai)}
              </Text>
              {signedIn && ai.loaded && !ai.failed && ai.model ? <Text style={styles.heroSub}>{modelLabel(ai.provider, ai.model)}</Text> : null}
            </View>
          </View>
          {signedIn && ai.loaded && !ai.failed && !own && ai.limit > 0 && (
            <View style={{ marginTop: space.lg }}>
              <View style={styles.meter}>
                <View style={[styles.meterFill, { width: `${Math.max(pct, 3)}%` }]} />
              </View>
              <Text style={styles.heroSub}>
                {pct}% of this month's free allowance used · resets on the 1st
              </Text>
            </View>
          )}
          {signedIn && own && ai.keyHint ? <Text style={[styles.heroSub, { marginTop: space.md }]}>Your key ending {ai.keyHint.replace(/^[.…]+/, "")} · no monthly limit</Text> : null}
        </View>

        {!signedIn ? (
          <Card style={{ marginTop: space.xl, padding: space.lg }}>
            <T v="headline">AI needs a Dovli account</T>
            <T v="subhead" tone="ink3" style={{ marginTop: 4 }}>
              Sign in to summarise and review your pages with AI. Dovli AI is free each month.
            </T>
            <Button title="Sign in or create account" icon="person-circle-outline" onPress={() => router.push("/sign-in")} style={{ marginTop: space.lg }} />
          </Card>
        ) : ai.failed ? (
          <Card style={{ marginTop: space.xl, padding: space.lg }}>
            <T v="headline">Can't reach Dovli right now</T>
            <T v="subhead" tone="ink3" style={{ marginTop: 4 }}>
              Your AI settings load from your account. Check your connection and try again.
            </T>
            <Button title="Try again" icon="refresh-outline" onPress={() => void refreshAI()} style={{ marginTop: space.lg }} />
          </Card>
        ) : !ai.loaded ? (
          <ActivityIndicator color={p.accent} style={{ marginTop: space.xxl }} />
        ) : (
          <>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={{ color: p.danger, fontSize: 13.5, marginTop: space.lg, marginHorizontal: space.xs }}>
                {error}
              </Text>
            ) : null}

            {own ? (
              <Section title={`${PROVIDERS[ai.provider].name} models`}>
                <ModelList provider={ai.provider} selected={ai.model} onPick={(m) => void pickOwnModel(m)} busy={busyModel} />
              </Section>
            ) : ai.dovliAI ? (
              <Section title="Dovli AI model" footer="Free with your account. The allowance resets on the 1st of each month.">
                <ModelList provider="groq" selected={ai.model} onPick={(m) => void pickDovli(m)} busy={busyModel} />
              </Section>
            ) : null}

            {own ? (
              <Section footer="Removing your key switches you back to Dovli AI.">
                <Row
                  icon="close-circle-outline"
                  title={removing ? "Removing…" : `Remove ${PROVIDERS[ai.provider].name} key`}
                  destructive
                  chevron={false}
                  right={removing ? <ActivityIndicator color={p.danger} /> : undefined}
                  onPress={removing ? undefined : () => void remove()}
                />
              </Section>
            ) : ai.canConnect ? (
              <Section title="Or use your own key" footer="No monthly limit with your own key. You pay your provider directly.">
                {OWN_PROVIDERS.map((id) => (
                  <View key={id}>
                    <Row
                      icon="key-outline"
                      tint={p.ink2}
                      title={PROVIDERS[id].name}
                      detail={PROVIDERS[id].blurb}
                      right={<Icon name={open === id ? "chevron-up" : "chevron-down"} size={16} color={p.ink4} />}
                      onPress={() => setOpen(open === id ? null : id)}
                    />
                    {open === id && <ConnectForm provider={id} onDone={() => setOpen(null)} />}
                  </View>
                ))}
              </Section>
            ) : null}

            <Section title="What AI can do here">
              <Row icon="reader-outline" tint="#A855F7" title="Summarise a page" detail="A few lines and the key points" />
              <Row icon="checkmark-done-outline" tint="#A855F7" title="Review a page" detail="Clarity, grammar, structure or tone" />
            </Section>
            <T v="footnote" tone="ink3" style={{ marginTop: space.sm, marginHorizontal: space.xs }}>
              Open any page, tap ⋯, then AI. Your choice here applies to your account everywhere.
            </T>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: space.md, borderRadius: 22, padding: space.lg, overflow: "hidden" },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  heroKicker: { color: "rgba(255,255,255,0.8)", fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8 },
  heroTitle: { color: "#fff", fontSize: 21, fontWeight: "800", letterSpacing: -0.3, marginTop: 1 },
  heroSub: { color: "rgba(255,255,255,0.88)", fontSize: 13, marginTop: 4 },
  meter: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden" },
  meterFill: { height: 8, borderRadius: 4, backgroundColor: "#fff" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md + 2, paddingVertical: 11 },
});
