import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { inline, renderBlocks } from "./render.js";

const doc = () => parseHTML("<!doctype html><html><body></body></html>").document;
const html = (frag, d) => {
  const box = d.createElement("div");
  box.append(frag);
  return box.innerHTML;
};
const t = (text, styles = {}) => ({ type: "text", text, styles });

describe("inline", () => {
  it("draws styles as elements and text as text, never as HTML", () => {
    const d = doc();
    expect(html(inline([t("Hi "), t("there", { bold: true, italic: true }), t(" <img src=x onerror=alert(1)>")], d), d)).toBe(
      "Hi <em><strong>there</strong></em> &lt;img src=x onerror=alert(1)&gt;",
    );
  });
  it("only links to web and mail addresses", () => {
    const d = doc();
    const out = html(inline([{ type: "link", href: "javascript:alert(1)", content: [t("bad")] }, { type: "link", href: "https://ok.example/", content: [t("good")] }], d), d);
    expect(out).toContain("bad");
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="https://ok.example/"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
  it("links to other Dovli pages in the app", () => {
    const d = doc();
    const out = html(inline([{ type: "pageLink", props: { pageId: "abc", title: "Trip" } }], d, { appUrl: (id) => `https://dovli.in/app#p-${id}` }), d);
    expect(out).toContain('href="https://dovli.in/app#p-abc"');
    expect(out).toContain(">Trip<");
  });
});

describe("renderBlocks", () => {
  it("numbers lists per level, and starts again after other blocks", () => {
    const d = doc();
    const blocks = [
      { id: "a", type: "numberedListItem", depth: 0, content: [t("one")] },
      { id: "b", type: "numberedListItem", depth: 1, content: [t("one.a")] },
      { id: "c", type: "numberedListItem", depth: 0, content: [t("two")] },
      { id: "d", type: "paragraph", depth: 0, content: [t("gap")] },
      { id: "e", type: "numberedListItem", depth: 0, content: [t("again")] },
    ];
    const box = d.createElement("div");
    box.append(renderBlocks(blocks, d));
    expect([...box.querySelectorAll(".marker")].map((m) => m.textContent)).toEqual(["1.", "1.", "2.", "1."]);
    expect(box.querySelector('[data-id="b"]').getAttribute("style")).toMatch(/--depth:\s*1/);
  });
  it("draws to-dos with a checkbox, and marks what can be edited", () => {
    const d = doc();
    const box = d.createElement("div");
    box.append(renderBlocks([{ id: "x", type: "checkListItem", depth: 0, props: { checked: true }, content: [t("done")] }, { id: "y", type: "flowchart", depth: 0, props: {} }], d));
    const check = box.querySelector('[data-action="toggle"]');
    expect(check.checked).toBe(true);
    expect(box.querySelector('[data-id="x"]').dataset.editable).toBe("true");
    expect(box.querySelector('[data-id="y"]').dataset.editable).toBe("false");
    expect(box.textContent).toContain("Flowchart");
  });
  it("shows web pictures, but not other addresses", () => {
    const d = doc();
    const box = d.createElement("div");
    box.append(renderBlocks([
      { id: "i", type: "image", depth: 0, props: { url: "https://cdn.example/a.png", caption: "Loaf" } },
      { id: "j", type: "image", depth: 0, props: { url: "javascript:alert(1)" } },
    ], d));
    expect(box.querySelectorAll("img").length).toBe(1);
    expect(box.querySelector("img").getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(box.innerHTML).not.toContain("javascript:");
  });
  it("keeps code as text", () => {
    const d = doc();
    const box = d.createElement("div");
    box.append(renderBlocks([{ id: "c", type: "codeBlock", depth: 0, props: { language: "html" }, content: "<script>alert(1)</script>" }], d));
    expect(box.querySelector("script")).toBeNull();
    expect(box.querySelector("code").textContent).toBe("<script>alert(1)</script>");
  });
});
