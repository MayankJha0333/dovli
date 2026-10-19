import { describe, expect, it } from "vitest";
import { blocksToMarkdown, markdownToBlocks, markdownToInline, inlineToMarkdown, flattenBlocks, tidyMermaid, flowchartToMermaid } from "./markdown";

let n = 0;
const ids = { newId: () => `b${++n}` };
const strip = (blocks: any[]): any[] => blocks.map(({ id, children, ...b }) => ({ ...b, ...(children?.length ? { children: strip(children) } : {}) }));

describe("Markdown → blocks", () => {
  it("reads headings, paragraphs, lists, to-dos, toggles and nesting", () => {
    const md = ["# Plan", "", "Intro **bold** and *soft* text.", "", "- one", "  - inner", "- two", "1. first", "2. second", "- [ ] buy milk", "- [x] done", "+ More", "  Hidden detail"].join("\n");
    const b = markdownToBlocks(md, ids);
    expect(b.map((x) => x.type)).toEqual(["heading", "paragraph", "bulletListItem", "bulletListItem", "numberedListItem", "numberedListItem", "checkListItem", "checkListItem", "toggleListItem"]);
    expect(b[0].props.level).toBe(1);
    expect(b[1].content).toEqual([
      { type: "text", text: "Intro ", styles: {} },
      { type: "text", text: "bold", styles: { bold: true } },
      { type: "text", text: " and ", styles: {} },
      { type: "text", text: "soft", styles: { italic: true } },
      { type: "text", text: " text.", styles: {} },
    ]);
    expect(b[2].children[0].type).toBe("bulletListItem");
    expect(b[6].props.checked).toBe(false);
    expect(b[7].props.checked).toBe(true);
    expect(b[8].children[0]).toMatchObject({ type: "paragraph" });
    for (const { block } of flattenBlocks(b)) expect(block.id).toMatch(/^b\d+$/);
  });

  it("reads code, quotes, dividers, tables, pictures, callouts and captions", () => {
    const md = ["```ts", "const a = 1;", "  indented()", "```", "> wise words", "> second line", "---", "| A | B |", "| --- | --- |", "| 1 | 2 \\| 3 |", "![A cat](https://x.test/cat.png)", '<callout tone="tip" emoji="💡">Try it</callout>', "> [!WARNING] Careful", "<small>fine print</small>"].join("\n");
    const b = markdownToBlocks(md, ids);
    expect(b.map((x) => x.type)).toEqual(["codeBlock", "quote", "divider", "table", "image", "callout", "callout", "caption"]);
    expect(b[0]).toMatchObject({ props: { language: "ts" }, content: "const a = 1;\n  indented()" });
    expect(b[1].content.map((c: any) => c.text).join("")).toBe("wise words\nsecond line");
    expect(b[3].content.rows[1].cells[1]).toEqual([{ type: "text", text: "2 | 3", styles: {} }]);
    expect(b[4].props).toMatchObject({ url: "https://x.test/cat.png", caption: "A cat" });
    expect(b[5].props).toEqual({ tone: "tip", emoji: "💡" });
    expect(b[6].props.tone).toBe("warning");
  });

  it("links: web links, links to pages by id, and [[Title]]", () => {
    const inl = markdownToInline("See [docs](https://a.test) and [Plan](dovli:page/abc123) or [[Trip]]", { findPage: (t) => (t === "Trip" ? { id: "trip1", title: "Trip" } : null) });
    expect(inl).toEqual([
      { type: "text", text: "See ", styles: {} },
      { type: "link", href: "https://a.test", content: [{ type: "text", text: "docs", styles: {} }] },
      { type: "text", text: " and ", styles: {} },
      { type: "pageLink", props: { pageId: "abc123", title: "Plan" } },
      { type: "text", text: " or ", styles: {} },
      { type: "pageLink", props: { pageId: "trip1", title: "Trip" } },
    ]);
  });

  it("leaves snake_case, lone stars and escaped marks as plain text", () => {
    expect(markdownToInline("my_var_name is 2 * 3 \\*not\\*")).toEqual([{ type: "text", text: "my_var_name is 2 * 3 *not*", styles: {} }]);
  });

  it("keeps blocks Markdown can't hold, when named by id", () => {
    const sketch = { id: "fc1", type: "flowchart", props: { scene: "{…}" }, children: [] };
    const b = markdownToBlocks('Before\n<block id="fc1" type="flowchart"/>\n<block id="gone"/>', { ...ids, existing: new Map([["fc1", sketch]]) });
    expect(b.map((x) => x.type)).toEqual(["paragraph", "flowchart"]);
    expect(b[1]).toEqual(sketch);
  });
});

describe("blocks → Markdown", () => {
  it("writes every kind of block, and reads back the same", () => {
    const md = [
      "# Plan",
      "",
      "Intro **bold**, *soft*, ~~old~~, `code`, <u>under</u>, ==mark== and [docs](https://a.test).",
      "",
      "- one",
      "  - inner",
      "- two",
      "1. first",
      "2. second",
      "- [ ] buy milk",
      "- [x] done",
      "+ More",
      "",
      "> wise words",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "",
      "---",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "![A cat](https://x.test/cat.png)",
      "",
      '<callout tone="tip" emoji="💡">Try it</callout>',
      "",
      "<small>fine print</small>",
      "",
      "Go to [Plan](dovli:page/abc123)",
    ].join("\n");
    const once = blocksToMarkdown(markdownToBlocks(md, ids));
    expect(once).toBe(md);
    expect(strip(markdownToBlocks(once, ids))).toEqual(strip(markdownToBlocks(md, ids)));
  });

  it("escapes text that would otherwise turn into formatting", () => {
    const blocks = [{ id: "x", type: "paragraph", content: [{ type: "text", text: "# not a heading, 2*3, [x]", styles: {} }] }];
    const md = blocksToMarkdown(blocks);
    expect(md).toBe("\\# not a heading, 2\\*3, \\[x\\]");
    expect(markdownToBlocks(md, ids)[0].content[0].text).toBe("# not a heading, 2*3, [x]");
  });

  it("names unknown blocks so they survive a round trip", () => {
    const md = blocksToMarkdown([{ id: "fc1", type: "flowchart", props: {} }, { id: "s1", type: "subpage", props: { pageId: "p9" } }]);
    expect(md).toBe('<block id="fc1" type="flowchart"/>\n\n<page id="p9"/>');
  });

  it("writes bold-italic and spaces outside marks", () => {
    expect(inlineToMarkdown([{ type: "text", text: " both ", styles: { bold: true, italic: true } }])).toBe(" ***both*** ");
  });
});

describe("the sample pages", async () => {
  const { seedPages } = await import("./seed");
  it("every sample page turns into Markdown and back without losing blocks", () => {
    const pages = Object.values(seedPages() as Record<string, any>).filter((p: any) => p.kind === "doc");
    expect(pages.length).toBeGreaterThan(3);
    for (const p of pages) {
      const md = blocksToMarkdown(p.blocks);
      expect(md.length).toBeGreaterThan(20);
      const back = markdownToBlocks(md, { existing: new Map(flattenBlocks(p.blocks).map(({ block }) => [block.id, block])) });
      // Same Markdown again after a round trip: nothing dropped or garbled.
      expect(blocksToMarkdown(back)).toBe(md);
    }
  });
});

describe("mermaid flowcharts", () => {
  it("turns a mermaid block into a flowchart, and leaves other code as code", () => {
    const b = markdownToBlocks("```mermaid\nflowchart TD\n  A[Phone] -->|Feed?| B[Server]\n```\n\n```js\nlet a = 1\n```");
    expect(b.map((x) => x.type)).toEqual(["flowchart", "codeBlock"]);
    expect(JSON.parse(b[0].props.scene)).toEqual({ mermaid: "flowchart TD\n  A[Phone] -->|Feed?| B[Server]" });
  });
});

describe("tidying AI-written Mermaid", () => {
  it("quotes labels with brackets or symbols, and leaves good ones alone", () => {
    const ai = 'flowchart TD\n    A[You type: swiggy.com] --> B[Browser checks its own memory (cache)]\n    B -->|found?| C[Done]\n    D{Cached?} -->|Yes (fast)| E((End))\n    F["Already quoted (ok)"] --> G[Plain]';
    expect(tidyMermaid(ai).split("\n")).toEqual([
      "flowchart TD",
      '    A["You type: swiggy.com"] --> B["Browser checks its own memory (cache)"]',
      "    B -->|found?| C[Done]",
      '    D{Cached?} -->|"Yes (fast)"| E((End))',
      '    F["Already quoted (ok)"] --> G[Plain]',
    ]);
  });
  it("leaves other diagrams alone", () => {
    expect(tidyMermaid("sequenceDiagram\n  A->>B: hi (there)")).toBe("sequenceDiagram\n  A->>B: hi (there)");
  });
});

describe("reading a drawn flowchart back as Mermaid", () => {
  it("lists the boxes and the arrows between them, with labels", () => {
    const scene = JSON.stringify({
      elements: [
        { id: "a", type: "rectangle", x: 0, y: 0 },
        { id: "ta", type: "text", containerId: "a", text: "Client (your\nphone)", originalText: "Client (your phone)" },
        { id: "b", type: "diamond", x: 0, y: 200 },
        { id: "tb", type: "text", containerId: "b", text: "Cached?" },
        { id: "arr", type: "arrow", startBinding: { elementId: "a" }, endBinding: { elementId: "b" } },
        { id: "tarr", type: "text", containerId: "arr", text: "asks" },
        { id: "gone", type: "rectangle", isDeleted: true },
      ],
    });
    expect(flowchartToMermaid(scene)).toBe('flowchart TD\n  n1["Client (your phone)"]\n  n2{"Cached?"}\n  n1 -->|"asks"| n2');
  });
  it("gives back Mermaid that isn't drawn yet, and nothing for an empty drawing", () => {
    expect(flowchartToMermaid('{"mermaid":"graph LR\\n A-->B"}')).toBe("graph LR\n A-->B");
    expect(flowchartToMermaid('{"elements":[]}')).toBeNull();
    expect(flowchartToMermaid("junk")).toBeNull();
  });
});
