// Plugs the web store into the shared editor package, so @dovli/editor never imports app code.
import { connectEditor } from "@dovli/editor";
import { setUnfurlEndpoint } from "@dovli/core";
import { toast } from "@dovli/ui";
import { store, useStore } from "./store";
import { resolveFileUrl, saveFile } from "./files";
import { ui } from "./ui";

connectEditor({
  usePages: (select) => useStore((s) => select(s.pages)),
  getPages: () => store.get().pages,
  openPage: (id) => store.navigate({ name: "page", id }),
  createPage: (input) => store.createPage(input),
  saveBlocks: (pageId, blocks) => store.updatePage(pageId, { blocks }),
  uploadFile: async (file) => {
    try {
      return await saveFile(file);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add that file.", { tone: "danger" });
      throw err;
    }
  },
  resolveFileUrl,
  pickPage: ({ title, exclude }) => ui.pickPage(title, exclude),
  appendBlocks: (pageId, blocks) => {
    const target = store.get().pages[pageId];
    if (target?.kind === "doc") store.updatePage(pageId, { blocks: [...(target.blocks ?? []), ...blocks] });
  },
  openAI: (selection) => ui.set({ ai: { ...selection, mode: "edit" } }),
  openTag: (tag) => store.navigate({ name: "tag", tag }),
  notify: (message) => toast(message),
});

// Optional: your own link-preview server (see .env.example).
setUnfurlEndpoint(process.env.NEXT_PUBLIC_UNFURL_ENDPOINT);
