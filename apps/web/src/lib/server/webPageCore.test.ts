import { describe, expect, it } from "vitest";
import { markdownToBlocks } from "@dovli/core";
import { checkUrl, cleanTitle, htmlToMarkdown, isPublicAddress, readArticle, sourceForAI, tidyNotes } from "./webPageCore";

const URL_ = "https://blog.example.com/posts/bread";
const md = (html: string) => htmlToMarkdown(html, URL_);
const types = (markdown: string) => markdownToBlocks(markdown).map((b) => b.type);

describe("isPublicAddress", () => {
  it("allows public addresses", () => {
    for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
  it("refuses private, local and special addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::7f00:1", "2002:7f00:1::"])
      expect(isPublicAddress(ip), ip).toBe(false);
  });
  it("refuses things that aren't addresses", () => {
    expect(isPublicAddress("example.com")).toBe(false);
    expect(isPublicAddress("")).toBe(false);
  });
});

describe("checkUrl", () => {
  const ok = (s: string) => {
    const r = checkUrl(s);
    return r.ok ? r.url.href : null;
  };
  it("adds https to a bare address and drops the #part", () => {
    expect(ok("example.com/post#comments")).toBe("https://example.com/post");
    expect(ok("  http://example.com/a?b=1 ")).toBe("http://example.com/a?b=1");
    expect(ok("example.com:8080/x")).toBe("https://example.com:8080/x");
  });
  it("refuses other schemes, odd ports, credentials and local names", () => {
    for (const s of ["", "javascript:alert(1)", "file:///etc/passwd", "ftp://example.com", "https://example.com:22/", "https://user:pw@example.com/", "http://localhost:3000", "http://127.0.0.1/", "http://[::1]/", "http://10.0.0.5/", "http://printer.local/", "http://intranet/", "http://169.254.169.254/latest/meta-data"])
      expect(ok(s), s).toBeNull();
  });
});

describe("htmlToMarkdown", () => {
  it("keeps headings, paragraphs and inline styles", () => {
    expect(md("<h2>Dough</h2><p>Mix <strong>flour</strong> and <em>water</em>, then <code>knead()</code>.</p>")).toBe("## Dough\n\nMix **flour** and *water*, then `knead()`.");
    expect(md("<h5>Small</h5>")).toBe("### Small");
  });
  it("makes relative links absolute and skips in-page links", () => {
    expect(md('<p>See <a href="/flour">flour</a> and <a href="#fn1">1</a>.</p>')).toBe("See [flour](https://blog.example.com/flour) and 1.");
    expect(md('<p><a href="javascript:evil()">x</a></p>')).toBe("x");
  });
  it("escapes text that would read as Markdown", () => {
    expect(md("<p>1. Not a list *really* [x]</p>")).toBe("\\1. Not a list \\*really\\* \\[x\\]");
    expect(types(md("<p># not a heading</p><p>- not a bullet</p>"))).toEqual(["paragraph", "paragraph"]);
  });
  it("turns nested lists, numbered lists and checkboxes into Dovli lists", () => {
    const out = md('<ul><li><p>One</p><ul><li>One.a</li></ul></li><li>Two</li></ul><ol start="3"><li>Three</li></ol><ul><li><input type="checkbox" checked> Done</li></ul>');
    const blocks = markdownToBlocks(out);
    expect(blocks.map((b) => b.type)).toEqual(["bulletListItem", "bulletListItem", "numberedListItem", "checkListItem"]);
    expect(blocks[0].children[0].type).toBe("bulletListItem");
    expect(blocks[3].props.checked).toBe(true);
  });
  it("keeps code exactly, with its language", () => {
    const out = md('<pre><code class="language-js">if (a) {\n  b();\n}</code></pre>');
    expect(out).toBe("```js\nif (a) {\n  b();\n}\n```");
    const [block] = markdownToBlocks(out);
    expect(block).toMatchObject({ type: "codeBlock", props: { language: "js" }, content: "if (a) {\n  b();\n}" });
  });
  it("makes tables, and treats tables of tables as layout", () => {
    const out = md("<table><tr><th>Flour</th><th>Grams</th></tr><tr><td>Bread | strong</td><td>500</td></tr></table>");
    expect(out).toBe("| Flour | Grams |\n| --- | --- |\n| Bread \\| strong | 500 |");
    expect(types(out)).toEqual(["table"]);
    expect(types(md("<table><tr><td><table><tr><td>a</td><td>b</td></tr></table></td></tr></table>"))).toEqual(["table"]);
  });
  it("places pictures on their own line with absolute addresses, and drops tracking pixels", () => {
    const out = md('<p>Look <img src="/a (1).jpg" alt="The [loaf]"> here</p><img src="/px.gif" width="1" height="1"><figure><img data-src="https://cdn.example.com/b.jpg" src="data:image/gif;base64,AAA"><figcaption>Crumb</figcaption></figure>');
    expect(out).toBe("Look here\n\n![The loaf](https://blog.example.com/a%20%281%29.jpg)\n\n![Crumb](https://cdn.example.com/b.jpg)");
    expect(types(out)).toEqual(["paragraph", "image", "image"]);
  });
  it("keeps known video players and drops other frames", () => {
    expect(md('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><iframe src="https://ads.example.com/x"></iframe>')).toBe('<embed url="https://www.youtube.com/embed/dQw4w9WgXcQ"/>');
  });
  it("makes quotes, toggles and dividers", () => {
    const out = md("<blockquote><p>First</p><p>Second</p></blockquote><hr><details><summary>More</summary><p>Hidden</p></details>");
    expect(out).toBe("> First\n> Second\n\n---\n\n+ More\n\n  Hidden");
    const blocks = markdownToBlocks(out);
    expect(blocks.map((b) => b.type)).toEqual(["quote", "divider", "toggleListItem"]);
    expect(blocks[2].children[0].type).toBe("paragraph");
  });
  it("finds paragraphs inside inline wrappers and <br><br> breaks (old hand-written pages)", () => {
    expect(md('<span face="verdana">July 2023<p>First.</p><p>Second.</p></span>')).toBe("July 2023\n\nFirst.\n\nSecond.");
    expect(md("<p>One<br><br>Two<br>still two</p>")).toBe("One\n\nTwo<br>still two");
  });
  it("keeps lists inside definitions, and MDN's code language", () => {
    const out = md('<dl><dt><code>fn</code></dt><dd><p>Called for each item:</p><dl><dt>item</dt><dd>The item.</dd></dl></dd></dl><pre class="brush: js notranslate">a()</pre>');
    expect(out).toBe("**`fn`**\n\n- Called for each item:\n  **item**\n\n  - The item.\n\n```js\na()\n```");
    const blocks = markdownToBlocks(out);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "bulletListItem", "codeBlock"]);
    expect(blocks[1].children.map((b: any) => b.type)).toEqual(["paragraph", "bulletListItem"]);
  });
  it("drops small icons", () => {
    expect(md('<img src="/logo.png" width="20" height="20"><img src="/photo.jpg" width="400">')).toBe("![](https://blog.example.com/photo.jpg)");
  });
  it("ignores scripts, styles and forms", () => {
    expect(md("<p>Hi</p><script>alert(1)</script><style>p{}</style><form><input value=x></form>")).toBe("Hi");
  });
});

describe("readArticle", () => {
  const filler = "Bread needs time, warmth and patience to rise well. ".repeat(12);
  const page = `<!doctype html><html lang="en"><head><title>How to bake bread | The Kitchen</title>
    <meta property="og:site_name" content="The Kitchen"><meta property="article:published_time" content="2026-03-12"></head>
    <body><nav><a href="/">Home</a><a href="/about">About</a></nav>
    <article><h1>How to bake bread</h1><p class="byline">By Sam Baker</p><p>${filler}</p><h2>Steps</h2><ol><li>Mix</li><li>Knead</li><li>Bake</li></ol><p>${filler}</p></article>
    <footer>© The Kitchen. Subscribe to our newsletter!</footer></body></html>`;

  it("finds the main text, title and details, without menus or footers", () => {
    const a = readArticle(page, URL_)!;
    expect(a.title).toBe("How to bake bread");
    expect(a.siteName).toBe("The Kitchen");
    expect(a.published).toBe("2026-03-12");
    expect(a.markdown).toContain("## Steps\n\n1. Mix\n2. Knead\n3. Bake");
    expect(a.markdown).not.toMatch(/Subscribe|About/);
    expect(a.words).toBeGreaterThan(100);
  });
  it("reads a page hidden until its script runs, but keeps small hidden things hidden", () => {
    const hidden = page
      .replace(`<p>${filler}</p>`, `<p>${filler.repeat(3)}</p>`)
      .replace("<body>", '<body><div style="visibility:hidden;min-height:100vh">').replace("</body>", '<div style="visibility: hidden">Sign up for our newsletter</div></div></body>');
    const a = readArticle(hidden, URL_)!;
    expect(a.markdown).toContain("## Steps");
    expect(a.markdown).not.toContain("newsletter");
  });
  it("gives up on a page with no readable text", () => {
    expect(readArticle('<html><body><div id="root"></div><script src="/app.js"></script></body></html>', URL_)).toBeNull();
  });
  it("reads plain text pages", () => {
    const a = readArticle("Line one\n\n# not a heading", "https://example.com/notes.txt", "text")!;
    expect(a.title).toBe("notes.txt");
    expect(a.markdown).toBe("Line one\n\n\\# not a heading");
  });
});

describe("cleanTitle", () => {
  it("drops the site name at either end", () => {
    expect(cleanTitle("How to bake bread | The Kitchen", "The Kitchen")).toBe("How to bake bread");
    expect(cleanTitle("The Kitchen — How to bake bread", "The Kitchen")).toBe("How to bake bread");
    expect(cleanTitle("The Kitchen", "The Kitchen")).toBe("The Kitchen");
    expect(cleanTitle("Thinking in React – React", "react.dev", "react.dev")).toBe("Thinking in React");
    expect(cleanTitle("Array.prototype.map() - JavaScript | MDN", "MDN Web Docs", "developer.mozilla.org")).toBe("Array.prototype.map() - JavaScript | MDN");
    expect(cleanTitle("Rock – Paper", "", "example.com")).toBe("Rock – Paper");
  });
});

describe("for the AI", () => {
  it("leaves out pictures and players, and cuts long pages at a line", () => {
    expect(sourceForAI("A\n\n![x](https://a.b/c.png)\n\n<embed url=\"https://youtu.be/x\"/>\n\nB", 100)).toEqual({ text: "A\n\nB", cut: false });
    const long = Array.from({ length: 50 }, (_, i) => `Line ${i}`).join("\n");
    const r = sourceForAI(long, 100);
    expect(r.cut).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(100);
    expect(r.text.endsWith("\n")).toBe(false);
  });
  it("unwraps a fenced answer and drops a repeated title", () => {
    expect(tidyNotes("```markdown\n# How to bake bread\n\n## Key points\n- Rise\n```", "How to bake bread")).toBe("## Key points\n- Rise");
    expect(tidyNotes("# Something else\n\nText", "How to bake bread")).toBe("# Something else\n\nText");
    expect(tidyNotes("- One  \n- Two  ", "x")).toBe("- One\n- Two");
  });
});
