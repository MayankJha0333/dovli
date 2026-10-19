import { Stack } from "expo-router";
import { usePalette } from "@/components/ui";

// Sign in and sign up. Only reachable while signed out (see app/_layout.tsx).
export default function AuthLayout() {
  const p = usePalette();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />;
}
