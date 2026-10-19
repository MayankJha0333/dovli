// The background of the welcome and sign-in screens: plain white in light themes (the theme's own
// background in dark ones), with a faint wash of the mark's blue and violet at the very top.

import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MARK_GRADIENT, usePalette } from "@/components/ui";

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The screen colour behind the welcome and sign-in screens. */
export function useBackdropColor() {
  const p = usePalette();
  return p.dark ? p.bg : p.raised;
}

export function Backdrop({ height = 360 }: { height?: number }) {
  const p = usePalette();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: useBackdropColor() }]}>
      <LinearGradient
        // Fade to the same colour at zero opacity: "transparent" is transparent black, which leaves a grey band.
        colors={[rgba(MARK_GRADIENT[0], p.dark ? 0.12 : 0.16), rgba(MARK_GRADIENT[1], p.dark ? 0.06 : 0.07), rgba(MARK_GRADIENT[1], 0)]}
        locations={[0, 0.5, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
      />
    </View>
  );
}
