import { createHash } from "node:crypto";
import { DOMParser } from "linkedom";
import { beforeAll, describe, expect, it } from "vitest";
import { calloutHtml, confluencePage, confluenceTree, enmlToHtml, finishBlocks, hoistMedia, md5, mhtPart, parseEnex, parseHtml, parseMht } from "./importers";

beforeAll(() => {
  (globalThis as any).DOMParser = DOMParser;
});

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

describe("md5", () => {
  it("matches Node's for empty, padding-edge and longer inputs", () => {
    for (const n of [0, 3, 55, 56, 63, 64, 65, 1000]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
      expect(md5(bytes)).toBe(createHash("md5").update(bytes).digest("hex"));
    }
  });
});

describe("Evernote", () => {
  const hash = createHash("md5").update(png).digest("hex");
  const enex = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="20240101T000000Z" application="Evernote" version="10.70">
  <note>
    <title>Trip &amp; plans</title>
    <created>20230115T093012Z</created>
    <tag>travel</tag><tag>summer plans</tag>
    <content><![CDATA[<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note><div>Look at this <en-media hash="${hash}" type="image/png"/> view</div>
<div><en-todo checked="true"/>Book flights</div>
<div><en-todo/>Pack</div>
<ul style="--en-todo:true;"><li style="--en-checked:true;"><div>Passport</div></li><li style="--en-checked:false;"><div>Charger</div></li></ul>
<div style="box-sizing: border-box; --en-codeblock:true;"><div>let a = 1;</div><div>let b = 2;</div></div>
<div><br/></div></en-note>]]></content>
    <resource><data encoding="base64">${b64(png)}</data><mime>image/png</mime><resource-attributes><file-name>view.png</file-name></resource-attributes></resource>
  </note>
  <note><title>Second</title><content><![CDATA[<en-note><div>Hi</div></en-note>]]></content></note>
</en-export>`;

  it("reads notes, dates, tags and pictures (matched by MD5)", () => {
    const [a, b] = parseEnex(enex);
    expect(a.title).toBe("Trip & plans");
    expect(a.created).toBe(Date.UTC(2023, 0, 15, 9, 30, 12));
    expect(a.tags).toEqual(["travel", "summer plans"]);
    expect(a.resources).toEqual([{ hash, mime: "image/png", name: "view.png", bytes: png }]);
    expect(a.html).toContain(`<img src="enex:${hash}">`);
    // The self-closing <en-media/> doesn't swallow the text after it.
    expect(parseHtml(a.html).querySelector("img")?.textContent).toBe("");
    expect(b.title).toBe("Second");
  });

  it("turns old and new to-dos into checklists, and code blocks into code", () => {
    const doc = parseHtml(parseEnex(enex)[0].html);
    const items = [...doc.querySelectorAll("li")].map((li) => [li.textContent?.trim(), li.querySelector("input")?.hasAttribute("checked")]);
    expect(items).toEqual([
      ["Book flights", true],
      ["Pack", false],
      ["Passport", true],
      ["Charger", false],
    ]);
    expect(doc.querySelector("pre code")?.textContent).toBe("let a = 1;\nlet b = 2;");
    expect([...doc.querySelectorAll("div")].some((d) => d.innerHTML === "<br>")).toBe(false);
  });

  it("keeps attachments that aren't pictures as files", () => {
    expect(enmlToHtml(`<en-note><en-media hash="abc" type="application/pdf"/></en-note>`)).toBe(`<embed src="enex:abc">`);
  });
});

describe("Confluence", () => {
  const index = `<html><body><div class="pageSection"><h2>Available Pages:</h2>
<ul><li><a href="Home_1.html">Home</a><ul><li><a href="Guide_2.html">Guide</a><ul><li><a href="Setup_3.html">Setup</a></li></ul></li></ul></li>
<li><a href="Notes_4.html">Notes</a></li></ul></div></body></html>`;

  it("reads the page tree from index.html", () => {
    expect([...confluenceTree(index)]).toEqual([
      ["Home_1.html", null],
      ["Guide_2.html", "Home_1.html"],
      ["Setup_3.html", "Guide_2.html"],
      ["Notes_4.html", null],
    ]);
  });

  const page = `<html><head><title>Team : Setup</title></head><body>
<div id="main-header"><div id="breadcrumb-section"><ol id="breadcrumbs">
<li class="first"><span><a href="index.html">Team</a></span></li><li><span><a href="Home_1.html">Home</a></span></li><li><span><a href="Guide_2.html">Guide</a></span></li></ol></div>
<h1 id="title-heading" class="pagetitle"><span id="title-text"> Team : Setup </span></h1></div>
<div id="content" class="view"><div class="page-metadata">Created by Someone</div>
<div id="main-content" class="wiki-content group">
<p>Intro</p>
<div class="confluence-information-macro confluence-information-macro-tip"><span class="aui-icon confluence-information-macro-icon"></span><div class="confluence-information-macro-body"><p>First</p><p>Second</p></div></div>
<div class="code panel pdl"><div class="codeContent panelContent pdl"><pre class="syntaxhighlighter-pre" data-syntaxhighlighter-params="brush: java; gutter: false">int x = 1;</pre></div></div>
<ul class="inline-task-list"><li class="checked">Done</li><li>Todo</li></ul>
<div class="expand-container"><div class="expand-control"><span class="expand-control-text">More</span></div><div class="expand-content"><p>Hidden</p></div></div>
</div><div class="pageSection group"><h2>Attachments:</h2></div></div></body></html>`;

  it("reads a page's title, parent and body", () => {
    const r = confluencePage(page);
    expect(r.title).toBe("Setup");
    expect(r.parent).toBe("Guide_2.html");
    const body = parseHtml(r.body);
    expect(body.querySelector("blockquote")?.innerHTML).toBe("<p>[!TIP] First<br>Second</p>");
    expect(body.querySelector("pre")?.innerHTML).toBe('<code class="language-java">int x = 1;</code>');
    expect([...body.querySelectorAll("li")].map((li) => li.querySelector("input")?.hasAttribute("checked"))).toEqual([true, false]);
    expect(body.querySelector("details summary")?.textContent).toBe("More");
    expect(r.body).not.toContain("Created by");
    expect(r.body).not.toContain("Attachments");
  });
});

describe("web archives", () => {
  const mht = [
    "From: <Saved by Blink>",
    "MIME-Version: 1.0",
    'Content-Type: multipart/related; type="text/html";',
    '\tboundary="----=_NextPart_01"',
    "",
    "This is a multi-part message in MIME format.",
    "",
    "------=_NextPart_01",
    "Content-Location: file:///C:/Users/me/Notes.htm",
    "Content-Transfer-Encoding: quoted-printable",
    'Content-Type: text/html; charset="utf-8"',
    "",
    '<html><head><meta name=3DGenerator content=3D"Microsoft OneNote 15"></head><body><p>Caf=C3=A9 =',
    'list</p><img src=3D"Notes_files/image001.png"></body></html>',
    "",
    "------=_NextPart_01",
    "Content-Location: file:///C:/Users/me/Notes_files/image001.png",
    "Content-Transfer-Encoding: base64",
    "Content-Type: image/png",
    "",
    b64(png),
    "",
    "------=_NextPart_01--",
  ].join("\r\n");

  it("reads the page, its generator and its pictures", () => {
    const r = parseMht(new TextEncoder().encode(mht));
    expect(r.generator).toBe("Microsoft OneNote 15");
    expect(r.html).toContain("<p>Café list</p>");
    expect(r.parts).toHaveLength(1);
    expect(mhtPart(r.parts, "Notes_files/image001.png", r.location)?.bytes).toEqual(png);
    expect(mhtPart(r.parts, "missing.png", r.location)).toBeUndefined();
  });
});

describe("tidying and finishing", () => {
  it("moves pictures out of lines of text, in order", () => {
    const doc = parseHtml(`<p>a <img src="1"> b <img src="2"></p><h2>t</h2>`);
    hoistMedia(doc.body);
    expect(doc.body.innerHTML).toBe(`<p>a  b </p><img src="1"><img src="2"><h2>t</h2>`);
  });

  it("makes [!TONE] quotes callouts, and names files", () => {
    const text = (t: string) => ({ type: "text", text: t, styles: {} });
    const out = finishBlocks(
      [
        { id: "a", type: "quote", props: {}, content: [text("[!WARNING] Careful "), text("now")], children: [] },
        { id: "b", type: "quote", props: {}, content: [text("[!SHRUG] not a tone")], children: [] },
        { id: "c", type: "file", props: { url: "dovli-file://x", name: "" }, children: [] },
      ],
      new Map([["dovli-file://x", "Report.pdf"]]),
    );
    expect(out[0]).toMatchObject({ type: "callout", props: { tone: "warning" }, content: [text("Careful "), text("now")] });
    expect(out[1].type).toBe("quote");
    expect(out[2]).toEqual({ id: "c", type: "pdf", props: { url: "dovli-file://x", name: "Report.pdf" }, children: [] });
  });

  it("writes a callout as one quoted line", () => {
    expect(calloutHtml("note", "<p>One</p><p>Two</p>")).toBe("<blockquote><p>[!NOTE] One<br>Two</p></blockquote>");
  });
});
