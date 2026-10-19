// The hand-off from the system splash screen to the app. The system splash (set in app.json via
// expo-splash-screen) shows the mark on a plain background while the app loads. This screen starts
// as an exact copy of it, so swapping is invisible; then the word "Dovli" rises in under the mark,
// and the whole screen fades away as the mark grows slightly. With Reduce Motion on, it just fades.

import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, useColorScheme } from "react-native";
import * as SplashScreen from "expo-splash-screen";

/** Must match the expo-splash-screen settings in app.json. */
export const SPLASH = { light: "#EDEFF4", dark: "#08090B", imageWidth: 200 } as const;

export function Splash({ onDone }: { onDone: () => void }) {
  const dark = useColorScheme() === "dark";
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // This screen is now drawn under the system splash: hide that one.
      await SplashScreen.hideAsync().catch(() => {});
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (cancelled) return;
      const ease = Easing.bezier(0.2, 0.7, 0.2, 1);
      const steps = reduce
        ? [Animated.timing(out, { toValue: 1, duration: 220, useNativeDriver: true })]
        : [
            Animated.timing(word, { toValue: 1, duration: 420, easing: ease, useNativeDriver: true }),
            Animated.delay(380),
            Animated.timing(out, { toValue: 1, duration: 420, easing: ease, useNativeDriver: true }),
          ];
      Animated.sequence(steps).start(() => !cancelled && onDone());
    })();
    return () => {
      cancelled = true;
    };
  }, [word, out, onDone]);

  const size = SPLASH.imageWidth;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: dark ? SPLASH.dark : SPLASH.light, opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: word.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
            { scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
          ],
        }}
      >
        <Image source={require("../../assets/images/splash-icon.png")} style={{ width: size, height: size }} />
      </Animated.View>
      <Animated.Text
        style={[
          styles.word,
          {
            color: dark ? "#F4F4F6" : "#15171D",
            opacity: word,
            transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [12, -28] }) }],
          },
        ]}
      >
        Dovli
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 100 },
  word: { position: "absolute", top: "50%", marginTop: 62, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
});
