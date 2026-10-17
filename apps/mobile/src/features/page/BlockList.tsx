import { StyleSheet, Text, View } from "react-native";
import { color, font, space } from "@dovli/theme";

// A read-only view of a page's blocks. Editing on the phone will use the shared BlockNote editor
// inside a web view (see packages/editor), so this only needs to show text nicely.

function inlineText(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((c: any) => (typeof c === "string" ? c : c.text ?? c.content?.map?.((x: any) => x.text).join("") ?? "")).join("");
}

export function BlockList({ blocks, depth = 0 }: { blocks: any[]; depth?: number }) {
  return (
    <View style={{ gap: space.sm, paddingLeft: depth ? space.lg : 0 }}>
      {blocks.map((b, i) => (
        <View key={b.id ?? i}>
          <Block block={b} />
          {b.children?.length ? <BlockList blocks={b.children} depth={depth + 1} /> : null}
        </View>
      ))}
    </View>
  );
}

function Block({ block }: { block: any }) {
  const text = inlineText(block.content);
  switch (block.type) {
    case "heading":
      return <Text style={[styles.h, block.props?.level === 1 ? styles.h1 : styles.h2]}>{text}</Text>;
    case "bulletListItem":
      return <Text style={styles.p}>•  {text}</Text>;
    case "numberedListItem":
      return <Text style={styles.p}>–  {text}</Text>;
    case "checkListItem":
      return (
        <Text style={[styles.p, block.props?.checked && styles.done]}>
          {block.props?.checked ? "☑" : "☐"}  {text}
        </Text>
      );
    case "quote":
      return <Text style={[styles.p, styles.quote]}>{text}</Text>;
    case "subpage":
      return <Text style={styles.link}>↳ Sub-page</Text>;
    case "embed":
      return <Text style={styles.link}>↗ {block.props?.title || block.props?.link || "Link"}</Text>;
    case "flowchart":
      return <Text style={styles.link}>⇄ Flowchart</Text>;
    default:
      return text ? <Text style={styles.p}>{text}</Text> : null;
  }
}

const styles = StyleSheet.create({
  p: { color: color.inkSoft, fontSize: font.size.body, lineHeight: 25 },
  h: { color: color.ink, fontWeight: "700", marginTop: space.md },
  h1: { fontSize: 24 },
  h2: { fontSize: 19 },
  done: { color: color.inkFaint, textDecorationLine: "line-through" },
  quote: { borderLeftWidth: 3, borderLeftColor: color.line, paddingLeft: space.md, fontStyle: "italic" },
  link: { color: color.accent, fontSize: font.size.body, fontWeight: "600" },
});
