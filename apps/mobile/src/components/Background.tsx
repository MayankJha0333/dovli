// The app's background: the theme's colour with soft washes of colour on top, like the web app's
// glows. Frost and Mica use their own glow colours; Soft Studio uses the mark's blue-violet-pink;
// Night Desk keeps it almost black with a faint hint of its accent.

import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { usePalette } from "./ui";

function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

export function Background({ intensity = 1 }: { intensity?: number }) {
  const p = usePalette();
  const glows = p.t.colors.glows;
  const tints: [string, number][] = glows.length
    ? glows.map((g) => [g.color, g.opacity * (p.dark ? 0.6 : 0.5)])
    : p.dark
      ? [
          [p.accent, 0.1],
          ["#7DB4FF", 0.06],
          [p.accent, 0.03],
        ]
      : [
          ["#7DB4FF", 0.28],
          ["#A592FF", 0.22],
          ["#E39AEC", 0.16],
        ];
  const c = (i: number, k = 1) => rgba(tints[i % tints.length][0], tints[i % tints.length][1] * intensity * k);
  const clear = (i: number) => rgba(tints[i % tints.length][0], 0);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]}>
      {/* Top: a wide wash across the header. */}
      <LinearGradient
        colors={[c(0), c(1, 0.8), clear(1)]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.55, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 440 }}
      />
      {/* A second colour from the right, so the wash isn't flat. */}
      <LinearGradient
        colors={[c(2, 0.9), clear(2)]}
        start={{ x: 1, y: 0.1 }}
        end={{ x: 0.35, y: 0.6 }}
        style={{ position: "absolute", top: 0, right: 0, width: "75%", height: 380 }}
      />
      {/* A faint glow low on the screen. */}
      <LinearGradient colors={[clear(1), c(1, 0.35)]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 320 }} />
    </View>
  );
}
