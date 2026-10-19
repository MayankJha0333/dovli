// The first screen for someone who isn't signed in: what Dovli is, in one picture and one line,
// then Create account or Sign in. Dovli needs an account to open.

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@dovli/theme";
import { GradientText } from "@/components/GradientText";
import { BrandMark, Icon, lift, tap, usePalette, type IconName, type Palette } from "@/components/ui";
import { Backdrop } from "./Backdrop";
import { GoogleButton, googleConfigured } from "./GoogleButton";

const HAND = Platform.select({ ios: "Noteworthy-Light", android: "casual" });

const todos: [string, boolean][] = [
  ["Validate the idea", true],
  ["Create wireframes", true],
  ["Build MVP", false],
  ["Share with early users", false],
];

/** Light tint and strong colour for one hue, in light and dark themes. */
function hue(p: Palette, light: [string, string], dark: [string, string]) {
  const [bg, fg] = p.dark ? dark : light;
  return { bg, fg };
}

function Tag({ icon, text, tone }: { icon: IconName; text: string; tone: { bg: string; fg: string } }) {
  return (
    <View style={[styles.tag, { backgroundColor: tone.bg }]}>
      <Icon name={icon} size={12} color={tone.fg} />
      <Text style={{ color: tone.fg, fontSize: 11.5, fontWeight: "600" }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const ART_HEIGHT = 324;

/** Stacked cards: a page of to-dos in front of a sidebar and two pictures, with a "synced" note. One picture to screen readers. */
function HeroArt({ scale }: { scale: number }) {
  const p = usePalette();
  const blue = hue(p, ["#E6EDFF", "#3B5BDB"], ["#1A2442", "#A3BFFF"]);
  const violet = hue(p, ["#EDE9FF", "#5B45D6"], ["#221E45", "#BDB3FF"]);
  const coral = hue(p, ["#FFE9E4", "#E0533D"], ["#3A1F1A", "#FFAB9C"]);
  const green = hue(p, ["#DDF5E8", "#178A5A"], ["#13302A", "#86DCB0"]);
  const card = { backgroundColor: p.raised, borderColor: p.line };
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="A Dovli page called Product ideas with a to-do list, tagged notes, tasks and whiteboards, in front of a sidebar and pictures, and a note that it's synced across devices."
      style={{ height: ART_HEIGHT * scale }}
    >
      <View style={[styles.art, { transform: [{ scale }], transformOrigin: "top" }]}>
      {/* A sky picture behind, tilted. */}
      <View style={[styles.photo, styles.sky]}>
        <LinearGradient colors={p.dark ? ["#3A4A8C", "#4A3F86", "#2A2650"] : ["#9DB0F4", "#C3BCF6", "#EEE9FF"]} style={StyleSheet.absoluteFill} />
        {[
          [18, 62, 54],
          [52, 70, 64],
          [92, 66, 50],
          [74, 84, 70],
        ].map(([left, top, d]) => (
          <View key={left} style={{ position: "absolute", left, top, width: d, height: d, borderRadius: d / 2, backgroundColor: p.dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.85)" }} />
        ))}
      </View>

      {/* Mountains at dusk, on the right. */}
      <View style={[styles.photo, styles.dusk]}>
        <LinearGradient colors={p.dark ? ["#4A2F55", "#2E2648"] : ["#F7D7EA", "#D6C2F4", "#B9A6EE"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.peak, { left: 6, backgroundColor: p.dark ? "#6A4C7E" : "#C98BC0" }]} />
        <View style={[styles.peak, { left: 40, top: 112, backgroundColor: p.dark ? "#59436F" : "#B08AD6" }]} />
      </View>

      {/* The sidebar of a page, tilted the other way. */}
      <View style={[styles.sidebar, card, lift(p, 1)]}>
        {(["document-text-outline", "checkbox-outline", "grid-outline", "image-outline"] as IconName[]).map((name) => (
          <View key={name} style={[styles.sideIcon, { backgroundColor: p.well }]}>
            <Icon name={name} size={17} color={p.ink3} />
          </View>
        ))}
      </View>

      {/* The page itself, in front. */}
      <View style={[styles.page, card, lift(p, 2)]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="document-text-outline" size={13} color={p.ink4} />
          <Text style={{ color: p.ink4, fontSize: 12, flex: 1 }}>Notes</Text>
          <Icon name="ellipsis-horizontal" size={15} color={p.ink4} />
        </View>
        <Text style={{ color: p.ink, fontSize: 17, fontWeight: "700", letterSpacing: -0.3, marginTop: 6 }}>Product ideas</Text>
        <View style={{ marginTop: 10, gap: 9 }}>
          {todos.map(([t, done]) => (
            <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <View
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 5,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: done ? p.accent : "transparent",
                  borderWidth: done ? 0 : 1.5,
                  borderColor: p.lineStrong,
                }}
              >
                {done && <Icon name="checkmark" size={12} color={p.accentInk} />}
              </View>
              <Text style={{ color: done ? p.ink4 : p.ink2, fontSize: 13.5, textDecorationLine: done ? "line-through" : "none" }}>{t}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.tags, { borderTopColor: p.line }]}>
          <Tag icon="document-text-outline" text="Notes" tone={blue} />
          <Tag icon="checkbox-outline" text="Tasks" tone={violet} />
          <Tag icon="pulse-outline" text="Whiteboards" tone={coral} />
        </View>
      </View>

      <View style={[styles.synced, card, lift(p, 1)]}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: green.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon name="cloud-done-outline" size={13} color={green.fg} />
        </View>
        <Text style={{ color: p.ink, fontSize: 12.5, fontWeight: "600" }}>Synced across devices</Text>
      </View>

      {/* Handwritten notes in the margins. */}
      <View style={styles.noteLeft}>
        <Text style={[styles.hand, { color: p.ink4 }]}>{"Notes,\ndocs and\nmore"}</Text>
        <Icon name="return-down-forward-outline" size={16} color={p.ink4} style={{ marginLeft: 10, marginTop: 2 }} />
      </View>
      <View style={styles.noteRight}>
        <Text style={[styles.hand, { color: p.ink4, textAlign: "right" }]}>{"Organize\nyour ideas"}</Text>
        <Icon name="return-down-back-outline" size={16} color={p.ink4} style={{ alignSelf: "flex-end", marginRight: 6, marginTop: 2 }} />
      </View>
      <Icon name="sparkles-outline" size={18} color={p.ink4} style={styles.sparkle} />
      </View>
    </View>
  );
}

const features: { icon: IconName; label: string; tone: [string, string, string, string] }[] = [
  { icon: "document-text-outline", label: "Rich notes", tone: ["#EFEAFF", "#6C4DF0", "#221E45", "#BDB3FF"] },
  { icon: "checkbox-outline", label: "Tasks", tone: ["#DFF5E9", "#178A5A", "#13302A", "#86DCB0"] },
  { icon: "people-outline", label: "Sharing", tone: ["#E6EDFF", "#3B5BDB", "#1A2442", "#A3BFFF"] },
  { icon: "sparkles-outline", label: "Fast & calm", tone: ["#FFE9E4", "#E0533D", "#3A1F1A", "#FFAB9C"] },
];

export function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const { height } = useWindowDimensions();
  // The picture shrinks on shorter phones, so the buttons always fit without scrolling.
  const artScale = Math.min(1, Math.max(0.72, (height - 600) / ART_HEIGHT));
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) rise.setValue(1);
      else Animated.timing(rise, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    });
  }, [rise]);
  const range = (delay: number) => ({ inputRange: [delay, Math.min(1, delay + 0.5)], extrapolate: "clamp" as const });
  const enter = (delay: number) => ({
    opacity: rise.interpolate({ ...range(delay), outputRange: [0, 1] }),
    transform: [{ translateY: rise.interpolate({ ...range(delay), outputRange: [16, 0] }) }],
  });
  // Fading a group with shadows inside makes Android draw them as grey boxes, so there it only rises.
  const enterArt =
    Platform.OS === "android"
      ? { transform: [{ translateY: rise.interpolate({ ...range(0.05), outputRange: [24, 0] }) }, { scale: rise.interpolate({ ...range(0.05), outputRange: [0.96, 1] }) }] }
      : enter(0.05);
  const headline = { fontSize: 32, lineHeight: 38, fontWeight: "800" as const, letterSpacing: -1 };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop height={520} />
      <ScrollView
        // Only scrolls when the content can't fit (a small phone).
        scrollEnabled={contentH > viewH + 1}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContentH(h)}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md, paddingHorizontal: space.xl }}
      >
        <View style={styles.column}>
          <Animated.View style={[styles.brand, enter(0)]}>
            <BrandMark size={36} />
            <Text style={{ color: p.ink, fontSize: 26, fontWeight: "800", letterSpacing: -0.8 }}>Dovli</Text>
          </Animated.View>

          <View style={styles.gap} />

          <Animated.View style={enterArt}>
            <HeroArt scale={artScale} />
          </Animated.View>

          <Animated.View style={[{ alignItems: "center", marginTop: space.sm }, enter(0.2)]}>
            <Text accessibilityRole="header" style={[headline, { color: p.ink, textAlign: "center" }]}>
              A calm space to
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }} accessible accessibilityLabel="think, plan and create.">
              <GradientText style={headline} colors={p.dark ? ["#9CC6FF", "#B9A8FF"] : ["#4F6BF2", "#7B5CF0"]}>
                think, plan
              </GradientText>
              <Text style={[headline, { color: p.ink }]}> and create.</Text>
            </View>
            <Text style={{ color: p.ink3, fontSize: 15.5, lineHeight: 22, textAlign: "center", marginTop: space.md, maxWidth: 330 }}>
              Notes, to-dos and whiteboards that stay in sync between your phone and the web.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.features, enter(0.3)]}>
            {features.map((f) => (
              <View key={f.label} style={styles.feature}>
                <View style={[styles.featureIcon, { backgroundColor: p.dark ? f.tone[2] : f.tone[0] }]}>
                  <Icon name={f.icon} size={20} color={p.dark ? f.tone[3] : f.tone[1]} />
                </View>
                <Text style={{ color: p.ink3, fontSize: 12.5, fontWeight: "500" }} numberOfLines={1}>
                  {f.label}
                </Text>
              </View>
            ))}
          </Animated.View>

          <View style={styles.gap} />

          <Animated.View style={[{ gap: space.md }, enter(0.4)]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tap();
                router.push("/sign-up");
              }}
              style={({ pressed }) => [styles.cta, { backgroundColor: p.primary, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
            >
              <Text style={{ color: p.primaryInk, fontSize: 17, fontWeight: "700" }}>Create free account</Text>
              <Icon name="arrow-forward" size={19} color={p.primaryInk} />
            </Pressable>
            {googleConfigured && (
              <>
                <View style={styles.or}>
                  <View style={[styles.rule, { backgroundColor: p.line }]} />
                  <Text style={{ color: p.ink4, fontSize: 12, fontWeight: "600", letterSpacing: 1 }}>OR</Text>
                  <View style={[styles.rule, { backgroundColor: p.line }]} />
                </View>
                <GoogleButton
                  onError={(e) => {
                    // This email already signs in with a code: confirm it on the sign-in screen, then Google is added.
                    if (e.code === "link-needed" && e.extra.email) router.push({ pathname: "/sign-in", params: { email: e.extra.email, notice: e.message } });
                    else setGoogleError(e.message);
                  }}
                />
              </>
            )}
            {googleError ? (
              <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", paddingHorizontal: space.xs }}>
                <Icon name="alert-circle" size={16} color={p.danger} />
                <Text style={{ flex: 1, color: p.danger, fontSize: 13.5, lineHeight: 19 }}>{googleError}</Text>
              </View>
            ) : null}
            <View style={styles.signInRow}>
              <Text style={{ color: p.ink3, fontSize: 15 }}>Already have an account?</Text>
              <Pressable accessibilityRole="link" hitSlop={10} onPress={() => router.push("/sign-in")}>
                <Text style={{ color: p.accent, fontSize: 15, fontWeight: "700" }}>Sign in</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // One readable column, also on tablets.
  column: { flex: 1, width: "100%", maxWidth: 440, alignSelf: "center" },
  // Gives way on short screens; on tall ones it spreads the screen out evenly.
  gap: { flexGrow: 1, minHeight: space.md, maxHeight: space.xxl },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },

  art: { height: ART_HEIGHT },
  photo: { position: "absolute", overflow: "hidden", borderRadius: 22 },
  sky: { left: "24%", width: "54%", top: 0, height: 150, transform: [{ rotate: "7deg" }] },
  dusk: { right: -6, top: 66, width: "30%", height: 176, transform: [{ rotate: "11deg" }] },
  peak: { position: "absolute", top: 100, width: 90, height: 90, transform: [{ rotate: "45deg" }] },
  sidebar: { position: "absolute", left: 4, top: 96, width: 74, height: 176, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingTop: 20, alignItems: "center", gap: 12, transform: [{ rotate: "-9deg" }] },
  sideIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  page: { position: "absolute", left: "15%", right: "3%", top: 64, padding: 15, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, transform: [{ rotate: "-2deg" }] },
  tags: { flexDirection: "row", gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 27, borderRadius: 9 },
  synced: { position: "absolute", right: 0, top: 36, flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 7, paddingLeft: 7, paddingRight: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  noteLeft: { position: "absolute", left: 0, top: 6 },
  noteRight: { position: "absolute", right: 2, top: -6 },
  hand: { fontFamily: HAND, fontSize: 13, lineHeight: 16 },
  sparkle: { position: "absolute", right: 10, bottom: 18 },

  features: { flexDirection: "row", marginTop: space.lg + 4 },
  feature: { flex: 1, alignItems: "center", gap: 7 },
  featureIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },

  cta: { minHeight: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  or: { flexDirection: "row", alignItems: "center", gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  signInRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, paddingTop: space.xs },
});
