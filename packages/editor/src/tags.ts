// #tags drawn by the editor itself (ProseMirror decorations): each tag gets a styled span with
// data-tag="…". This works the same in every browser and in the phone app's web view, and it
// updates with every edit without watching the page.

import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { tagRanges } from "@dovli/core";

const key = new PluginKey<DecorationSet>("dovliTags");

/** Text inside code or links isn't a tag. Atoms (page links) break a tag, like a space would. */
function tagDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    const starts: number[] = []; // document position of each character in `text`
    node.forEach((child, offset) => {
      const at = pos + 1 + offset;
      if (child.isText) {
        const skip = child.marks.some((m) => m.type.name === "code" || m.type.name === "link");
        const value = skip ? " ".repeat(child.text!.length) : child.text!;
        for (let i = 0; i < value.length; i++) starts.push(at + i);
        text += value;
      } else {
        starts.push(at);
        text += " ";
      }
    });
    if (!text.includes("#")) return false;
    for (const t of tagRanges(text)) {
      decos.push(Decoration.inline(starts[t.start], starts[t.end - 1] + 1, { class: "dovli-tag", "data-tag": t.tag }));
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

export const tagsExtension = createExtension({
  key: "dovliTags",
  prosemirrorPlugins: [
    new Plugin<DecorationSet>({
      key,
      state: {
        init: (_, state) => tagDecorations(state.doc),
        apply: (tr, old) => (tr.docChanged ? tagDecorations(tr.doc) : old),
      },
      props: { decorations: (state) => key.getState(state) },
    }),
  ],
});

/** The tag under a click, if any. */
export function tagFromEvent(e: { target: EventTarget | null }): string | null {
  const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tag]") : null;
  return el?.dataset.tag ?? null;
}
