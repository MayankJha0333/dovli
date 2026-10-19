import { useCallback, useEffect, useState } from "react";
import { LogBox, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Splash } from "@/components/Splash";
import { useTheme } from "@/lib/theme";
import { canUseApp, usePhoneAuth } from "@/lib/auth";
import { startSync } from "@/lib/sync";

// Keep the system splash up until we know who's signed in and the icons are loaded.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Expo sends the page editor its settings the moment it's created, a beat before the editor's web
// view is ready, and that first send fails. It's harmless: Expo sends them again once the editor
// has loaded. Hide the dev warning it leaves behind.
LogBox.ignoreLogs([/Unable to find the 'DomWebView' view with tag/]);

// Opening the app from a link (dovli://settings, a page link) still puts Home underneath, so Back
// and Close always have somewhere to go.
export const unstable_settings = { initialRouteName: "index" };

export default function RootLayout() {
  const t = useTheme();
  const auth = usePhoneAuth();
  const [fonts, fontError] = useFonts(Ionicons.font);
  const [splashDone, setSplashDone] = useState(false);
  const onSplashDone = useCallback(() => setSplashDone(true), []);

  useEffect(() => startSync(), []);

  const ready = (fonts || !!fontError) && auth.status !== "loading";
  if (!ready) return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;

  // Who sees what: the first screen ("/") shows Home or Welcome by itself (app/index.tsx). Pages
  // and Settings need the app; sign in and sign up are only there while signed out.
  const signedIn = auth.status === "signed-in";
  const inApp = canUseApp(auth);

  return (
    <SafeAreaProvider>
      <StatusBar style={t.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg }, animation: "default" }}>
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="page/[id]" />
          <Stack.Screen name="settings" options={{ presentation: "modal" }} />
          <Stack.Screen name="templates" options={{ presentation: "modal" }} />
          <Stack.Screen name="info/[id]" options={{ presentation: "formSheet", sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
          <Stack.Screen name="trash" />
          <Stack.Screen name="about" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn && auth.status !== "local-only"}>
          <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        </Stack.Protected>
      </Stack>
      {!splashDone && <Splash onDone={onSplashDone} />}
    </SafeAreaProvider>
  );
}
