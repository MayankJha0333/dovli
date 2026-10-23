import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { SideMenuExtension, SuggestionMenu } from "@blocknote/core/extensions";
import { en } from "@blocknote/core/locales";
import {
  BasicTextStyleButton,
  BlockColorsItem,
  DragHandleMenu,
  FormattingToolbar,
  FormattingToolbarController,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  useCreateBlockNote,
  useExtensionState,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { SlashMenu } from "./SlashMenu";
import "@blocknote/mantine/style.css";
import { classify, displayTitle, isLikelyUrl, livePages, mergeBlocks, normalizeUrl, toEmbedProps, type Page } from "@dovli/core";
import { getStyle } from "@dovli/theme";
import { Icon, type IconName } from "@dovli/ui";
import { schema, type DovliEditor } from "./schema";
import { useBridge, type EditorBridge } from "./bridge";
import { PageDarkContext, useIsDark } from "./useIsDark";
import { newTable } from "./blocks/dataTable";
import { tagFromEvent, tagsExtension } from "./tags";
import { handleTopEdgeKey } from "./topEdge";
import { fixBlockDropPosition } from "./dropPosition";
import { repairEditorA11y } from "./a11y";

const glyph = (name: IconName) => <Icon name={name} size={18} />;

/**
 * The "/" menu shows a heading each time the group changes, so items of one group must sit
 * together (our extra Media and Basic blocks items would otherwise start a second group with the
 * same name). Keeps groups in the order they first appear, and items in their order inside it.
 */
function groupTogether<T extends { group?: string }>(items: T[]): T[] {
  const order = new Map<string, number>();
  items.forEach((it) => order.has(it.group ?? "") || order.set(it.group ?? "", order.size));
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => order.get(a.it.group ?? "")! - order.get(b.it.group ?? "")! || a.i - b.i)
    .map(({ it }) => it);
}

/** Dovli's own entries in the "/" menu. */
function dovliItems(editor: DovliEditor, page: Page, bridge: EditorBridge): DefaultReactSuggestionItem[] {
  const insert = (block: any) => insertOrUpdateBlockForSlashMenu(editor, block);
  const insertChild = (kind: "doc" | "board") => {
    const child = bridge.createPage({ parentId: page.id, kind });
    insert({ type: "subpage", props: { pageId: child.id } });
  };
  const items: DefaultReactSuggestionItem[] = [
    {
      title: "Callout",
      subtext: "A highlighted box for tips and warnings",
      aliases: ["callout", "note", "tip", "warning", "info", "alert", "box"],
      group: "Basic blocks",
      icon: glyph("callout"),
      onItemClick: () => insert({ type: "callout", props: { tone: "note" } }),
    },
    {
      title: "Sortable table",
      subtext: "Rows and typed columns you can sort",
      aliases: ["database", "list", "sort", "columns", "tracker", "data", "spreadsheet", "table"],
      group: "Advanced",
      icon: glyph("table"),
      onItemClick: () => insert({ type: "dataTable", props: { data: JSON.stringify(newTable()) } }),
    },
    {
      title: "Link to page",
      subtext: "Mention another page. Or type [[",
      aliases: ["link", "page", "mention", "reference", "[["],
      group: "Pages",
      icon: glyph("link"),
      // Opened a moment later, once the "/" menu has closed and removed what was typed.
      onItemClick: () => setTimeout(() => editor.getExtension(SuggestionMenu)?.openSuggestionMenu("[["), 0),
    },
    {
      title: "Sub-page",
      subtext: "A new page inside this one",
      aliases: ["page", "subpage", "nested", "child"],
      group: "Pages",
      icon: glyph("pagePlus"),
      onItemClick: () => insertChild("doc"),
    },
    {
      title: "Whiteboard",
      subtext: "A canvas for shapes, arrows and sketches",
      aliases: ["board", "canvas", "draw", "diagram", "excalidraw"],
      group: "Pages",
      icon: glyph("board"),
      onItemClick: () => insertChild("board"),
    },
    {
      title: "Flowchart",
      subtext: "Boxes and arrows, drawn right in the page",
      aliases: ["flow", "flowchart", "diagram", "chart", "process"],
      group: "Embeds",
      icon: glyph("sync"),
      onItemClick: () => insert({ type: "flowchart" }),
    },
    {
      title: "Link preview",
      subtext: "A card for a video, image or web page",
      aliases: ["embed", "link", "url", "video", "youtube", "vimeo", "loom", "bookmark"],
      group: "Embeds",
      icon: glyph("share"),
      onItemClick: () => insert({ type: "embed", props: { link: "" } }),
    },
  ];
  if (bridge.uploadFile)
    items.push({
      title: "PDF",
      subtext: "Show a PDF inside the page",
      aliases: ["pdf", "document", "attachment"],
      group: "Media",
      icon: glyph("pdf"),
      onItemClick: () => insert({ type: "pdf" }),
    });
  return items;
}

// BlockNote's code button shows no shortcut, though ⌘E (Ctrl+E) toggles code.
const dictionary = { ...en, formatting_toolbar: { ...en.formatting_toolbar, code: { tooltip: "Inline code", secondary_tooltip: "Mod+E" } } };

function toolbarItems() {
  const items = getFormattingToolbarItems();
  const at = items.findIndex((item) => item.key === "strikeStyleButton");
  items.splice(at + 1, 0, <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />);
  return items;
}

/** "Ask AI" in the toolbar that appears over selected text. */
function AIButton() {
  const editor = useBlockNoteEditor() as unknown as DovliEditor;
  const bridge = useBridge();
  const Components = useComponentsContext()!;
  if (!bridge.openAI || !editor.isEditable) return null;
  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      label="Ask AI"
      mainTooltip="Ask AI to rewrite, shorten, fix or translate"
      icon={<Icon name="sparkles" size={16} />}
      onClick={() => {
        const view = editor.prosemirrorView;
        const { from, to } = view.state.selection;
        const text = editor.getSelectedText();
        bridge.openAI!({
          text,
          replace: (t) => view.dispatch(view.state.tr.insertText(t, from, to)),
          insertAfter: (t) => {
            const blocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
            const last = blocks[blocks.length - 1];
            const paras = t.split(/\n{2,}/).map((x) => ({ type: "paragraph" as const, content: x.trim() }));
            editor.insertBlocks(paras as any, last.id, "after");
          },
        });
      }}
    >
      <span className="ml-1 text-sm font-semibold">Ask AI</span>
    </Components.FormattingToolbar.Button>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const Components = useComponentsContext()!;
  return (
    <Components.Generic.Menu.Item className="bn-menu-item" onClick={onClick}>
      {children}
    </Components.Generic.Menu.Item>
  );
}

/** The menu behind each block's drag handle: delete, colours, duplicate, move to another page. */
function BlockMenu({ pageId }: { pageId: string }) {
  const editor = useBlockNoteEditor() as unknown as DovliEditor;
  const bridge = useBridge();
  const block = useExtensionState(SideMenuExtension, { editor: editor as any, selector: (s: any) => s?.block });
  const targets = () => {
    const sel = editor.getSelection()?.blocks;
    return block && sel?.some((b) => b.id === block.id) ? sel : block ? [block] : [];
  };
  return (
    <DragHandleMenu>
      <RemoveBlockItem>Delete</RemoveBlockItem>
      <BlockColorsItem>Colour</BlockColorsItem>
      <MenuItem
        onClick={() => {
          const list = targets();
          if (!list.length) return;
          const strip = (b: any): any => {
            const { id: _id, ...rest } = b;
            return { ...rest, children: (b.children ?? []).map(strip) };
          };
          editor.insertBlocks(list.map(strip), list[list.length - 1].id, "after");
        }}
      >
        Duplicate
      </MenuItem>
      {bridge.pickPage && bridge.appendBlocks && (
        <MenuItem
          onClick={async () => {
            const list = targets();
            if (!list.length) return;
            const to = await bridge.pickPage!({ title: list.length > 1 ? `Move ${list.length} blocks to…` : "Move block to…", exclude: pageId });
            if (!to) return;
            bridge.appendBlocks!(to, structuredClone(list));
            editor.removeBlocks(list.map((b) => b.id));
            bridge.notify?.(list.length > 1 ? `Moved ${list.length} blocks` : "Moved 1 block");
          }}
        >
          Move to page…
        </MenuItem>
      )}
    </DragHandleMenu>
  );
}

export default function PageEditor({
  page,
  onReady,
  readOnly = false,
  spellcheck = true,
  onExitTop,
  touch = false,
}: {
  page: Page;
  onReady?: (editor: DovliEditor | null) => void;
  readOnly?: boolean;
  spellcheck?: boolean;
  /** Phone layout: no floating format bar or block handles. Both are made for a mouse; on a phone
   *  "/" picks the block, markdown shortcuts and the system's text menu do the formatting. */
  touch?: boolean;
  /** Backspace, ← or ↑ at the very top of the page: move to the title (see topEdge.ts). */
  onExitTop?: () => void;
}) {
  const bridge = useBridge();
  const appDark = useIsDark();
  // A styled page brings its own paper, so the editor follows the paper, not the app theme.
  const style = getStyle(page.style);
  const dark = style ? !!style.dark : appDark;

  const editor = useCreateBlockNote(
    {
      schema,
      dictionary,
      extensions: [tagsExtension],
      // The line that shows where a dragged block will land, in the theme's accent colour.
      dropCursor: { width: 3, color: "var(--d-accent)" },
      initialContent: page.blocks && page.blocks.length ? (page.blocks as any) : undefined,
      placeholders: { default: "Write, or type / for blocks", emptyDocument: "Start writing, or type / for blocks" },
      tables: { headers: true, cellBackgroundColor: true, cellTextColor: true, splitCells: true },
      uploadFile: bridge.uploadFile ? (file: File) => bridge.uploadFile!(file) : undefined,
      resolveFileUrl: bridge.resolveFileUrl,
      // Paste a link on an empty line and it becomes a preview card, like in a chat app.
      // Pasting a link inside a sentence still makes a normal text link.
      pasteHandler: ({ event, editor, defaultPasteHandler }) => {
        const data = event.clipboardData;
        const text = data?.getData("text/plain")?.trim() ?? "";
        if (text && isLikelyUrl(text) && !data?.files?.length)
          try {
            const block: any = editor.getTextCursorPosition().block;
            const empty = block.type === "paragraph" && (!block.content || block.content.length === 0);
            if (empty) {
              const url = normalizeUrl(text);
              const [embed] = (editor as any).replaceBlocks([block.id], [{ type: "embed", props: toEmbedProps(classify(url), "loading") }]).insertedBlocks;
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

  // What the page looked like when it was last saved (or opened).
  const saved = useRef("");
  useMemo(() => {
    saved.current = JSON.stringify(editor.document);
  }, [editor]);

  // The page changed somewhere else (another device, or an AI app through Dovli's MCP server)
  // while it is open here: show the new version at once, keeping the cursor in the same block.
  // Our own saves come back the same way; those match what the editor already shows.
  // The incoming page already holds everything saved from here (sync merges, never goes back), so
  // it's shown as is; typing not saved yet is merged with it, so neither side is lost.
  const incoming = useMemo(() => JSON.stringify(page.blocks ?? []), [page.blocks]);
  const seen = useRef(incoming);
  const applying = useRef(false);
  useEffect(() => {
    if (incoming === seen.current) return;
    seen.current = incoming;
    const shown = JSON.stringify(editor.document);
    if (incoming === saved.current || incoming === shown) return;
    const remote = (page.blocks?.length ? page.blocks : [{ type: "paragraph" }]) as any[];
    const unsaved = shown !== saved.current;
    const next = unsaved ? mergeBlocks(JSON.parse(saved.current), editor.document as any[], remote) : remote;
    let at: string | undefined;
    try {
      at = editor.getTextCursorPosition().block.id;
    } catch {
      at = undefined;
    }
    const focused = !!editor.domElement?.contains(document.activeElement);
    applying.current = true;
    try {
      editor.replaceBlocks(editor.document, next);
    } finally {
      applying.current = false;
    }
    saved.current = JSON.stringify(editor.document);
    if (unsaved) bridge.saveBlocks(page.id, editor.document as any[]);
    if (focused && at && editor.getBlock(at)) {
      try {
        editor.setTextCursorPosition(at, "end");
      } catch {
        /* the block can't hold a cursor any more */
      }
    }
  }, [incoming, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dragged blocks land above or below a block by height (see dropPosition.ts).
  useEffect(() => {
    let undo = () => {};
    let stopA11y = () => {};
    const apply = () => {
      undo();
      undo = fixBlockDropPosition(editor);
      stopA11y();
      stopA11y = repairEditorA11y(editor);
    };
    const off = editor.onMount(apply);
    const id = requestAnimationFrame(apply);
    return () => {
      cancelAnimationFrame(id);
      off?.();
      undo();
      stopA11y();
    };
  }, [editor]);

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  useEffect(() => {
    const el = editor.domElement;
    el?.setAttribute("spellcheck", String(spellcheck));
    el?.setAttribute("aria-label", readOnly ? `${page.title || "Untitled"}, page content` : "Page content. Type / for blocks, [[ to link a page");
  }, [editor, spellcheck, readOnly, page.title]);

  const linkItems = useMemo(
    () => (query: string): DefaultReactSuggestionItem[] => {
      const q = query.trim().toLowerCase();
      const found = livePages(bridge.getPages())
        .filter((p) => p.id !== page.id && (!q || displayTitle(p).toLowerCase().includes(q)))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map<DefaultReactSuggestionItem>((p) => ({
          title: displayTitle(p),
          subtext: p.kind === "board" ? "Whiteboard" : "Page",
          group: "Link to a page",
          icon: <span className="font-serif text-lg leading-none">{p.mark}</span>,
          onItemClick: () => editor.insertInlineContent([{ type: "pageLink", props: { pageId: p.id, title: displayTitle(p) } } as any, " "]),
        }));
      if (q && !found.some((f) => f.title.toLowerCase() === q))
        found.push({
          title: `Create “${query.trim()}”`,
          subtext: "A new page inside this one",
          group: "Link to a page",
          icon: glyph("pagePlus"),
          onItemClick: () => {
            const created = bridge.createPage({ parentId: page.id, kind: "doc", title: query.trim() });
            editor.insertInlineContent([{ type: "pageLink", props: { pageId: created.id, title: created.title } } as any, " "]);
          },
        });
      return found;
    },
    [page.id, editor, bridge],
  );

  return (
    <PageDarkContext.Provider value={dark}>
      <div
        onKeyDownCapture={(e) => {
          if (onExitTop && !readOnly) handleTopEdgeKey(editor, e, onExitTop);
        }}
        onClick={(e) => {
          // ⌘/Ctrl-click a #tag to see every page with it.
          if (!(e.metaKey || e.ctrlKey) || !bridge.openTag) return;
          const tag = tagFromEvent(e);
          if (tag) {
            e.preventDefault();
            bridge.openTag(tag);
          }
        }}
      >
        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          theme={dark ? "dark" : "light"}
          slashMenu={false}
          sideMenu={false}
          formattingToolbar={false}
          onChange={() => {
            if (readOnly) return;
            if (applying.current) {
              saved.current = JSON.stringify(editor.document);
              return;
            }
            // The editor also reports changes it makes itself (tidying the page as it loads).
            // Only save when the content is really different, so opening a page isn't an edit.
            const json = JSON.stringify(editor.document);
            if (json === saved.current) return;
            saved.current = json;
            bridge.saveBlocks(page.id, editor.document as any[]);
          }}
          className="dovli-editor"
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) => filterSuggestionItems(groupTogether([...getDefaultReactSlashMenuItems(editor), ...dovliItems(editor, page, bridge)]), query)}
            suggestionMenuComponent={SlashMenu}
          />
          <SuggestionMenuController triggerCharacter="[[" getItems={async (query) => linkItems(query)} suggestionMenuComponent={SlashMenu} />
          {!touch && <SideMenuController sideMenu={(props) => <SideMenu {...props} dragHandleMenu={() => <BlockMenu pageId={page.id} />} />} />}
          {!touch && (
            <FormattingToolbarController
              formattingToolbar={() => (
                <FormattingToolbar>
                  <AIButton key="ai" />
                  {toolbarItems()}
                </FormattingToolbar>
              )}
            />
          )}
        </BlockNoteView>
        {!readOnly && (
          // The empty space under the last block: clicking it carries on writing at the end,
          // with a fresh line when the page ends in a picture, table or other non-text block.
          <div
            aria-hidden="true"
            data-print="hide"
            className="min-h-[30vh] cursor-text"
            onMouseDown={(e) => {
              e.preventDefault();
              continueAtEnd(editor);
            }}
          />
        )}
      </div>
    </PageDarkContext.Provider>
  );
}

/** Put the cursor at the end of the page, adding an empty line if the page doesn't end in text. */
function continueAtEnd(editor: DovliEditor) {
  const blocks = editor.document;
  const last = blocks[blocks.length - 1] as any;
  const textual = last && Array.isArray(last.content) && ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote"].includes(last.type);
  editor.focus();
  if (textual) {
    editor.setTextCursorPosition(last, "end");
    return;
  }
  const [added] = last ? editor.insertBlocks([{ type: "paragraph" } as any], last, "after") : [];
  if (added) editor.setTextCursorPosition(added, "start");
}
