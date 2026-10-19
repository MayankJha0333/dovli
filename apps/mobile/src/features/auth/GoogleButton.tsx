// "Continue with Google", styled like Google asks (white button, the coloured G, dark text), in
// both light and dark themes. Hidden when Google sign-in isn't set up in this build.

import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text } from "react-native";
import { tap, usePalette } from "@/components/ui";
import { AuthError, phoneAuth } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";

export { googleConfigured };

export function GoogleButton({
  label = "Continue with Google",
  disabled,
  onError,
  onBusy,
}: {
  label?: string;
  disabled?: boolean;
  /** Called with what went wrong. A "link-needed" AuthError carries the email in `extra.email`. */
  onError: (error: AuthError) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const p = usePalette();
  const [busy, setBusy] = useState(false);
  if (!googleConfigured) return null;

  const run = async () => {
    if (busy) return;
    tap();
    setBusy(true);
    onBusy?.(true);
    try {
      const done = await phoneAuth.signInWithGoogle();
      if (done) tap("success");
      // On success the app opens Home by itself (see app/_layout.tsx).
    } catch (e) {
      tap("error");
      onError(e instanceof AuthError ? e : new AuthError("Couldn't sign in with Google. Please try again.", "google"));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={() => void run()}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: p.dark ? "#131314" : "#FFFFFF",
          borderColor: p.dark ? "#8E918F" : "#DADCE0",
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={p.dark ? "#E3E3E3" : "#1F1F1F"} />
      ) : (
        <Image source={require("../../../assets/images/google.png")} style={{ width: 20, height: 20 }} accessibilityIgnoresInvertColors />
      )}
      <Text style={{ color: p.dark ? "#E3E3E3" : "#1F1F1F", fontSize: 16.5, fontWeight: "600" }}>{busy ? "Opening Google…" : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20 },
});
