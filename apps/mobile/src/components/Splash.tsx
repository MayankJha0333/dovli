// The hand-off from the system splash screen to the app. The system splash (set in app.json via
// expo-splash-screen) shows the mark on a plain background while the app loads. This screen starts
// as an exact copy of it, so swapping is invisible. Then a glow in the mark's blue-violet-pink
// blooms behind it, rings ripple out, the mark springs up, and "Dovli" rises in letter by letter,
// filled with the mark's gradient. A sheen sweeps across the word, the tagline follows word by
// word, and the whole screen fades away as the mark grows. With Reduce Motion on, it just fades.

import { useEffect, useRef, type ComponentType, type ReactElement } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View, useColorScheme, type ViewProps } from "react-native";
import MaskedViewNative from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";

/** Must match the expo-splash-screen settings in app.json. */
export const SPLASH = { light: "#F1F0F8", dark: "#08090B", imageWidth: 200 } as const;

// Its class typings fail React 19's JSX element check; the component itself works.
const MaskedView = MaskedViewNative as unknown as ComponentType<ViewProps & { maskElement: ReactElement }>;

const BRAND = ["#7DB4FF", "#A592FF", "#E39AEC"] as const;
// The brand pastels are too pale to read as text on the light background.
const INK = { light: ["#3F6FE8", "#6C4DF0", "#C04BD3"], dark: ["#9CC6FF", "#B9A8FF", "#F0AEF5"] } as const;
const LETTERS = "Dovli".split("");
const WORDS = "A calm place to write, plan and sketch".split(" ");
const ease = Easing.bezier(0.2, 0.7, 0.2, 1);

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function Splash({ onDone }: { onDone: () => void }) {
  const dark = useColorScheme() === "dark";
  const glow = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const rings = useRef(BRAND.map(() => new Animated.Value(0))).current;
  const letters = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const words = useRef(WORDS.map(() => new Animated.Value(0))).current;
  const out = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // This screen is now drawn under the system splash: hide that one.
      await SplashScreen.hideAsync().catch(() => {});
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (cancelled) return;
      const t = (v: Animated.Value, toValue: number, duration: number, easing = ease) =>
        Animated.timing(v, { toValue, duration, easing, useNativeDriver: true });
      const spring = (v: Animated.Value, friction: number, tension: number) =>
        Animated.spring(v, { toValue: 1, friction, tension, useNativeDriver: true });
      const steps = reduce
        ? [t(out, 1, 220)]
        : [
            Animated.parallel([
              t(glow, 1, 700),
              Animated.sequence([t(pop, 0.92, 140, Easing.out(Easing.quad)), spring(pop, 4, 120)]),
              Animated.stagger(170, rings.map((r) => t(r, 1, 1200, Easing.out(Easing.cubic)))),
              Animated.sequence([
                Animated.delay(260),
                Animated.parallel([t(lift, 1, 560), Animated.stagger(60, letters.map((l) => spring(l, 6, 80)))]),
                Animated.parallel([
                  t(sheen, 1, 800, Easing.inOut(Easing.cubic)),
                  t(bar, 1, 420),
                  Animated.sequence([Animated.delay(120), Animated.stagger(55, words.map((w) => t(w, 1, 380)))]),
                ]),
              ]),
            ]),
            Animated.delay(340),
            t(out, 1, 460, Easing.in(Easing.cubic)),
          ];
      Animated.sequence(steps).start(() => !cancelled && onDone());
    })();
    return () => {
      cancelled = true;
    };
  }, [glow, pop, lift, rings, letters, sheen, bar, words, out, onDone]);

  const size = SPLASH.imageWidth;
  const muted = dark ? "rgba(244,244,246,0.58)" : "rgba(21,23,29,0.55)";
  const a = dark ? 0.75 : 1;
  const fade = out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const markY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });

  const wordmark = (animated: boolean) => (
    <View style={styles.row}>
      {LETTERS.map((ch, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.letter,
            animated && {
              opacity: letters[i].interpolate({ inputRange: [0, 0.5], outputRange: [0, 1], extrapolate: "clamp" }),
              transform: [
                { translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                { rotate: letters[i].interpolate({ inputRange: [0, 1], outputRange: ["-14deg", "0deg"] }) },
                { scale: letters[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            },
          ]}
        >
          {ch}
        </Animated.Text>
      ))}
    </View>
  );

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: dark ? SPLASH.dark : SPLASH.light, opacity: fade }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]}>
        <LinearGradient
          colors={[rgba(BRAND[0], 0.26 * a), rgba(BRAND[1], 0.18 * a), rgba(BRAND[1], 0)]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.75 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[rgba(BRAND[2], 0), rgba(BRAND[2], 0.2 * a)]}
          start={{ x: 0.3, y: 0.35 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* A soft halo behind the mark: stacked translucent discs read as one radial glow. */}
      <Animated.View
        style={[
          styles.layer,
          {
            transform: [{ translateY: markY }, { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            opacity: glow,
          },
        ]}
      >
        {[340, 290, 245, 200, 160, 120].map((d) => (
          <LinearGradient
            key={d}
            colors={[rgba(BRAND[0], 0.07 * a), rgba(BRAND[1], 0.07 * a), rgba(BRAND[2], 0.07 * a)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.disc, { width: d, height: d, borderRadius: d / 2 }]}
          />
        ))}
      </Animated.View>

      {rings.map((r, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              borderColor: BRAND[i],
              opacity: r.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, dark ? 0.6 : 0.7, 0] }),
              transform: [{ translateY: markY }, { scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.7, 3.2] }) }],
            },
          ]}
        />
      ))}

      <Animated.View
        style={{
          transform: [
            { translateY: markY },
            { scale: Animated.multiply(pop, out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] })) },
          ],
        }}
      >
        <Image source={require("../../assets/images/splash-icon.png")} style={{ width: size, height: size }} />
      </Animated.View>

      <MaskedView style={styles.word} maskElement={wordmark(true)}>
        {/* An invisible copy gives the masked area its size. */}
        <View style={{ opacity: 0 }}>{wordmark(false)}</View>
        <LinearGradient colors={[...INK[dark ? "dark" : "light"]]} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[
            styles.sheen,
            { transform: [{ translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-120, 220] }) }, { rotate: "18deg" }] },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0)", `rgba(255,255,255,${dark ? 0.75 : 0.9})`, "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </MaskedView>

      <View style={styles.tagline}>
        <Animated.View style={{ opacity: bar, transform: [{ scaleX: bar }] }}>
          <LinearGradient colors={[...BRAND]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.bar} />
        </Animated.View>
        <View style={styles.words}>
          {WORDS.map((w, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.taglineText,
                {
                  color: muted,
                  opacity: words[i],
                  transform: [{ translateY: words[i].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                },
              ]}
            >
              {w}
            </Animated.Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 100, overflow: "hidden" },
  layer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute" },
  ring: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 1.5 },
  word: { position: "absolute", top: "50%", marginTop: 0 },
  row: { flexDirection: "row", paddingHorizontal: 6 },
  letter: { fontSize: 48, lineHeight: 58, fontWeight: "900", letterSpacing: -1.6, color: "#000" },
  sheen: { position: "absolute", top: -30, bottom: -30, width: 46 },
  tagline: { position: "absolute", top: "50%", left: 0, right: 0, marginTop: 72, alignItems: "center", paddingHorizontal: 32 },
  bar: { width: 44, height: 3, borderRadius: 2, marginBottom: 14 },
  words: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 4 },
  taglineText: { fontSize: 15, fontWeight: "500", letterSpacing: 0.2 },
});
