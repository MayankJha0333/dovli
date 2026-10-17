// Plugs the web store into the shared editor package, so @dovli/editor never imports app code.
import { connectEditor } from "@dovli/editor";
import { setUnfurlEndpoint } from "@dovli/core";
import { store, useStore } from "@/lib/store";

connectEditor({
  usePages: (select) => useStore((s) => select(s.pages)),
  openPage: (id) => store.navigate({ name: "page", id }),
  createPage: (input) => store.createPage(input),
  saveBlocks: (pageId, blocks) => store.updatePage(pageId, { blocks }),
});

// Optional: your own link-preview server (see .env.example).
setUnfurlEndpoint(process.env.NEXT_PUBLIC_UNFURL_ENDPOINT);
