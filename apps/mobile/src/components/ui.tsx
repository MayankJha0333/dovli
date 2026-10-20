// The phone app's building blocks, all drawn from the active app theme, so every screen looks like
// one product: buttons, text fields, grouped lists (like iOS Settings), avatars, icons and headers.

import { Children, Fragment, isValidElement, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { space, touchTarget } from "@dovli/theme";
import { solid, useTheme } from "@/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** The mark's colours (blue → violet → pink), for avatars and brand moments. */
export const MARK_GRADIENT = ["#7DB4FF", "#A592FF", "#E39AEC"] as const;

/** Theme colours flattened to solid values for native views. */
export function usePalette() {
  const t = useTheme();
  const bg = t.colors.bg;
  const s = (c: string) => solid(c, bg);
  return {
    t,
    dark: t.scheme === "dark",
    bg,
    panel: s(t.colors.panel === "transparent" ? t.colors.bg : t.colors.panel),
    raised: s(t.colors.raised),
    sidebar: s(t.colors.sidebar),
    well: s(t.colors.well),
    hover: s(t.colors.hover),
    active: s(t.colors.activeBg),
    activeInk: s(t.colors.activeInk),
    line: s(t.colors.line),
    lineStrong: s(t.colors.lineStrong),
    ink: t.colors.ink,
    ink2: t.colors.ink2,
    ink3: t.colors.ink3,
    ink4: t.colors.ink4,
    accent: t.colors.accent,
    accentInk: t.colors.accentInk,
    accentSoft: s(t.colors.accentSoft),
    primary: t.colors.primary,
    primaryInk: t.colors.primaryInk,
    brand: t.colors.brand,
    brandInk: t.colors.brandInk,
    danger: t.colors.danger,
    dangerSoft: s(t.colors.dangerSoft),
    ok: t.colors.ok,
    warn: t.colors.warn,
    radius: t.radius,
  };
}
export type Palette = ReturnType<typeof usePalette>;

/** A light tap you can feel, for buttons and choices. Quietly does nothing where unsupported. */
export function tap(kind: "light" | "select" | "success" | "error" = "light") {
  if (Platform.OS === "web") return;
  const run =
    kind === "select"
      ? Haptics.selectionAsync()
      : kind === "success"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : kind === "error"
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => {});
}

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return <Ionicons name={name} size={size} color={color ?? p.ink2} style={style} accessibilityElementsHidden importantForAccessibility="no" />;
}

/** Dovli's mark (the folded D). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/images/mark.png")}
      style={{ width: Math.round(size * (78 / 96)), height: size }}
      accessibilityIgnoresInvertColors
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Big screen title in the theme's display weight. */
export function Title({ children, style, size = 30 }: { children: ReactNode; style?: StyleProp<TextStyle>; size?: number }) {
  const p = usePalette();
  return (
    <Text
      accessibilityRole="header"
      style={[{ color: p.ink, fontSize: size, lineHeight: Math.round(size * 1.15), letterSpacing: size >= 28 ? -0.8 : -0.3, fontWeight: String(p.t.fonts.displayWeight) as TextStyle["fontWeight"] }, style]}
    >
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  const upper = p.t.layout.label !== "sentence";
  return (
    <Text
      style={[
        { color: p.ink3, fontSize: upper ? 11.5 : 13, fontWeight: "700", letterSpacing: upper ? 0.8 : 0, textTransform: upper ? "uppercase" : "none" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Depth for a raised surface: a soft shadow in light themes, a hairline edge in dark ones. */
export function lift(p: Palette, level: 1 | 2 = 1): ViewStyle {
  if (p.dark) return { borderWidth: StyleSheet.hairlineWidth, borderColor: p.lineStrong };
  // Glass themes get the bright rim their web cards have, so a card reads as frosted glass.
  const glass = p.t.blur.panel > 0;
  return {
    ...(glass && { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.95)" }),
    shadowColor: glass ? "#323C6E" : "#28206E",
    shadowOpacity: level === 1 ? 0.07 : 0.13,
    shadowRadius: level === 1 ? 12 : 24,
    shadowOffset: { width: 0, height: level === 1 ? 4 : 12 },
    elevation: level === 1 ? 2 : 6,
  };
}

export function Card({ children, style, ...rest }: ViewProps) {
  const p = usePalette();
  // The shadow sits on an outer view, so the inner one can clip its corners.
  return (
    <View style={[{ borderRadius: p.radius.lg + 2, backgroundColor: p.panel }, lift(p), style]} {...rest}>
      <View style={{ borderRadius: p.radius.lg + 2, overflow: "hidden", alignSelf: "stretch" }}>{children}</View>
    </View>
  );
}

/* ---------------------------------------------------------------- text */

const TYPE = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.9 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.5 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 16.5, lineHeight: 22, fontWeight: "600", letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: "400" },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  subhead: { fontSize: 14, lineHeight: 19, fontWeight: "400" },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
} as const satisfies Record<string, TextStyle>;
export type TextVariant = keyof typeof TYPE;
type Tone = "ink" | "ink2" | "ink3" | "ink4" | "accent" | "danger" | "ok";

/** Text in the app's type scale: `v` sets size and weight, `tone` the colour. */
export function T({ v = "body", tone = "ink", style, children, ...rest }: { v?: TextVariant; tone?: Tone; style?: StyleProp<TextStyle>; children?: ReactNode } & Omit<ComponentProps<typeof Text>, "style">) {
  const p = usePalette();
  return (
    <Text style={[TYPE[v], { color: p[tone] }, style]} {...rest}>
      {children}
    </Text>
  );
}

/** A section's title, with an optional action on the right ("See all"). */
export function SectionHeader({ title, action, onAction, style, small }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>; small?: boolean }) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: small ? space.xl : space.xl + 4, marginBottom: small ? space.sm : space.sm + 2, paddingHorizontal: space.xs },
        style,
      ]}
    >
      {small ? <Label>{title}</Label> : <T v="title3" accessibilityRole="header">{title}</T>}
      {action && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}>
          <T v="subhead" tone="accent" style={{ fontWeight: "600" }}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A titled group of rows, like a section of iOS Settings. Rows get hairlines between them. */
export function Section({ title, footer, children, style }: { title?: string; footer?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ marginTop: space.xl }, style]}>
      {title && <Label style={{ marginBottom: space.sm, marginLeft: space.xs }}>{title}</Label>}
      <Card>
        {items.map((child, i) => (
          <Fragment key={isValidElement(child) && child.key != null ? child.key : i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.line, marginLeft: space.lg + 34 }} />}
            {child}
          </Fragment>
        ))}
      </Card>
      {footer ? (
        typeof footer === "string" ? (
          <Text style={{ color: p.ink3, fontSize: 12.5, lineHeight: 18, marginTop: space.sm, marginHorizontal: space.xs }}>{footer}</Text>
        ) : (
          footer
        )
      ) : null}
    </View>
  );
}

/** One row in a Section: an icon tile, a title, an optional detail line and something on the right. */
export function Row({
  icon,
  tint,
  title,
  detail,
  value,
  right,
  onPress,
  chevron,
  destructive,
  accessibilityHint,
}: {
  icon?: IconName;
  tint?: string;
  title: string;
  detail?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
}) {
  const p = usePalette();
  const color = destructive ? p.danger : (tint ?? p.accent);
  const body = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: p.hover }]}>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: destructive ? p.dangerSoft : p.accentSoft, borderRadius: 8 }]}>
          <Icon name={icon} size={17} color={color} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: destructive ? p.danger : p.ink, fontSize: 15.5, fontWeight: "500" }} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={{ color: p.ink3, fontSize: 12.5, lineHeight: 17, marginTop: 1 }} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={{ color: p.ink3, fontSize: 14.5, maxWidth: "45%" }} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {(chevron ?? !!onPress) && !right ? <Icon name="chevron-forward" size={16} color={p.ink4} /> : null}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, value, detail].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        tap("select");
        onPress();
      }}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  tone = "primary",
  icon,
  loading,
  disabled,
  size = "md",
  style,
  ...rest
}: {
  title: string;
  tone?: ButtonTone;
  icon?: IconName;
  loading?: boolean;
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
} & Omit<PressableProps, "style" | "children">) {
  const p = usePalette();
  const bg = tone === "primary" ? p.primary : tone === "danger" ? p.dangerSoft : tone === "secondary" ? p.panel : "transparent";
  const fg = tone === "primary" ? p.primaryInk : tone === "danger" ? p.danger : tone === "ghost" ? p.accent : p.ink;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={(e) => {
        tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          minHeight: size === "lg" ? 54 : touchTarget + 2,
          paddingHorizontal: size === "lg" ? 22 : 18,
          borderRadius: size === "lg" ? 16 : p.radius.md + 2,
          backgroundColor: bg,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled && !loading ? 0.45 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        tone === "secondary" && { borderWidth: StyleSheet.hairlineWidth, borderColor: p.lineStrong },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "700", fontSize: size === "lg" ? 16.5 : 15.5 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ label, icon, onPress, size = 22, color }: { label: string; icon: IconName; onPress: () => void; size?: number; color?: string }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        width: touchTarget,
        height: touchTarget,
        borderRadius: touchTarget / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? p.hover : "transparent",
      })}
    >
      <Icon name={icon} size={size} color={color ?? p.ink2} />
    </Pressable>
  );
}

/** A labelled text box. The border turns the accent colour while typing, and red on an error. */
export function TextField({
  label,
  hint,
  error,
  icon,
  style,
  ...input
}: { label: string; hint?: string; error?: string | null; icon?: IconName; style?: StyleProp<ViewStyle> } & TextInputProps) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const border = error ? p.danger : focused ? p.accent : p.line;
  return (
    <View style={style}>
      <Text style={{ color: p.ink2, fontSize: 13.5, fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <View
        style={{
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: space.md + 2,
          borderRadius: p.radius.md + 4,
          backgroundColor: p.panel,
          borderWidth: focused || error ? 1.5 : StyleSheet.hairlineWidth * 2,
          borderColor: border,
        }}
      >
        {icon && <Icon name={icon} size={18} color={focused ? p.accent : p.ink3} />}
        <TextInput
          placeholderTextColor={p.ink4}
          accessibilityLabel={label}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={{ flex: 1, color: p.ink, fontSize: 16.5, paddingVertical: 12 }}
        />
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: p.danger, fontSize: 13, marginTop: 6 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ color: p.ink3, fontSize: 12.5, marginTop: 6 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Six boxes for a sign-in code, typed into one hidden field (so paste and autofill work). */
export function CodeInput({ value, onChange, disabled, error }: { value: string; onChange: (code: string) => void; disabled?: boolean; error?: boolean }) {
  const p = usePalette();
  const ref = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(true);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessible={false}>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
        {Array.from({ length: 6 }, (_, i) => {
          const current = focused && !disabled && (i === value.length || (i === 5 && value.length === 6));
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 54,
                aspectRatio: 0.86,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: current ? p.raised : p.well,
                borderWidth: 1.5,
                borderColor: error ? p.danger : current ? p.accent : value[i] ? p.lineStrong : p.dark ? p.line : "transparent",
              }}
            >
              <Text style={{ color: p.ink, fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{value[i] ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        editable={!disabled}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        accessibilityLabel="6-digit sign-in code"
        caretHidden
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
    </Pressable>
  );
}

// Colours for avatars without a picture: each one dark enough for white letters. A person always
// gets the same one, picked from their email (or name).
const AVATAR_COLORS: [string, string][] = [
  ["#6366F1", "#8B5CF6"],
  ["#3B82F6", "#0891B2"],
  ["#0EA5A4", "#0F766E"],
  ["#10B981", "#047857"],
  ["#F97316", "#DC2626"],
  ["#EC4899", "#BE185D"],
  ["#A855F7", "#7C3AED"],
  ["#0EA5E9", "#4F46E5"],
];

function avatarColors(key: string): [string, string] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** "Monkey D. Luffy" → "ML", "Luffy" → "L", "kaizuku@x.com" → "K". */
function initialsOf(name?: string | null, email?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w));
  if (words.length >= 2) return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
  if (words.length === 1) return Array.from(words[0])[0].toUpperCase();
  const local = (email ?? "").split("@")[0].replace(/[^\p{L}\p{N}]/gu, "");
  return local ? Array.from(local)[0].toUpperCase() : "";
}

/** A person's picture: their Google photo when there is one, otherwise their initials on a colour of their own. */
export function Avatar({ name, email, photo, size = 40, ring }: { name?: string | null; email?: string | null; photo?: string | null; size?: number; ring?: boolean }) {
  const p = usePalette();
  const [failed, setFailed] = useState(false);
  // Google sends a small picture by default; ask for one sharp enough for this size.
  const src = photo && !failed ? photo.replace(/=s\d+(-c)?$/, `=s${Math.round(size * 3)}-c`) : null;
  const initials = initialsOf(name, email);
  const [from, to] = avatarColors((email || name || "").toLowerCase());
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...(ring ? { borderWidth: Math.max(2, size / 28), borderColor: p.raised } : null),
  };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[frame, { backgroundColor: to }]}>
      {src ? (
        <Image source={{ uri: src }} onError={() => setFailed(true)} style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          {initials ? (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * (initials.length > 1 ? 0.38 : 0.44), letterSpacing: 0.2 }}>{initials}</Text>
          ) : (
            <Ionicons name="person" size={size * 0.5} color="#fff" />
          )}
        </LinearGradient>
      )}
    </View>
  );
}

/** A small rounded label: "Synced", "Free", "No password". */
export function Badge({ text, icon, tone = "accent" }: { text: string; icon?: IconName; tone?: "accent" | "ok" | "muted" | "warn" }) {
  const p = usePalette();
  const color = tone === "ok" ? p.ok : tone === "warn" ? p.warn : tone === "muted" ? p.ink3 : p.accent;
  const bg = tone === "accent" ? p.accentSoft : p.well;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, height: 26 }}>
      {icon && <Icon name={icon} size={13} color={color} />}
      <Text style={{ color, fontSize: 12.5, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

/** The bar at the top of a pushed screen: back (or close), a title, and room for one action. */
export function Header({ title, onBack, onClose, right, top }: { title?: string; onBack?: () => void; onClose?: () => void; right?: ReactNode; top: number }) {
  const p = usePalette();
  return (
    <View style={[styles.header, { paddingTop: top + space.xs }]}>
      <View style={{ width: touchTarget }}>{onBack && <IconButton label="Back" icon="chevron-back" size={26} color={p.ink} onPress={onBack} />}</View>
      <Text style={{ flex: 1, textAlign: "center", color: p.ink, fontSize: 17, fontWeight: "700" }} numberOfLines={1} accessibilityRole="header">
        {title ?? ""}
      </Text>
      <View style={{ width: touchTarget, alignItems: "flex-end" }}>{onClose ? <IconButton label="Close" icon="close" size={24} color={p.ink} onPress={onClose} /> : right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 10 },
  rowIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, paddingBottom: space.xs },
});
