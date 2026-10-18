import { describe, expect, it } from "vitest";
import type { Page } from "./types";
import { mergeBlocks, mergeBoard, mergePage } from "./merge";
import { extractTags, pagesWithTag, tagIndex, tagRanges } from "./tags";
import { backlinksOf, outgoingLinks, outline } from "./references";
import { searchPages } from "./search";
import { childrenOf, descendantIds, expiredTrash, recentPages, trashRoots, TRASH_DAYS } from "./pages";
import { pageWithBlockIds, withBlockIds } from "./blocks";
import { seedPages } from "./seed";

const p = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text, styles: {} }], children: [] });

const page = (over: Partial<Page> = {}): Page => ({
  id: "a",
  parentId: null,
  kind: "doc",
  title: "Notes",
  mark: "¶",
  blocks: [],
  createdAt: 1,
  updatedAt: 1,
  order: 0,
  ...over,
});

describe("mergeBlocks", () => {
  const base = [p("1", "one"), p("2", "two"), p("3", "three")];

  it("takes edits from both sides when they touch different blocks", () => {
    const local = [p("1", "ONE"), p("2", "two"), p("3", "three")];
    const remote = [p("1", "one"), p("2", "two"), p("3", "THREE")];
    expect(mergeBlocks(base, local, remote).map((b) => b.content[0].text)).toEqual(["ONE", "two", "THREE"]);
  });

  it("keeps both versions when the same block changed on both sides", () => {
    const local = [p("1", "mine"), p("2", "two"), p("3", "three")];
    const remote = [p("1", "theirs"), p("2", "two"), p("3", "three")];
    const out = mergeBlocks(base, local, remote).map((b) => b.content[0].text);
    expect(out).toEqual(["mine", "theirs", "two", "three"]);
  });

  it("adds new blocks from both sides in a sensible order", () => {
    const local = [p("1", "one"), p("L", "local new"), p("2", "two"), p("3", "three")];
    const remote = [p("1", "one"), p("2", "two"), p("R", "remote new"), p("3", "three")];
    expect(mergeBlocks(base, local, remote).map((b) => b.id)).toEqual(["1", "L", "2", "R", "3"]);
  });

  it("drops a block deleted on one side and untouched on the other", () => {
    const local = [p("1", "one"), p("3", "three")];
    const remote = [p("1", "one"), p("2", "two"), p("3", "three")];
    expect(mergeBlocks(base, local, remote).map((b) => b.id)).toEqual(["1", "3"]);
  });

  it("keeps a block deleted on one side but edited on the other", () => {
    const local = [p("1", "one"), p("3", "three")];
    const remote = [p("1", "one"), p("2", "two, edited"), p("3", "three")];
    expect(mergeBlocks(base, local, remote).map((b) => b.id)).toEqual(["1", "2", "3"]);
  });
});

describe("mergePage", () => {
  it("merges fields changed on different sides", () => {
    const base = page({ title: "Old", favorite: false });
    const local = page({ title: "New title", favorite: false, updatedAt: 5 });
    const remote = page({ title: "Old", favorite: true, updatedAt: 4 });
    const out = mergePage(base, local, remote);
    expect(out.title).toBe("New title");
    expect(out.favorite).toBe(true);
    expect(out.updatedAt).toBe(5);
  });

  it("uses the newer edit when the same field changed on both sides", () => {
    const base = page({ title: "Old" });
    expect(mergePage(base, page({ title: "A", updatedAt: 2 }), page({ title: "B", updatedAt: 3 })).title).toBe("B");
  });

  it("without a common version keeps the newest", () => {
    expect(mergePage(null, page({ title: "A", updatedAt: 9 }), page({ title: "B", updatedAt: 3 })).title).toBe("A");
  });
});

describe("mergeBoard", () => {
  it("keeps the newest version of each shape", () => {
    const base = { elements: [{ id: "x", version: 1 }, { id: "y", version: 1 }] };
    const local = { elements: [{ id: "x", version: 3 }, { id: "y", version: 1 }] };
    const remote = { elements: [{ id: "x", version: 2 }, { id: "z", version: 1 }] };
    const out = mergeBoard(base, local, remote).elements!.map((e: any) => `${e.id}${e.version}`).sort();
    expect(out).toEqual(["x3", "z1"]);
  });
});

describe("tags", () => {
  it("finds tags in text, including nested ones", () => {
    expect(extractTags("Plan #work and #Ideas/books, not a#b or # heading")).toEqual(["work", "ideas/books"]);
  });
  it("gives positions for highlighting", () => {
    expect(tagRanges("hi #one")).toEqual([{ start: 3, end: 7, tag: "one" }]);
  });
  it("indexes pages and finds child tags under a parent", () => {
    const pages = {
      a: page({ id: "a", blocks: [p("1", "#ideas/books to read")] }),
      b: page({ id: "b", blocks: [p("1", "#ideas")] }),
      c: page({ id: "c", blocks: [p("1", "#ideas")], deletedAt: 5 }),
    };
    expect(pagesWithTag(pages, "ideas").map((x) => x.id).sort()).toEqual(["a", "b"]);
    expect(tagIndex(pages).map((t) => t.tag)).toEqual(["ideas", "ideas/books"]);
  });
});

describe("references", () => {
  const linking = page({
    id: "a",
    blocks: [
      { id: "1", type: "paragraph", content: [{ type: "text", text: "See " }, { type: "pageLink", props: { pageId: "b" } }], children: [] },
      { id: "2", type: "subpage", props: { pageId: "c" }, content: undefined, children: [] },
      { id: "3", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Next" }], children: [] },
    ],
  });
  it("lists outgoing links and backlinks", () => {
    expect(outgoingLinks(linking)).toEqual(["b", "c"]);
    const pages = { a: linking, b: page({ id: "b" }), c: page({ id: "c" }) };
    expect(backlinksOf(pages, "b").map((x) => x.id)).toEqual(["a"]);
  });
  it("builds an outline from headings", () => {
    expect(outline(linking)).toEqual([{ id: "3", level: 2, text: "Next" }]);
  });
});

describe("search", () => {
  it("ranks title matches first and returns a snippet", () => {
    const pages = {
      a: page({ id: "a", title: "Garden plan", updatedAt: Date.now() }),
      b: page({ id: "b", title: "Other", blocks: [p("1", "notes about the garden shed")], updatedAt: Date.now() }),
    };
    const hits = searchPages(pages, "garden");
    expect(hits.map((h) => h.page.id)).toEqual(["a", "b"]);
    expect(hits[1].snippet?.text.slice(hits[1].snippet.start, hits[1].snippet.end)).toBe("garden");
  });
  it("needs every word to match", () => {
    const pages = { a: page({ id: "a", title: "Garden plan" }) };
    expect(searchPages(pages, "garden rocket")).toEqual([]);
  });
});

describe("trash", () => {
  const now = Date.now();
  const pages = {
    a: page({ id: "a", deletedAt: now - (TRASH_DAYS + 1) * 864e5 }),
    b: page({ id: "b", parentId: "a", deletedAt: now - (TRASH_DAYS + 1) * 864e5 }),
    c: page({ id: "c", deletedAt: now - 1000 }),
    d: page({ id: "d" }),
  };
  it("finds expired pages and the top of each trashed tree", () => {
    expect(expiredTrash(pages, now).sort()).toEqual(["a", "b"]);
    expect(trashRoots(pages).map((x) => x.id)).toEqual(["c", "a"]);
  });
  it("hides trashed children but still counts them as descendants", () => {
    expect(childrenOf(pages, "a")).toEqual([]);
    expect(descendantIds(pages, "a")).toEqual(["b"]);
    expect(recentPages(pages).map((x) => x.id)).toEqual(["d"]);
  });
});

describe("block ids", () => {
  it("fills in missing ids the same way every time, keeping existing ones", () => {
    const blocks = [{ type: "heading" }, { id: "keep", type: "p", children: [{ type: "li" }] }] as any[];
    const a = withBlockIds(blocks, "pg")!;
    expect(a.map((b: any) => b.id)).toEqual(["pg-0", "keep"]);
    expect(a[1].children[0].id).toBe("pg-1.0");
    expect(withBlockIds(blocks, "pg")).toEqual(a);
    expect(withBlockIds(a, "pg")).toBe(a);
  });

  it("gives every sample page heading an id, so the outline has keys", () => {
    for (const page of Object.values(seedPages())) {
      expect(pageWithBlockIds(page)).toBe(page);
      for (const h of outline(page)) expect(h.id).toBeTruthy();
    }
  });
});
