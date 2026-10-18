// Small building blocks for the phone app, all drawn from the active app theme.

import type { ReactNode } from "react";
import { Pressable, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from "react-native";
import { touchTarget } from "@dovli/theme";
import { solid, useTheme } from "@/lib/theme";

/** Theme colours flattened to solid values for native views. */
export function usePalette() {
  const t = useTheme();
  const bg = t.colors.bg;
  const s = (c: string) => solid(c, bg);
  return {
    t,
    bg,
    panel: s(t.colors.panel === "transparent" ? t.colors.bg : t.colors.panel),
    sidebar: s(t.colors.sidebar),
    well: s(t.colors.well),
    hover: s(t.colors.hover),
    active: s(t.colors.activeBg),
    activeInk: s(t.colors.activeInk),
    line: s(t.colors.line),
    ink: t.colors.ink,
    ink2: t.colors.ink2,
    ink3: t.colors.ink3,
    accent: t.colors.accent,
    accentInk: t.colors.accentInk,
    accentSoft: s(t.colors.accentSoft),
    primary: t.colors.primary,
    primaryInk: t.colors.primaryInk,
    brand: t.colors.brand,
    brandInk: t.colors.brandInk,
    danger: t.colors.danger,
    radius: t.radius,
  };
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  const upper = p.t.layout.label !== "sentence";
  return (
    <Text
      style={[
        { color: p.ink3, fontSize: upper ? 11 : 13, fontWeight: "700", letterSpacing: upper ? 0.8 : 0, textTransform: upper ? "uppercase" : "none" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style, ...rest }: ViewProps) {
  const p = usePalette();
  return (
    <View style={[{ backgroundColor: p.panel, borderRadius: p.radius.lg, overflow: "hidden" }, style]} {...rest}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  tone = "primary",
  style,
  ...rest
}: { title: string; tone?: "primary" | "secondary" | "danger"; style?: StyleProp<ViewStyle> } & Omit<PressableProps, "style">) {
  const p = usePalette();
  const bg = tone === "primary" ? p.primary : tone === "danger" ? p.danger : p.well;
  const fg = tone === "primary" ? p.primaryInk : tone === "danger" ? "#fff" : p.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: touchTarget, paddingHorizontal: 18, borderRadius: p.radius.md, backgroundColor: bg, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 },
        style,
      ]}
      {...rest}
    >
      <Text style={{ color: fg, fontWeight: "700", fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: touchTarget, height: touchTarget, borderRadius: touchTarget / 2, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? p.hover : "transparent" })}
    >
      <Text style={{ color: p.ink2, fontSize: 20 }}>{glyph}</Text>
    </Pressable>
  );
}
