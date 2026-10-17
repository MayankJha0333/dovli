// Light entry: safe to import anywhere. The heavy editor lives at "@dovli/editor/page-editor"
// so apps can load it lazily (it pulls in BlockNote and Mantine).
export { connectEditor, type EditorBridge } from "./bridge";
export { useIsDark } from "./useIsDark";
export type { DovliEditor } from "./schema";
