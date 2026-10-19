// A soft wash of the mark's colours (blue, violet, pink) at the top of the screen, fading into the
// theme's background. Used behind the welcome and sign-in screens, like the web sign-in page.

import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { usePalette } from "@/components/ui";

export function Backdrop({ height = 460 }: { height?: number }) {
  const p = usePalette();
  const a = p.dark ? 0.22 : 0.42;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]}>
      <LinearGradient
        // Fade to the same pink at zero opacity: "transparent" is transparent black, which leaves a grey band.
        colors={[`rgba(125,180,255,${a})`, `rgba(165,146,255,${a * 0.75})`, `rgba(227,154,236,${a * 0.35})`, "rgba(227,154,236,0)"]}
        locations={[0, 0.35, 0.68, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
      />
    </View>
  );
}
