// About Dovli: what it is, what's in this version, what it's built with, and where to find it.

import { Image, Linking, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@dovli/theme";
import { Background } from "@/components/Background";
import { Card, Header, Icon, Row, Section, T, lift, usePalette, type IconName } from "@/components/ui";
import { apiUrl } from "@/lib/firebase";

const features: { icon: IconName; title: string; text: string; tint: string }[] = [
  { icon: "document-text-outline", title: "Pages inside pages", text: "Write notes, plans and docs, and nest them as deep as you like.", tint: "#5146D9" },
  { icon: "checkbox-outline", title: "To-dos, tables and toggles", text: "Type / for any block: headings, lists, quotes, code and more.", tint: "#10B981" },
  { icon: "git-network-outline", title: "Flowcharts and whiteboards", text: "Sketch ideas next to your notes, with shapes that stay connected.", tint: "#F59E0B" },
  { icon: "sparkles-outline", title: "AI that edits with you", text: "Ask about a page, review it, or turn text into a flowchart (on the web).", tint: "#A855F7" },
  { icon: "cloud-done-outline", title: "Works offline, syncs everywhere", text: "Pages save on your phone first, then sync to your account.", tint: "#0EA5E9" },
];

export function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const runtime = Constants.expoConfig?.sdkVersion;

  return (
    <View style={{ flex: 1 }}>
      <Background />
      <Header top={insets.top} title="About" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }} showsVerticalScrollIndicator={false}>
        {/* Who we are */}
        <View style={{ alignItems: "center", marginTop: space.lg }}>
          <View style={[styles.icon, lift(p, 2)]}>
            <Image source={require("../../../assets/images/icon.png")} style={{ width: 96, height: 96, borderRadius: 24 }} accessibilityIgnoresInvertColors />
          </View>
          <T v="largeTitle" style={{ marginTop: space.lg }}>
            Dovli
          </T>
          <T v="callout" tone="ink2" style={{ marginTop: 4, textAlign: "center" }}>
            A calm place to write, plan and sketch.
          </T>
          <View style={[styles.version, { backgroundColor: p.panel }, lift(p)]}>
            <T v="caption" tone="ink2">
              Version {version}
              {runtime ? ` · Expo SDK ${runtime.split(".")[0]}` : ""}
            </T>
          </View>
        </View>

        {/* What it does */}
        <Card style={{ marginTop: space.xl, paddingVertical: space.sm }}>
          {features.map((f, i) => (
            <View key={f.title} style={[styles.feature, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }]}>
              <View style={[styles.featureIcon, { backgroundColor: f.tint }]}>
                <Icon name={f.icon} size={17} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="headline" style={{ fontSize: 15.5 }}>
                  {f.title}
                </T>
                <T v="footnote" tone="ink3" style={{ marginTop: 2 }}>
                  {f.text}
                </T>
              </View>
            </View>
          ))}
        </Card>

        <Section title="What's new in this version">
          <Row icon="person-add-outline" title="Accounts on your phone" detail="Sign in or sign up with Google, or with a code we email you." />
          <Row icon="color-palette-outline" title="A fresh look" detail="New home screen, page info, templates and trash, in every theme." />
          <Row icon="sync-outline" title="Sync with the web" detail="The same pages on your phone and computer." />
        </Section>

        <Section title="Dovli everywhere">
          {apiUrl ? <Row icon="globe-outline" title="Dovli on the web" detail="AI, whiteboards and more" onPress={() => Linking.openURL(`${apiUrl}/`).catch(() => {})} /> : null}
          <Row icon="logo-apple" title="iPhone and iPad" detail="You're using it" />
          <Row icon="logo-android" title="Android" detail="Coming soon" />
          <Row icon="extension-puzzle-outline" title="Browser extension" detail="Clip the web into Dovli. Coming soon" />
        </Section>

        <Section title="Privacy">
          <Row icon="shield-checkmark-outline" title="Your pages are yours" detail="Private to your account, never used to train AI." />
        </Section>

        <Section title="Built with" footer="Thank you to the open-source projects Dovli is built on.">
          <Row icon="code-slash-outline" title="Expo and React Native" detail="The app itself" />
          <Row icon="create-outline" title="BlockNote" detail="The block editor" />
          <Row icon="brush-outline" title="Excalidraw" detail="Whiteboards and flowcharts" />
          <Row icon="flame-outline" title="Firebase" detail="Accounts and sync" />
        </Section>

        <View style={{ alignItems: "center", marginTop: space.xl, gap: 4 }}>
          <T v="caption" tone="ink4" style={{ fontWeight: "400" }}>
            © {new Date().getFullYear()} Dovli · Made with care
          </T>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { borderRadius: 24, backgroundColor: "#fff" },
  version: { marginTop: space.md, paddingHorizontal: 12, height: 28, borderRadius: 999, justifyContent: "center" },
  feature: { flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12, alignItems: "flex-start" },
  featureIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
});
