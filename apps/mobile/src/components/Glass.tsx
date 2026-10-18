import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useTheme, solid } from "@/lib/theme";

/**
 * Real Liquid Glass on iOS 26+, and a solid, readable surface in the theme's colours everywhere else
 * (older iOS, Android). Use it only for floating controls, never behind long text.
 */
export function Glass({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView style={style} glassEffectStyle="regular" colorScheme={t.scheme === "dark" ? "dark" : "light"}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        {
          backgroundColor: solid(t.colors.raised, t.colors.bg.length === 7 ? t.colors.bg : "#ffffff"),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: solid(t.colors.lineStrong, t.colors.bg),
          shadowColor: "#000",
          shadowOpacity: t.scheme === "dark" ? 0.4 : 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
