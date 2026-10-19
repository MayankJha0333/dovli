import { describe, expect, it } from "vitest";
import { blocksToMarkdown, markdownToBlocks } from "@dovli/core";
import { applyChanges, changeTargets, cleanMarkdown, describeChange, flowchartSummary, pageListing, parseReply, plainPreview, replyStream } from "./assistantCore";

let n = 0;
const page = () => {
  n = 0;
  return markdownToBlocks("# Launch plan\n\nShip on Friday.\n\n- [ ] Write the email\n  - draft first\n- [x] Record demo\n\nNotes go here.", { newId: () => `id${++n}` });
};

describe("reading a page", () => {
  it("numbers every block, nested ones indented", () => {
    const l = pageListing(page());
    expect(l.text.split("\n")[0]).toBe("[b1] # Launch plan");
    expect(l.text).toContain("[b4]   - draft first");
    expect(l.ids).toEqual(["id1", "id2", "id3", "id4", "id5", "id6"]);
    expect(l.truncated).toBe(false);
  });
  it("shows a blank page as empty, but still knows its block", () => {
    const l = pageListing([{ id: "only", type: "paragraph", content: [], children: [] }]);
    expect(l.text).toBe("");
    expect(l.ids).toEqual(["only"]);
  });
  it("stops early on a very long page, and says so", () => {
    const l = pageListing(page(), 40);
    expect(l.truncated).toBe(true);
    expect(l.ids.length).toBeLessThan(6);
  });
});

describe("reading the AI's answer", () => {
  it("reads clean JSON", () => {
    const r = parseReply('{"reply":"Added a summary.","changes":[{"op":"insert","position":"start","markdown":"> Summary"}]}');
    expect(r.reply).toBe("Added a summary.");
    expect(r.changes).toEqual([{ op: "insert", position: "start", block_id: undefined, markdown: "> Summary" }]);
  });
  it("finds JSON inside a code fence or chatter", () => {
    expect(parseReply('```json\n{"reply":"Hi","changes":[]}\n```').reply).toBe("Hi");
    expect(parseReply('Sure! {"reply":"Done","changes":[]} hope that helps').reply).toBe("Done");
  });
  it("reads an answer wrapped in a list, with stray changes beside it", () => {
    const r = parseReply('[{"reply":"Renamed.","changes":[{"op":"delete","block_ids":["b2"]}]},{"op":"set_title","title":"Plan"}]');
    expect(r.reply).toBe("Renamed.");
    expect(r.changes).toEqual([{ op: "delete", block_ids: ["b2"] }, { op: "set_title", title: "Plan" }]);
  });
  it("never shows broken JSON, only its reply", () => {
    expect(parseReply('{"reply":"Fixed the \\"dates\\".","changes":[{"op":"upd').reply).toBe('Fixed the "dates".');
    expect(parseReply('{"changes":[{"op":').reply).toMatch(/garbled/);
  });
  it("shows plain text as the reply and changes nothing", () => {
    expect(parseReply("The page is about a launch.")).toEqual({ reply: "The page is about a launch.", changes: [] });
  });
  it("strips page wrappers and block numbers the AI copied into its writing", () => {
    expect(cleanMarkdown('<page title="Plan">\n[b1] # Plan\n[b2]   - nested\n</page>')).toBe("# Plan\n  - nested");
    expect(cleanMarkdown('<page id="p1" title="Kept"/>\nText')).toBe('<page id="p1" title="Kept"/>\nText');
    const r = parseReply('{"reply":"x","changes":[{"op":"replace_page","markdown":"<page title=\\"A\\">\\n[b1] # Hi\\n</page>"}]}');
    expect(r.changes).toEqual([{ op: "replace_page", markdown: "# Hi" }]);
  });
  it("drops changes that make no sense", () => {
    const r = parseReply('{"reply":"x","changes":[{"op":"explode"},{"op":"delete","block_ids":[]},{"op":"update","markdown":"no id"},{"op":"set_title","title":"  New  "}]}');
    expect(r.changes).toEqual([{ op: "set_title", title: "New" }]);
  });
});

describe("changing a page", () => {
  const ids = () => pageListing(page());

  it("inserts after a block named by its number", () => {
    const blocks = page();
    const out = applyChanges(blocks, [{ op: "insert", position: "after", block_id: "b2", markdown: "Second line." }], ids());
    expect(blocksToMarkdown(out.blocks)).toContain("Ship on Friday.\n\nSecond line.");
    expect(out.done).toEqual(["Added 1 block"]);
    expect(blocks).toHaveLength(5); // the original is untouched
  });

  it("rewrites a block, keeping its id and what's nested inside", () => {
    const out = applyChanges(page(), [{ op: "update", block_id: "b3", markdown: "- [ ] Write the launch email" }], ids());
    const todo = out.blocks.find((b: any) => b.id === "id3");
    expect(todo.content[0].text).toBe("Write the launch email");
    expect(todo.children).toHaveLength(1);
    expect(out.focus).toBe("id3");
  });

  it("removes and moves blocks", () => {
    const out = applyChanges(
      page(),
      [
        { op: "delete", block_ids: ["b6"] },
        { op: "move", block_ids: ["b5"], position: "before", block_id: "b3" },
      ],
      ids(),
    );
    const md = blocksToMarkdown(out.blocks);
    expect(md).not.toContain("Notes go here");
    expect(md.indexOf("Record demo")).toBeLessThan(md.indexOf("Write the email"));
    expect(out.done).toEqual(["Removed 1 block", "Moved 1 block"]);
  });

  it("restructures the whole page but never loses sub-pages or sketches", () => {
    const blocks = [...page(), { id: "sub1", type: "subpage", props: { pageId: "p9" } }, { id: "fc1", type: "flowchart", props: {} }];
    const l = pageListing(blocks);
    const out = applyChanges(blocks, [{ op: "replace_page", markdown: '## Plan\n\nShip on Friday.\n\n<block id="fc1" type="flowchart"/>' }], l);
    const types = out.blocks.map((b: any) => b.type);
    expect(types).toContain("flowchart");
    expect(types[types.length - 1]).toBe("subpage"); // left out by the AI, kept at the end
    expect(out.done[1]).toMatch(/Kept 1 block/);
  });

  it("refuses to rewrite a page it couldn't read in full", () => {
    const out = applyChanges(page(), [{ op: "replace_page", markdown: "Gone" }], { ids: ["id1"], truncated: true });
    expect(out.blocks).toHaveLength(5);
    expect(out.skipped[0]).toMatch(/too long/);
  });

  it("reports blocks it couldn't find instead of failing", () => {
    const out = applyChanges(page(), [{ op: "update", block_id: "b99", markdown: "x" }], ids());
    expect(out.skipped[0]).toMatch(/Couldn't find/);
    expect(out.done).toEqual([]);
  });

  it("passes on new pages and a new title for the app to make", () => {
    const out = applyChanges(
      page(),
      [
        { op: "set_title", title: "Beta launch" },
        { op: "create_page", title: "Press kit", markdown: "## Logos", icon: "📦" },
      ],
      ids(),
    );
    expect(out.title).toBe("Beta launch");
    expect(out.pages[0]).toMatchObject({ title: "Press kit", icon: "📦" });
    expect(out.pages[0].blocks[0].type).toBe("heading");
  });
});

describe("describing changes for review", () => {
  it("gives a short label, a plain preview and a kind for the icon", () => {
    expect(describeChange({ op: "insert", position: "end", markdown: "## Hello\n\n- **one**\n- two" })).toEqual({ label: "Add at the end", preview: "Hello · one · two", kind: "add" });
    expect(describeChange({ op: "delete", block_ids: ["b1", "b2"] })).toMatchObject({ label: "Remove 2 blocks", kind: "remove" });
  });
  it("calls a Mermaid block a flowchart, and lists its boxes", () => {
    const md = "```mermaid\nflowchart TD\n  A[Client (your phone)] -->|Give me my feed| B[Server]\n  B -->|Here are 20 posts| A\n  B --> C{Cached?}\n```";
    expect(describeChange({ op: "insert", position: "after", block_id: "b2", markdown: md })).toEqual({
      label: "Add a flowchart after a block",
      preview: "Flowchart: Client (your phone) → Server → Cached?",
      kind: "flowchart",
    });
    expect(flowchartSummary("graph LR\n  x((Start)) --> y([Stop])")).toBe("Start → Stop");
  });
  it("turns tables and markup into plain words", () => {
    expect(plainPreview("| Phase | Start |\n| --- | --- |\n| Plan | Mon |")).toBe("Phase · Start · Plan · Mon");
    expect(plainPreview("x".repeat(300)).length).toBeLessThan(170);
  });
  it("finds the blocks a change points at", () => {
    expect(changeTargets({ op: "delete", block_ids: ["b2", "b9"] }, ["x1", "x2"])).toEqual(["x2"]);
    expect(changeTargets({ op: "set_title", title: "t" }, ["x1"])).toEqual([]);
  });
});

describe("streaming the reply", () => {
  it("shows the reply word by word, before the JSON is complete", () => {
    const s = replyStream();
    expect(s.push('{"rep').reply).toBe("");
    expect(s.push('ly": "Adding a ').reply).toBe("Adding a ");
    expect(s.push('flow\\').reply).toBe("Adding a flow");
    expect(s.push('nchart \\"now\\"", "changes": [{"op": "insert"').reply).toBe('Adding a flow\nchart "now"');
    expect(s.push(', "markdown": "x"}, {"op": "delete"').changes).toBe(2);
  });
  it("streams a plain-text answer as it is", () => {
    const s = replyStream();
    s.push("The page is ");
    expect(s.push("about a launch.").reply).toBe("The page is about a launch.");
  });
});
