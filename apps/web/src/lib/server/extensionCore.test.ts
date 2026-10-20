import { describe, expect, it } from "vitest";
import { markdownToBlocks } from "@dovli/core";
import { clipMarkdown, pageView, remarkCallout, sourceCaption, tagLine } from "./extensionCore";

const at = { pageUrl: "https://blog.example.com/bread", pageTitle: "How to bake [bread]" };

describe("clipMarkdown", () => {
  it("quotes a plain selection, with where it came from", () => {
    const md = clipMarkdown({ kind: "selection", ...at, html: "Bread needs <b>time</b>." })!;
    expect(md).toBe("> Bread needs **time**.\n\n<small>From [How to bake \\[bread\\]](https://blog.example.com/bread)</small>");
    expect(markdownToBlocks(md).map((b) => b.type)).toEqual(["quote", "caption"]);
  });
  it("keeps the structure of a bigger selection", () => {
    const md = clipMarkdown({ kind: "selection", ...at, html: "<h2>Steps</h2><ol><li>Mix</li><li>Bake</li></ol>" })!;
    expect(markdownToBlocks(md).map((b) => b.type)).toEqual(["heading", "numberedListItem", "numberedListItem", "caption"]);
  });
  it("falls back to the plain text, escaped", () => {
    const md = clipMarkdown({ kind: "selection", ...at, text: "# not a heading\n\n*not italic*" })!;
    expect(markdownToBlocks(md).map((b) => b.type)).toEqual(["paragraph", "paragraph", "caption"]);
    expect(md).toContain("\\*not italic\\*");
  });
  it("saves web pictures and links, and refuses anything else", () => {
    expect(clipMarkdown({ kind: "image", ...at, src: "https://cdn.example.com/a (1).jpg", alt: "A [loaf]" })).toBe(
      "![A  loaf](https://cdn.example.com/a%20%281%29.jpg)\n\n<small>From [How to bake \\[bread\\]](https://blog.example.com/bread)</small>".replace("A  loaf", "A loaf"),
    );
    expect(clipMarkdown({ kind: "image", ...at, src: "data:image/png;base64,AAAA" })).toBeNull();
    expect(clipMarkdown({ kind: "link", ...at, href: "https://example.com/x", linkText: "Read *more*" })).toBe("[Read \\*more\\*](https://example.com/x)");
    expect(clipMarkdown({ kind: "link", ...at, href: "javascript:alert(1)" })).toBeNull();
    expect(clipMarkdown({ kind: "selection", ...at, text: "   " })).toBeNull();
  });
  it("leaves out the source line for pages that aren't on the web", () => {
    expect(sourceCaption("chrome://settings", "Settings")).toBe("");
    expect(clipMarkdown({ kind: "selection", pageUrl: "file:///x.html", pageTitle: "", text: "Hi" })).toBe("> Hi");
  });
});

describe("bookmarks, tags and remarks", () => {
  it("saves a bookmark as a link card with the page's summary", () => {
    const md = clipMarkdown({ kind: "bookmark", ...at, href: 'https://blog.example.com/bread?q="x"', description: "  How to *bake*\n bread.  " })!;
    expect(md).toBe('<embed url="https://blog.example.com/bread?q=%22x%22"/>\n\nHow to \\*bake\\* bread.');
    expect(markdownToBlocks(md).map((b) => b.type)).toEqual(["embed", "paragraph"]);
    expect(clipMarkdown({ kind: "bookmark", ...at, href: "javascript:alert(1)" })).toBeNull();
  });
  it("writes typed tags the way Dovli reads them, and drops ones it can't", () => {
    expect(tagLine(["Recipe", "#to read", "2024", "", 7, "ideas/books"])).toBe("#recipe #to-read #ideas/books");
    expect(tagLine("recipe")).toBe("");
  });
  it("keeps a remark as plain text in a note", () => {
    const md = remarkCallout(" Try this *Sunday*</callout>\nwith jam ");
    expect(markdownToBlocks(md)).toMatchObject([{ type: "callout", props: { tone: "note", emoji: "💬" } }]);
    expect(md).toContain("\\*Sunday\\*\\</callout><br>with jam");
    expect(remarkCallout("   ")).toBe("");
  });
});

describe("pageView", () => {
  it("gives the panel each block with its text, a few props and its Markdown, plus the page style", () => {
    const blocks = markdownToBlocks("# Trip\n\n- [ ] Book **flights**\n  - nested\n\n<callout tone=\"tip\" emoji=\"💡\">Pack light</callout>");
    const v = pageView({ id: "p1", parentId: null, kind: "doc", title: "Japan", mark: "🗾", style: "cafe", blocks, createdAt: 1, updatedAt: 1, order: 0 } as any);
    expect(v).toMatchObject({ id: "p1", title: "Japan", icon: "🗾", style: { id: "cafe", name: "Café", title: expect.any(String) }, more: 0 });
    expect(v.style!.backdrop).toContain("gradient");
    expect(v.blocks.map((b) => [b.type, b.depth])).toEqual([
      ["heading", 0],
      ["checkListItem", 0],
      ["bulletListItem", 1],
      ["callout", 0],
    ]);
    expect(v.blocks[1]).toMatchObject({ props: { checked: false }, markdown: "- [ ] Book **flights**" });
    expect(v.blocks[1].props).not.toHaveProperty("textColor");
    expect(v.blocks[3].props).toMatchObject({ tone: "tip", emoji: "💡" });
  });
});
