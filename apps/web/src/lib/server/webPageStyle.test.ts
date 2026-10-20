import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_STYLE, PAGE_STYLES } from "@dovli/theme";
import { pickStyle, styleFromColor, topicScores, type StyleSignals } from "./webPageStyle";
import { readArticle } from "./webPageCore";

const page = (s: Partial<StyleSignals>): StyleSignals => ({ host: "example.com", path: "/", title: "", about: "", types: [], headings: "", body: "", codeBlocks: 0, themeColor: "", ...s });

describe("pickStyle", () => {
  it("only ever picks styles that exist", () => {
    const ids = new Set(PAGE_STYLES.map((s) => s.id));
    for (const style of topicScores(page({})).keys()) expect(ids.has(style), style).toBe(true);
  });
  it("trusts what the site says it is", () => {
    expect(pickStyle(page({ types: ["Recipe"] }))).toBe("cafe");
    expect(pickStyle(page({ types: ["NewsArticle"] }))).toBe("paper");
    expect(pickStyle(page({ types: ["ScholarlyArticle"] }))).toBe("linen");
  });
  it("reads the topic from the title, description and text", () => {
    expect(pickStyle(page({ title: "How to bake sourdough bread", body: "Mix the flour and water. Feed the starter. Bake in a hot oven." }))).toBe("cafe");
    expect(pickStyle(page({ title: "Two weeks in Rajasthan: a travel itinerary", about: "Where to stay, which hotel, the desert trip" }))).toBe("dunes");
    expect(pickStyle(page({ title: "The James Webb telescope finds a new galaxy", body: "Astronomy … the planet … NASA" }))).toBe("cobalt");
    expect(pickStyle(page({ title: "Repotting a houseplant", about: "Gardening tips: soil, roots and pruning" }))).toBe("sage");
  });
  it("spots code and developer sites", () => {
    expect(pickStyle(page({ host: "github.com", title: "dovli/README" }))).toBe("graphite");
    expect(pickStyle(page({ title: "Closures", codeBlocks: 4 }))).toBe("graphite");
    expect(pickStyle(page({ host: "docs.python.org", title: "Built-in functions" }))).toBe("graphite");
  });
  it("lets a strong topic beat the site it's on", () => {
    // Wikipedia leans towards Notebook, but an article about bread is about food.
    expect(pickStyle(page({ host: "en.wikipedia.org", title: "Sourdough", headings: "## Starter\n## Baking", body: "bread flour yeast dough bake bread" }))).toBe("cafe");
    expect(pickStyle(page({ host: "en.wikipedia.org", title: "Treaty of Westphalia" }))).toBe("notebook");
  });
  it("needs more than a stray word", () => {
    expect(pickStyle(page({ body: "We had coffee and talked." }))).toBe(DEFAULT_PAGE_STYLE);
  });
});

describe("the site's colour", () => {
  it("matches a brand colour to the nearest light style", () => {
    const id = styleFromColor("#2f4fd8")!; // Cobalt's own accent
    expect(PAGE_STYLES.find((s) => s.id === id)?.dark).toBeFalsy();
    expect(styleFromColor("rgb(47, 79, 216)")).toBe(id);
  });
  it("ignores greys, near-black, near-white and nonsense", () => {
    for (const c of ["#777777", "#000", "#ffffff", "#0a0a0a", "", "red", "#12"]) expect(styleFromColor(c), c).toBeNull();
  });
  it("is used only when the topic is unclear", () => {
    const color = styleFromColor("#e8590c");
    expect(color).not.toBeNull();
    expect(pickStyle(page({ title: "Welcome", themeColor: "#e8590c" }))).toBe(color);
    expect(pickStyle(page({ types: ["Recipe"], themeColor: "#2f4fd8" }))).toBe("cafe");
  });
});

describe("readArticle", () => {
  const filler = "Knead the dough and let the bread rise in a warm kitchen before you bake it. ".repeat(10);
  it("chooses a style from the page's JSON-LD and text", () => {
    const html = `<html><head><title>Bread</title><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Bread"}]}</script></head>
      <body><article><h1>Bread</h1><p>${filler}</p><p>${filler}</p></article></body></html>`;
    expect(readArticle(html, "https://food.example.com/bread")!.style).toBe("cafe");
  });
  it("survives broken JSON-LD", () => {
    const html = `<html><head><script type="application/ld+json">{oops</script></head><body><article><p>${filler}</p><p>${filler}</p></article></body></html>`;
    expect(readArticle(html, "https://example.com/x")!.style).toBe("cafe");
  });
});
