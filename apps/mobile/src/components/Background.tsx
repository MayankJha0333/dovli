// The app's background: the theme's colour with soft round glows on top, placed like the web app's
// blurred glows. Frost and Mica use their own glow colours; Soft Studio uses the mark's
// blue-violet-pink; Night Desk keeps it almost black with a faint hint of its accent.

import { StyleSheet, View, useWindowDimensions } from "react-native";
import { usePalette } from "./ui";

function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

// There's no blur filter for plain views, so a glow is a stack of faint circles, each a little
// smaller: together they fade from `alpha` at the centre to nothing at the edge, with steps too
// small to see.
const RINGS = 30;

function Glow({ color, alpha, x, y, size }: { color: string; alpha: number; x: number; y: number; size: number }) {
  const step = 1 - Math.pow(1 - Math.min(alpha, 0.95), 1 / RINGS);
  return (
    <>
      {Array.from({ length: RINGS }, (_, i) => {
        const d = size * (1 - i / RINGS);
        return <View key={i} style={{ position: "absolute", left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: rgba(color, step) }} />;
      })}
    </>
  );
}

/** Where each glow sits, as fractions of the screen, and its size as a fraction of the width. */
const SPOTS = [
  { x: 0.05, y: 0.06, size: 1.5 },
  { x: 1.0, y: 0.42, size: 1.35 },
  { x: 0.35, y: 1.0, size: 1.5 },
  { x: 0.95, y: 0.02, size: 1.0 },
];

export function Background({ intensity = 1 }: { intensity?: number }) {
  const p = usePalette();
  const { width, height } = useWindowDimensions();
  const glows = p.t.colors.glows;
  const tints: [string, number][] = glows.length
    ? [...glows.map((g): [string, number] => [g.color, g.opacity * (p.dark ? 0.55 : 0.6)]), [glows[1 % glows.length].color, glows[1 % glows.length].opacity * (p.dark ? 0.3 : 0.45)]]
    : p.dark
      ? [
          [p.accent, 0.12],
          ["#7DB4FF", 0.07],
          [p.accent, 0.05],
          ["#7DB4FF", 0.04],
        ]
      : [
          ["#8DBBFF", 0.42],
          ["#E3A4F0", 0.3],
          ["#B4A4FF", 0.3],
          ["#B4A4FF", 0.36],
        ];
  return (
    <View pointerEvents="none" renderToHardwareTextureAndroid style={[StyleSheet.absoluteFill, { backgroundColor: p.bg, overflow: "hidden" }]}>
      {SPOTS.map((s, i) => (
        <Glow key={i} color={tints[i % tints.length][0]} alpha={tints[i % tints.length][1] * intensity} x={s.x * width} y={s.y * height} size={s.size * width} />
      ))}
    </View>
  );
}
