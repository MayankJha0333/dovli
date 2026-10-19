// The hand-off from the system splash screen to the app. The system splash (set in app.json via
// expo-splash-screen) shows the mark on a plain background while the app loads. This screen starts
// as an exact copy of it, so swapping is invisible. Then a glow in the mark's blue-violet-pink
// blooms behind it, rings ripple out, the mark springs up, "Dovli" rises in letter by letter with
// the tagline under it, and the whole screen fades away as the mark grows. With Reduce Motion on,
// it just fades.

import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View, useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";

/** Must match the expo-splash-screen settings in app.json. */
export const SPLASH = { light: "#EDEFF4", dark: "#08090B", imageWidth: 200 } as const;

const BRAND = ["#7DB4FF", "#A592FF", "#E39AEC"] as const;
const LETTERS = "Dovli".split("");
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
  const tagline = useRef(new Animated.Value(0)).current;
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
      const steps = reduce
        ? [t(out, 1, 220)]
        : [
            Animated.parallel([
              t(glow, 1, 700),
              Animated.sequence([
                t(pop, 0.92, 140, Easing.out(Easing.quad)),
                Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
              ]),
              Animated.stagger(
                170,
                rings.map((r) => t(r, 1, 1200, Easing.out(Easing.cubic))),
              ),
              Animated.sequence([
                Animated.delay(260),
                Animated.parallel([
                  t(lift, 1, 560),
                  Animated.stagger(
                    55,
                    letters.map((l) => Animated.spring(l, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true })),
                  ),
                ]),
                t(tagline, 1, 420),
              ]),
            ]),
            Animated.delay(380),
            t(out, 1, 460, Easing.in(Easing.cubic)),
          ];
      Animated.sequence(steps).start(() => !cancelled && onDone());
    })();
    return () => {
      cancelled = true;
    };
  }, [glow, pop, lift, rings, letters, tagline, out, onDone]);

  const size = SPLASH.imageWidth;
  const ink = dark ? "#F4F4F6" : "#15171D";
  const muted = dark ? "rgba(244,244,246,0.56)" : "rgba(21,23,29,0.52)";
  const a = dark ? 0.75 : 1;
  const fade = out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const markY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });

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

      <View style={styles.word}>
        {LETTERS.map((ch, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.letter,
              {
                color: ink,
                opacity: letters[i].interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: "clamp" }),
                transform: [
                  { translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
                  { scale: letters[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                ],
              },
            ]}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>

      <Animated.View
        style={[
          styles.tagline,
          { opacity: tagline, transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        ]}
      >
        <Animated.View style={{ transform: [{ scaleX: tagline }] }}>
          <LinearGradient colors={[...BRAND]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.bar} />
        </Animated.View>
        <Animated.Text style={[styles.taglineText, { color: muted }]}>A calm place to write, plan and sketch</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 100, overflow: "hidden" },
  layer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute" },
  ring: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 1.5 },
  word: { position: "absolute", top: "50%", marginTop: 6, flexDirection: "row" },
  letter: { fontSize: 38, fontWeight: "800", letterSpacing: -1 },
  tagline: { position: "absolute", top: "50%", marginTop: 66, alignItems: "center" },
  bar: { width: 40, height: 3, borderRadius: 2, marginBottom: 12 },
  taglineText: { fontSize: 14, fontWeight: "500", letterSpacing: 0.2 },
});
