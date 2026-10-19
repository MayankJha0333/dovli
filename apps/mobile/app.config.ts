// Adds to app.json what depends on .env. Google sign-in on iOS returns to the app through a URL
// scheme made from the iOS client ID (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in apps/mobile/.env).
// After changing it, rebuild the app (pnpm --filter @dovli/mobile ios:build).

import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const plugins = [...(config.plugins ?? [])];
  if (iosClientId) {
    const id = iosClientId.replace(/\.apps\.googleusercontent\.com$/, "");
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: `com.googleusercontent.apps.${id}` }]);
  }
  return { ...config, name: config.name ?? "Dovli", slug: config.slug ?? "dovli", plugins };
};
