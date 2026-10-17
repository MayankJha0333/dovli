import { useEffect } from "react";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { isLikelyUrl, normalizeUrl, classify, toEmbedProps, type Page } from "@dovli/core";
import { getStyle } from "@dovli/theme";
import { schema, type DovliEditor } from "./schema";
import { useBridge, type EditorBridge } from "./bridge";
import { useIsDark } from "./useIsDark";

function pageItems(editor: DovliEditor, parent: Page, bridge: EditorBridge): DefaultReactSuggestionItem[] {
  const insertChild = (kind: "doc" | "board") => {
    const child = bridge.createPage({ parentId: parent.id, kind });
    insertOrUpdateBlockForSlashMenu(editor, { type: "subpage", props: { pageId: child.id } } as any);
  };
  const insert = (block: any) => insertOrUpdateBlockForSlashMenu(editor, block);
  return [
    {
      title: "Flowchart",
      subtext: "Boxes and arrows, drawn right in the page",
      aliases: ["flow", "flowchart", "diagram", "chart", "process"],
      group: "Embeds",
      icon: <span className="slash-glyph">⇄</span>,
      onItemClick: () => insert({ type: "flowchart" }),
    },
    {
      title: "Link preview",
      subtext: "A card for a video, image or web page",
      aliases: ["embed", "link", "url", "video", "youtube", "vimeo", "loom", "bookmark", "image"],
      group: "Embeds",
      icon: <span className="slash-glyph">↗</span>,
      onItemClick: () => insert({ type: "embed", props: { link: "" } }),
    },
    {
      title: "Sub-page",
      subtext: "A new page inside this one",
      aliases: ["page", "subpage", "nested", "child"],
      group: "Pages",
      icon: <span className="slash-glyph">¶</span>,
      onItemClick: () => insertChild("doc"),
    },
    {
      title: "Whiteboard",
      subtext: "A canvas for shapes, arrows and sketches",
      aliases: ["board", "canvas", "draw", "diagram", "excalidraw"],
      group: "Pages",
      icon: <span className="slash-glyph">◇</span>,
      onItemClick: () => insertChild("board"),
    },
  ];
}

export default function PageEditor({
  page,
  onReady,
}: {
  page: Page;
  onReady?: (editor: DovliEditor | null) => void;
}) {
  const bridge = useBridge();
  const systemDark = useIsDark();
  // A styled page brings its own paper, so the editor follows the paper, not the system theme.
  const style = getStyle(page.style);
  const dark = style ? !!style.dark : systemDark;
  const editor = useCreateBlockNote(
    {
      schema,
      initialContent: page.blocks && page.blocks.length ? (page.blocks as any) : undefined,
      placeholders: { default: "Write, or type / for blocks", emptyDocument: "Start writing, or type / for blocks" },
      // Paste a link on an empty line and it becomes a preview card, like in WhatsApp.
      // Pasting a link inside a sentence still makes a normal text link.
      pasteHandler: ({ event, editor, defaultPasteHandler }) => {
        const data = event.clipboardData;
        const text = data?.getData("text/plain")?.trim() ?? "";
        if (text && isLikelyUrl(text) && !data?.files?.length) try {
          const block: any = editor.getTextCursorPosition().block;
          const empty = block.type === "paragraph" && (!block.content || block.content.length === 0);
          if (empty) {
            const url = normalizeUrl(text);
            const [embed] = (editor as any).replaceBlocks([block.id], [
              { type: "embed", props: toEmbedProps(classify(url), "loading") },
            ]).insertedBlocks;
            const [next] = editor.insertBlocks([{ type: "paragraph" }], embed.id, "after");
            editor.setTextCursorPosition(next.id, "start");
            return true;
          }
        } catch (err) {
          console.error("[dovli] link preview paste failed", err);
        }
        return defaultPasteHandler();
      },
    },
    [page.id],
  );

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  return (
    <BlockNoteView
      editor={editor}
      theme={dark ? "dark" : "light"}
      slashMenu={false}
      onChange={() => bridge.saveBlocks(page.id, editor.document as any[])}
      className="dovli-editor"
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems([...getDefaultReactSlashMenuItems(editor), ...pageItems(editor, page, bridge)], query)
        }
      />
    </BlockNoteView>
  );
}
