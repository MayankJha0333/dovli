// Text filled with a gradient (the mark's blue → violet by default), for brand moments in headlines.

import type { ComponentType, ReactElement } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewProps } from "react-native";
import MaskedViewNative from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

// Its class typings fail React 19's JSX element check; the component itself works.
const MaskedView = MaskedViewNative as unknown as ComponentType<ViewProps & { maskElement: ReactElement }>;

export function GradientText({
  children,
  style,
  colors = ["#4F6BF2", "#7B5CF0"],
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  colors?: readonly [string, string, ...string[]];
}) {
  return (
    <MaskedView maskElement={<Text style={[style, { color: "#000" }]}>{children}</Text>}>
      {/* An invisible copy gives the masked area its size. */}
      <View style={{ opacity: 0 }}>
        <Text style={style}>{children}</Text>
      </View>
      <LinearGradient colors={colors} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
    </MaskedView>
  );
}
