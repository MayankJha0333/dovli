import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { color } from "@dovli/theme";

/**
 * Real Liquid Glass on iOS 26+, and a solid, readable fallback everywhere else
 * (older iOS, Android). Use it only for floating controls, never behind long text.
 */
export function Glass({
  children,
  style,
  tone = "light",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: "light" | "clear";
}) {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView style={style} glassEffectStyle={tone === "clear" ? "clear" : "regular"}>
        {children}
      </GlassView>
    );
  }
  return <View style={[tone === "clear" ? styles.clear : styles.light, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  light: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    shadowColor: "#141830",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  clear: {
    backgroundColor: "rgba(20,28,70,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.45)",
  },
});
