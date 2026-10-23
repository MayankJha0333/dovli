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

describe("mergeBlocks: moves", () => {
  const base = [p("1", "one"), p("2", "two"), p("3", "three")];
  const nest = (id: string, text: string, kids: any[]) => ({ ...p(id, text), children: kids });
  const show = (bs: any[], d = 0): string[] => bs.flatMap((b) => [`${"  ".repeat(d)}${b.id}:${b.content?.[0]?.text ?? ""}`, ...show(b.children ?? [], d + 1)]);
  const both = (local: any[], remote: any[]) => [show(mergeBlocks(base, local, remote)), show(mergeBlocks(base, remote, local))];

  it("a block moved inside another on one side and edited on the other: one block, edited, in its new place", () => {
    const moved = [nest("1", "one", [p("3", "three")]), p("2", "two")];
    const edited = [p("1", "one"), p("2", "two"), p("3", "THREE")];
    for (const out of both(moved, edited)) expect(out).toEqual(["1:one", "  3:THREE", "2:two"]);
  });

  it("a block moved up on one side and edited on the other", () => {
    const moved = [p("3", "three"), p("1", "one"), p("2", "two")];
    const edited = [p("1", "one"), p("2", "two"), p("3", "THREE")];
    for (const out of both(moved, edited)) expect(out).toEqual(["3:THREE", "1:one", "2:two"]);
  });

  it("a block taken out of another on one side and edited on the other", () => {
    const start = [nest("1", "one", [p("2", "two"), p("3", "three")])];
    const out = mergeBlocks(start, [p("1", "one"), p("3", "three"), p("2", "two")].map((b, i) => (i === 0 ? { ...b, children: [] } : b)), [nest("1", "one", [p("2", "two"), p("3", "THREE")])]);
    expect(show(out)).toEqual(["1:one", "3:THREE", "2:two"]);
  });

  it("different blocks moved on each side: both moves stay", () => {
    const local = [p("2", "two"), p("3", "three"), p("1", "one")]; // 1 to the end
    const remote = [p("2", "two"), p("1", "one"), p("3", "three")]; // 2 to the top
    expect(show(mergeBlocks([p("1", "one"), p("2", "two"), p("3", "three")], local, remote))).toEqual(["2:two", "3:three", "1:one"]);
    const local2 = [p("1", "one"), p("2", "two"), p("4", "four"), p("3", "three")];
    const remote2 = [p("2", "two"), p("1", "one"), p("3", "three"), p("4", "four")];
    const base4 = [p("1", "one"), p("2", "two"), p("3", "three"), p("4", "four")];
    // Swapping neighbours can be read as either one moving; both moves hold whichever it was.
    const ids = mergeBlocks(base4, local2, remote2).map((b) => b.id);
    expect(ids.sort()).toEqual(["1", "2", "3", "4"]);
    const got = mergeBlocks(base4, local2, remote2).map((b) => b.id);
    expect(got.indexOf("2")).toBeLessThan(got.indexOf("1"));
    expect(got.indexOf("4")).toBeLessThan(got.indexOf("3"));
  });

  it("the same block moved to two places goes where this device put it, once", () => {
    const local = [nest("1", "one", [p("3", "three")]), p("2", "two")];
    const remote = [p("1", "one"), nest("2", "two", [p("3", "three")])];
    expect(show(mergeBlocks(base, local, remote))).toEqual(["1:one", "  3:three", "2:two"]);
    expect(show(mergeBlocks(base, remote, local))).toEqual(["1:one", "2:two", "  3:three"]);
  });

  it("a block moved and edited on one side while a new block is added next to it on the other", () => {
    const local = [p("3", "THREE"), p("1", "one"), p("2", "two")];
    const remote = [p("1", "one"), p("N", "new"), p("2", "two"), p("3", "three")];
    expect(show(mergeBlocks(base, local, remote))).toEqual(["3:THREE", "1:one", "N:new", "2:two"]);
  });

  it("moving A into B here while B went into A there: no loop, nothing lost", () => {
    const local = [nest("2", "two", [p("1", "one")]), p("3", "three")];
    const remote = [nest("1", "one", [p("2", "two")]), p("3", "three")];
    const out = show(mergeBlocks(base, local, remote));
    expect(out).toEqual(["2:two", "  1:one", "3:three"]);
  });

  it("a block edited inside a block deleted on the other side keeps both", () => {
    const start = [nest("1", "one", [p("2", "two")]), p("3", "three")];
    const local = [nest("1", "one", [p("2", "TWO")]), p("3", "three")];
    const remote = [p("3", "three")];
    expect(show(mergeBlocks(start, local, remote))).toEqual(["1:one", "  2:TWO", "3:three"]);
    expect(show(mergeBlocks(start, remote, local))).toEqual(["1:one", "  2:TWO", "3:three"]);
  });

  it("a moved block that the other side deleted is gone", () => {
    const local = [p("3", "three"), p("1", "one"), p("2", "two")];
    const remote = [p("1", "one"), p("2", "two")];
    expect(show(mergeBlocks(base, local, remote))).toEqual(["1:one", "2:two"]);
  });

  it("a to-do ticked on one side and reworded on the other: one block with both, no copy", () => {
    const todo = (text: string, checked: boolean) => ({ id: "t", type: "checkListItem", props: { checked, textColor: "default" }, content: [{ type: "text", text, styles: {} }], children: [] });
    const out = mergeBlocks([todo("buy milk", false)], [todo("buy milk", true)], [todo("buy oat milk", false)]);
    expect(out).toEqual([todo("buy oat milk", true)]);
  });

  it("the same words changed on both sides keep both, after a move too", () => {
    const local = [p("3", "mine"), p("1", "one"), p("2", "two")];
    const remote = [p("1", "one"), p("2", "two"), p("3", "theirs")];
    expect(show(mergeBlocks(base, local, remote))).toEqual(["3:mine", "3-c:theirs", "1:one", "2:two"]);
  });

  it("merging the same conflict again (a sync cut short) doesn't add the copy twice", () => {
    const local = [p("1", "mine"), p("2", "two"), p("3", "three")];
    const remote = [p("1", "theirs"), p("2", "two"), p("3", "three")];
    const once = mergeBlocks(base, local, remote);
    expect(show(once)).toEqual(["1:mine", "1-c:theirs", "2:two", "3:three"]);
    const twice = mergeBlocks(base, once, remote);
    expect(show(twice)).toEqual(show(once));
    expect(show(mergeBlocks(base, twice, remote))).toEqual(show(once));
  });

  it("a second conflict on a block doesn't overwrite the first one's copy", () => {
    const start = [p("1", "one"), p("1-c", "older copy")];
    const out = mergeBlocks(start, [p("1", "mine"), p("1-c", "older copy")], [p("1", "theirs"), p("1-c", "older copy")]);
    expect(show(out)).toEqual(["1:mine", "1-c2:theirs", "1-c:older copy"]);
  });

  it("repairs a page that already has the same block id twice", () => {
    const broken = [p("1", "one"), nest("2", "two", [p("3", "three")]), p("3", "THREE")];
    const out = mergeBlocks(broken, broken, [...broken, p("4", "four")]);
    const ids = show(out).map((l) => l.trim().split(":")[0]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(show(out)).toEqual(["1:one", "2:two", "  3:three", "3-2:THREE", "4:four"]);
  });

  it("a toggle edited on one side and deleted on the other comes back with what was inside it", () => {
    const start = [nest("1", "toggle", [p("2", "two"), nest("3", "three", [p("4", "four")])]), p("5", "five")];
    const renamed = [nest("1", "TOGGLE", [p("2", "two"), nest("3", "three", [p("4", "four")])]), p("5", "five")];
    const deleted = [p("5", "five")];
    const want = ["1:TOGGLE", "  2:two", "  3:three", "    4:four", "5:five"];
    expect(show(mergeBlocks(start, renamed, deleted))).toEqual(want);
    expect(show(mergeBlocks(start, deleted, renamed))).toEqual(want);
    // An edit inside it brings back the rest of it too, but not what the deleting side moved out.
    const innerEdit = [nest("1", "toggle", [p("2", "TWO"), nest("3", "three", [p("4", "four")])]), p("5", "five")];
    const movedOut = [p("4", "four"), p("5", "five")];
    expect(show(mergeBlocks(start, innerEdit, movedOut))).toEqual(["4:four", "1:toggle", "  2:TWO", "  3:three", "5:five"]);
  });

  it("a block added next to one the other side moved stays next to it", () => {
    const local = [p("2", "two"), p("3", "three"), p("1", "one")];
    const remote = [p("1", "one"), p("N", "new"), p("2", "two"), p("3", "three")];
    expect(show(mergeBlocks(base, local, remote))).toEqual(["2:two", "3:three", "1:one", "N:new"]);
    expect(show(mergeBlocks(base, remote, local))).toEqual(["2:two", "3:three", "1:one", "N:new"]);
  });

  it("the same content written with its keys in another order is not a conflict", () => {
    const a = { id: "x", type: "paragraph", props: { textColor: "default", level: 1 }, content: [{ type: "text", text: "hi", styles: {} }], children: [] };
    const b = { children: [], content: [{ styles: {}, text: "hi", type: "text" }], props: { level: 1, textColor: "default" }, type: "paragraph", id: "x" };
    expect(mergeBlocks([a], [b], [{ ...a, props: { ...a.props, textColor: "red" } }]).map((x) => x.props.textColor)).toEqual(["red"]);
    expect(mergeBlocks([a], [b], [a])).toHaveLength(1);
  });

  it("keeps blocks without children as they were", () => {
    const flat = [{ id: "d", type: "divider" }];
    expect(mergeBlocks(flat, flat, [...flat, { id: "e", type: "divider" }])).toEqual([{ id: "d", type: "divider" }, { id: "e", type: "divider" }]);
  });
});

describe("mergeBlocks: random edits on two devices", () => {
  // Seeded, so a failing seed can be replayed.
  const rng = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  type B = { id: string; type: string; props: { checked: boolean }; content: { type: "text"; text: string; styles: {} }[]; children: B[] };
  const blk = (id: string, text: string, checked = false): B => ({ id, type: "checkListItem", props: { checked }, content: [{ type: "text", text, styles: {} }], children: [] });
  const all = (bs: B[]): B[] => bs.flatMap((b) => [b, ...all(b.children)]);
  const listOf = (root: B[], id: string): B[] => (all(root).find((b) => b.children.some((c) => c.id === id))?.children ?? root);
  const insideOf = (b: B, id: string) => all(b.children).some((x) => x.id === id);

  function randomTree(r: () => number, n: number): B[] {
    const root: B[] = [];
    for (let i = 0; i < n; i++) {
      const lists = [root, ...all(root).map((b) => b.children)];
      const into = lists[Math.floor(r() * lists.length)];
      into.splice(Math.floor(r() * (into.length + 1)), 0, blk(`b${i}`, `text ${i}`));
    }
    return root;
  }

  function change(r: () => number, tree: B[], tag: string, steps: number) {
    const t: B[] = structuredClone(tree);
    const edited = new Map<string, string>();
    const ticked = new Set<string>();
    const deleted = new Set<string>();
    let fresh = 0;
    for (let s = 0; s < steps; s++) {
      const blocks = all(t);
      if (!blocks.length) break;
      const b = blocks[Math.floor(r() * blocks.length)];
      const op = r();
      if (op < 0.25) {
        b.content[0].text = `${b.content[0].text} +${tag}${s}`;
        edited.set(b.id, b.content[0].text);
      } else if (op < 0.35) {
        b.props.checked = !b.props.checked;
        ticked.add(b.id);
      } else if (op < 0.65) {
        const from = listOf(t, b.id);
        from.splice(from.indexOf(b), 1);
        const targets = [t, ...all(t).filter((x) => x.id !== b.id && !insideOf(b, x.id)).map((x) => x.children)];
        const to = targets[Math.floor(r() * targets.length)];
        to.splice(Math.floor(r() * (to.length + 1)), 0, b);
      } else if (op < 0.8) {
        const from = listOf(t, b.id);
        from.splice(from.indexOf(b), 1);
        for (const x of all([b])) deleted.add(x.id);
      } else {
        const to = r() < 0.5 ? t : b.children;
        const id = `${tag}${fresh++}`;
        to.splice(Math.floor(r() * (to.length + 1)), 0, blk(id, `new ${id}`));
        edited.set(id, `new ${id}`);
      }
    }
    for (const id of deleted) edited.delete(id), ticked.delete(id);
    return { tree: t, edited, ticked, deleted };
  }

  it("never loses an edit, never repeats a block id, and always makes a tree", () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const r = rng(seed);
      const base = randomTree(r, 3 + Math.floor(r() * 10));
      const L = change(r, base, "L", 1 + Math.floor(r() * 6));
      const R = change(r, base, "R", 1 + Math.floor(r() * 6));
      const out = mergeBlocks(base, L.tree, R.tree) as B[];
      const flat = all(out);
      const ids = flat.map((b) => b.id);
      const at = `seed ${seed}`;

      expect(new Set(ids).size, at).toBe(ids.length);
      const text = new Map(flat.map((b) => [b.id, b.content[0].text]));
      const texts = new Set(text.values());
      // Every edit is on the page: in its own block, or in a conflict copy next to it.
      for (const [id, t] of [...L.edited, ...R.edited]) {
        if (!L.deleted.has(id) && !R.deleted.has(id)) expect(text.get(id) === t || texts.has(t), `${at}: edit of ${id}`).toBe(true);
        else expect(texts.has(t), `${at}: edit of ${id} deleted on the other side`).toBe(true);
      }
      // A tick made on one side only, on a block neither side deleted and the other didn't tick, stays.
      for (const [mine, theirs] of [[L, R], [R, L]] as const)
        for (const id of mine.ticked) {
          if (theirs.ticked.has(id) || theirs.deleted.has(id) || mine.deleted.has(id)) continue;
          const want = all(mine.tree).find((b) => b.id === id)!.props.checked;
          expect(flat.find((b) => b.id === id)?.props.checked, `${at}: tick of ${id}`).toBe(want);
        }
      // Untouched blocks that neither side deleted are all still there.
      for (const b of all(base)) if (!L.deleted.has(b.id) && !R.deleted.has(b.id)) expect(ids, `${at}: ${b.id}`).toContain(b.id);
      // Merging again with the result as one side changes nothing more.
      expect(mergeBlocks(base, out, out), at).toEqual(out);
    }
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
