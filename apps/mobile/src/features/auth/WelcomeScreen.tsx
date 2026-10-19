// The first screen for someone who isn't signed in: what Dovli is, in one picture and one line,
// then Create account, Sign in, or try it without an account (pages stay on this phone).

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@dovli/theme";
import { BrandMark, Button, Icon, Title, usePalette, type IconName } from "@/components/ui";
import { phoneAuth } from "@/lib/auth";
import { Backdrop } from "./Backdrop";
import { GoogleButton, googleConfigured } from "./GoogleButton";

const todos: [string, boolean][] = [
  ["Write the welcome email", true],
  ["Record a one-minute demo", true],
  ["Invite the first 200 people", false],
];

/** A small Dovli page, the assistant beside it, and a "synced" note. One picture to screen readers. */
function Preview() {
  const p = usePalette();
  const shadow = { shadowColor: "#1a1530", shadowOpacity: p.dark ? 0.5 : 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 };
  const chip = (text: string, bg: string, fg: string) => (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 9, height: 26, justifyContent: "center" }}>
      <Text style={{ color: fg, fontSize: 11.5, fontWeight: "700" }}>{text}</Text>
    </View>
  );
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="A Dovli page called Launch plan with ticked to-dos and a small flowchart, and the assistant suggesting a summary."
      style={{ height: 344, marginTop: space.xl }}
    >
      <View style={[styles.paper, shadow, { backgroundColor: p.panel, borderRadius: 22, borderColor: p.line, borderWidth: p.dark ? StyleSheet.hairlineWidth : 0 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Icon name="document-text-outline" size={12} color={p.ink3} />
          <Text style={{ color: p.ink3, fontSize: 11.5 }}>Launch plan</Text>
        </View>
        <Text style={{ color: p.ink, fontSize: 21, fontWeight: "700", letterSpacing: -0.4, marginTop: 8 }}>Launch plan</Text>
        <View style={{ marginTop: 10, gap: 7 }}>
          {todos.map(([t, done]) => (
            <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <View
                style={{
                  width: 16,
                  height: 16,
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
              <Text style={{ color: done ? p.ink3 : p.ink, fontSize: 13.5, textDecorationLine: done ? "line-through" : "none" }}>{t}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 14, backgroundColor: p.well, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
          {chip("Idea", p.dark ? "#1a2442" : "#e2ebff", p.dark ? "#a3bfff" : "#2b52cc")}
          <Icon name="arrow-forward" size={13} color={p.ink4} />
          {chip("Draft", p.dark ? "#221e45" : "#ebe7ff", p.dark ? "#bdb3ff" : "#4d42d1")}
          <Icon name="arrow-forward" size={13} color={p.ink4} />
          {chip("Ship", p.dark ? "#13302a" : "#d9f2e3", p.dark ? "#86dcb0" : "#12704a")}
        </View>
      </View>

      <View style={[styles.assistant, shadow, { backgroundColor: p.raised, borderColor: p.line }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Icon name="sparkles" size={12} color={p.accent} />
          <Text style={{ color: p.ink, fontSize: 12, fontWeight: "700" }}>Assistant</Text>
        </View>
        <View style={{ alignSelf: "flex-end", backgroundColor: p.accentSoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, marginTop: 7 }}>
          <Text style={{ color: p.ink, fontSize: 11.5 }}>Sum up this page</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ color: p.ink2, fontSize: 11.5 }}>Add at the top</Text>
          <View style={{ backgroundColor: p.accent, borderRadius: 7, paddingHorizontal: 8, height: 22, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="checkmark" size={11} color={p.accentInk} />
            <Text style={{ color: p.accentInk, fontSize: 11, fontWeight: "700" }}>Apply</Text>
          </View>
        </View>
      </View>

      <View style={[styles.synced, shadow, { backgroundColor: p.raised, borderColor: p.line }]}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: p.dark ? "#13302a" : "#d9f2e3", alignItems: "center", justifyContent: "center" }}>
          <Icon name="cloud-done-outline" size={12} color={p.dark ? "#86dcb0" : "#12704a"} />
        </View>
        <Text style={{ color: p.ink, fontSize: 12, fontWeight: "600" }}>Saved on all your devices</Text>
      </View>
    </View>
  );
}

const points: { icon: IconName; text: string }[] = [
  { icon: "create-outline", text: "Pages inside pages" },
  { icon: "git-network-outline", text: "Flowcharts" },
  { icon: "sparkles-outline", text: "AI that edits with you" },
];

export function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) rise.setValue(1);
      else Animated.timing(rise, { toValue: 1, duration: 650, useNativeDriver: true }).start();
    });
  }, [rise]);
  const enter = (delay: number) => ({
    opacity: rise.interpolate({ inputRange: [delay, Math.min(1, delay + 0.5)], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [{ translateY: rise.interpolate({ inputRange: [delay, Math.min(1, delay + 0.5)], outputRange: [16, 0], extrapolate: "clamp" }) }],
  });

  return (
    <View style={{ flex: 1 }}>
      <Backdrop height={520} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.xl }} bounces={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <BrandMark size={28} />
          <Text style={{ color: p.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 }}>Dovli</Text>
        </View>

        <Animated.View style={enter(0)}>
          <Preview />
        </Animated.View>

        <Animated.View style={[{ marginTop: space.xl }, enter(0.2)]}>
          <Title size={34}>A calm place to write, plan and sketch.</Title>
          <Text style={{ color: p.ink2, fontSize: 16, lineHeight: 23, marginTop: space.md }}>
            Notes, to-dos and flowcharts that stay in sync between your phone and the web.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.lg }}>
            {points.map((pt) => (
              <View key={pt.text} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: p.panel, borderRadius: 999, paddingHorizontal: 11, height: 30, borderWidth: StyleSheet.hairlineWidth, borderColor: p.line }}>
                <Icon name={pt.icon} size={14} color={p.accent} />
                <Text style={{ color: p.ink2, fontSize: 13, fontWeight: "500" }}>{pt.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={{ flex: 1, minHeight: space.xl }} />

        <Animated.View style={[{ gap: space.sm + 2 }, enter(0.4)]}>
          <Button title="Create free account" size="lg" onPress={() => router.push("/sign-up")} />
          {googleConfigured ? (
            <>
              <GoogleButton
                onError={(e) => {
                  // This email already signs in with a code: confirm it on the sign-in screen, then Google is added.
                  if (e.code === "link-needed" && e.extra.email) router.push({ pathname: "/sign-in", params: { email: e.extra.email, notice: e.message } });
                  else setGoogleError(e.message);
                }}
              />
              {googleError ? (
                <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", paddingHorizontal: space.xs }}>
                  <Icon name="alert-circle" size={16} color={p.danger} />
                  <Text style={{ flex: 1, color: p.danger, fontSize: 13.5, lineHeight: 19 }}>{googleError}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, paddingVertical: 6 }}>
                <Text style={{ color: p.ink2, fontSize: 14.5 }}>Already have an account?</Text>
                <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push("/sign-in")}>
                  <Text style={{ color: p.accent, fontSize: 14.5, fontWeight: "700" }}>Sign in</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Button title="Sign in" tone="secondary" size="lg" onPress={() => router.push("/sign-in")} />
          )}
          <Button
            title="Continue without an account"
            tone="ghost"
            onPress={() => phoneAuth.setGuest(true)}
            accessibilityHint="Your pages stay on this phone. You can sign in later in Settings."
          />
          <Text style={{ color: p.ink3, fontSize: 12.5, textAlign: "center", marginTop: -4 }}>Without an account, pages stay on this phone.</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { position: "absolute", left: 0, right: 34, top: 18, padding: 18 },
  assistant: { position: "absolute", right: 0, bottom: 0, width: 190, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  synced: { position: "absolute", right: 0, top: 0, flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 6, paddingLeft: 7, paddingRight: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
});
