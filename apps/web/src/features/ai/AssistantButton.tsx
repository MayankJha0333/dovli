// The floating "Assistant" button at the bottom right of the page area, like Craft's.
// It gathers the AI actions for the page on screen: summarise, the four reviews, and rewriting
// the selected text.

import type { DovliEditor } from "@dovli/editor";
import { Icon, MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger, toast } from "@dovli/ui";
import { useStore } from "@/lib/store";
import { getActiveEditor, ui, useUI } from "@/lib/ui";
import { reviewPage, summarizePage, type ReviewFocus } from "./AIPanel";

const REVIEWS: { id: ReviewFocus; label: string }[] = [
  { id: "grammar", label: "Check spelling and grammar" },
  { id: "clarity", label: "Make it clearer" },
  { id: "structure", label: "Feedback on structure" },
  { id: "tone", label: "Check the tone" },
];

/** Open the AI panel on the selected text, the same as "Ask AI" over a selection. */
function rewriteSelection(editor: DovliEditor | null) {
  const text = editor?.getSelectedText().trim();
  if (!editor || !text) return toast("Select some text in the page first, then ask again.");
  const view = editor.prosemirrorView;
  const { from, to } = view.state.selection;
  ui.set({
    ai: {
      mode: "edit",
      text,
      replace: (t) => view.dispatch(view.state.tr.insertText(t, from, to)),
      insertAfter: (t) => {
        const blocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
        const last = blocks[blocks.length - 1];
        editor.insertBlocks(t.split(/\n{2,}/).map((x) => ({ type: "paragraph" as const, content: x.trim() })) as any, last.id, "after");
      },
    },
  });
}

export function AssistantButton() {
  const page = useStore((s) => (s.route.name === "page" ? s.pages[s.route.id] : undefined));
  const busy = useUI((s) => !!s.ai || !!s.presenting);
  if (!page || page.kind !== "doc" || page.deletedAt || busy) return null;

  return (
    <div data-print="hide" className="pointer-events-none absolute bottom-4 right-4 z-30 max-[860px]:bottom-[calc(16px+env(safe-area-inset-bottom))]">
      <MenuRoot modal={false}>
        <MenuTrigger asChild>
          <button
            type="button"
            className="pointer-events-auto flex h-10 items-center gap-2 rounded-full px-4 text-base font-semibold text-ink shadow-pop surface-raised transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-[640px]:size-11 max-[640px]:justify-center max-[640px]:px-0"
          >
            <Icon name="sparkles" size={16} className="text-accent" />
            <span className="max-[640px]:sr-only">Assistant</span>
          </button>
        </MenuTrigger>
        <MenuContent side="top" align="end" sideOffset={10} className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenuLabel>This page</MenuLabel>
          <MenuItem icon="summary" onSelect={() => summarizePage(page)}>
            Summarise this page
          </MenuItem>
          {REVIEWS.map((r) => (
            <MenuItem key={r.id} icon={r.id === "grammar" ? "check" : r.id === "tone" ? "user" : r.id === "structure" ? "outline" : "wand"} onSelect={() => reviewPage(page, r.id)}>
              {r.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuLabel>Selected text</MenuLabel>
          <MenuItem icon="pencil" onSelect={() => rewriteSelection(getActiveEditor())}>
            Rewrite, shorten or translate…
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </div>
  );
}
