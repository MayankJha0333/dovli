import { beforeEach, describe, expect, it, vi } from "vitest";
import { markdownToBlocks } from "@dovli/core";
import { createCloud } from "@/lib/server/cloudCore";
import { memoryCloudStore } from "@/lib/server/cloudMemory";
import { createMcp } from "@/lib/server/mcpCore";

// The real route on an in-memory cloud: no database, and no AI (notes are stubbed below).
let mcp: ReturnType<typeof createMcp>;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/mcp", () => ({ mcpServer: () => mcp }));
vi.mock("@/lib/server/linkNotes", () => ({
  NotesError: class extends Error {},
  notesEngine: vi.fn(async () => ({ engine: { provider: "anthropic", apiKey: "k", model: "m" }, own: true })),
  writeNotes: vi.fn(async () => ({ markdown: "## Key points\n- Rest the dough", inputTokens: 1, outputTokens: 1, own: true, limit: 0 })),
}));

const { POST } = await import("./route");
const { notesEngine } = await import("@/lib/server/linkNotes");

let cloud: ReturnType<typeof createCloud>;
let secret: string;
const get = async (id: string) => (await cloud.pull("u1", { cursor: 0 })).find((r) => r.id === id)?.data as any;
async function call(body: Record<string, unknown>, token = secret) {
  const res = await POST(new Request("http://localhost/api/extension", { method: "POST", headers: { authorization: `Bearer ${token}`, origin: "chrome-extension://abc" }, body: JSON.stringify(body) }));
  return { status: res.status, data: (await res.json()) as any };
}

beforeEach(async () => {
  const store = memoryCloudStore();
  cloud = createCloud({ store });
  mcp = createMcp({ store, cloud, profile: async () => ({ name: "Asha", email: "asha@example.com" }) });
  await cloud.upsertUser({ uid: "u1", email: "asha@example.com", name: "Asha", signedIn: true });
  const res = await cloud.push("u1", { id: "trip", data: { id: "trip", parentId: null, kind: "doc", title: "Japan trip", mark: "🗾", style: "blossom", blocks: markdownToBlocks("# Plan\n\n- [ ] Book flights"), createdAt: 1, updatedAt: 1, order: 0 }, baseRev: null });
  expect(res.ok).toBe(true);
  ({ secret } = await mcp.create("u1", { name: "Dovli for Chrome", scope: "all", permission: "edit" }));
});

describe("/api/extension", () => {
  it("needs a live connection", async () => {
    expect(await call({ action: "hello" }, "dvl_nottherightsecretatall123")).toMatchObject({ status: 401, data: { code: "disconnected" } });
    const [c] = await mcp.list("u1");
    await mcp.update("u1", c.id, { enabled: false });
    expect((await call({ action: "hello" })).status).toBe(403);
  });

  it("says hello with the account and recent pages", async () => {
    const { status, data } = await call({ action: "hello" });
    expect(status).toBe(200);
    expect(data).toMatchObject({ account: { email: "asha@example.com" }, can: "edit" });
    expect(data.recent.map((p: any) => p.id)).toContain("trip");
  });

  it("reads a page for the panel, then follows it cheaply", async () => {
    const read = await call({ action: "read", pageId: "trip" });
    expect(read.data.page).toMatchObject({ id: "trip", title: "Japan trip", style: { id: "blossom" } });
    expect(read.data.page.blocks.map((b: any) => b.type)).toEqual(["heading", "checkListItem"]);
    const cursor = read.data.cursor;
    expect((await call({ action: "follow", pageId: "trip", cursor })).data.changed).toBe(false);

    await call({ action: "add", pageId: "trip", markdown: "Pack light" });
    const after = await call({ action: "follow", pageId: "trip", cursor });
    expect(after.data).toMatchObject({ changed: true });
    expect(after.data.cursor).toBeGreaterThan(cursor);
  });

  it("edits blocks, ticks to-dos and deletes", async () => {
    const { blocks } = (await call({ action: "read", pageId: "trip" })).data.page;
    const [heading, todo] = blocks;
    await call({ action: "update", pageId: "trip", blockId: heading.id, markdown: "## The plan" });
    await call({ action: "task", pageId: "trip", blockId: todo.id, done: true });
    let page = await get("trip");
    expect(page.blocks[0]).toMatchObject({ id: heading.id, type: "heading", props: { level: 2 } });
    expect(page.blocks[1].props.checked).toBe(true);
    await call({ action: "delete", pageId: "trip", blockIds: [todo.id] });
    page = await get("trip");
    expect(page.blocks).toHaveLength(1);
    expect((await call({ action: "update", pageId: "trip", blockId: "nope", markdown: "x" })).status).toBe(400);
  });

  it("adds a selection from a website, quoted, with its source", async () => {
    const { status } = await call({ action: "addClip", pageId: "trip", kind: "selection", pageUrl: "https://ex.com/a", pageTitle: "Kyoto guide", html: "Visit <b>early</b>." });
    expect(status).toBe(200);
    const page = await get("trip");
    expect(page.blocks.slice(-2).map((b: any) => b.type)).toEqual(["quote", "caption"]);
    expect((await call({ action: "addClip", pageId: "trip", kind: "image", pageUrl: "https://ex.com", pageTitle: "", src: "data:x" })).status).toBe(400);
  });

  const recipe = (body: string) =>
    `<html><head><title>Easy pancakes | Food Site</title><meta property="og:site_name" content="Food Site"><script type="application/ld+json">{"@type":"Recipe"}</script></head><body><nav>Home</nav><article><h1>Easy pancakes</h1>${body}</article></body></html>`;
  const text = "<p>Whisk the flour, eggs and milk into a smooth batter, then rest it for half an hour before you cook. </p>".repeat(6);

  it("clips the tab as the browser shows it, styled to suit, with a dated source line", async () => {
    const { status, data } = await call({ action: "clip", mode: "article", url: "https://food.example/pancakes", html: recipe(text), today: "2026-10-20", locale: "en-GB" });
    expect(status).toBe(200);
    expect(data).toMatchObject({ title: "Easy pancakes", style: "cafe" });
    const page = await get(data.pageId);
    expect(page).toMatchObject({ title: "Easy pancakes", style: "cafe", mark: "↗" });
    expect(page.blocks[0].type).toBe("caption");
    expect(JSON.stringify(page.blocks[0].content)).toContain("saved 20 Oct 2026");
    expect(JSON.stringify(page.blocks)).not.toContain("Home");
  });

  it("makes AI notes with the person's own AI", async () => {
    const { data } = await call({ action: "clip", mode: "notes", url: "https://food.example/pancakes", html: recipe(text) });
    expect(notesEngine).toHaveBeenCalledWith(expect.anything(), { id: "u1" });
    const page = await get(data.pageId);
    expect(page.blocks.map((b: any) => b.type)).toEqual(["caption", "heading", "bulletListItem"]);
  });

  it("refuses pages it can't use", async () => {
    expect((await call({ action: "clip", url: "chrome://settings", html: "<p>x</p>" })).status).toBe(400);
    expect((await call({ action: "clip", url: "https://ex.com", html: "<html><body><div id=app></div></body></html>" })).status).toBe(422);
  });

  it("saves the part of the page someone chose, their title, tags and remark, inside a page", async () => {
    const region = `<html><head><title>Easy pancakes | Food Site</title></head><body><div><h2>Toppings</h2><p>Lemon and <mark>sugar</mark>.</p></div></body></html>`;
    const { status, data } = await call({ action: "clip", mode: "article", region: "guess", url: "https://food.example/pancakes", html: region, title: "Pancake toppings", tags: ["recipe", "Sunday brunch"], remark: "For the weekend", parentId: "trip" });
    expect(status).toBe(200);
    const page = await get(data.pageId);
    expect(page).toMatchObject({ title: "Pancake toppings", parentId: "trip" });
    expect(page.blocks.map((b: any) => b.type)).toEqual(["caption", "paragraph", "callout", "heading", "paragraph"]);
    const md = JSON.stringify(page.blocks);
    expect(md).toContain("#sunday-brunch");
    // Highlights made on the page come through as highlights.
    expect(page.blocks[4].content).toContainEqual(expect.objectContaining({ text: "sugar", styles: { backgroundColor: "yellow" } }));
  });

  it("keeps the whole page when asked, not just the article", async () => {
    const html = recipe(text).replace("</article>", "</article><aside><p>Try our waffles too.</p></aside>");
    const article = await call({ action: "clip", mode: "article", url: "https://food.example/pancakes", html });
    expect(JSON.stringify((await get(article.data.pageId)).blocks)).not.toContain("waffles");
    const whole = await call({ action: "clip", mode: "page", url: "https://food.example/pancakes", html });
    expect(JSON.stringify((await get(whole.data.pageId)).blocks)).toContain("waffles");
    // The same, when the person outlined the article and the sidebar themselves.
    const chosen = await call({ action: "clip", mode: "article", region: "chosen", url: "https://food.example/pancakes", html });
    const page = await get(chosen.data.pageId);
    expect(JSON.stringify(page.blocks)).toContain("waffles");
    // Its own "Easy pancakes" heading isn't repeated under the title.
    expect(page.blocks.slice(0, 2).map((b: any) => b.type)).toEqual(["caption", "paragraph"]);
  });

  it("saves a selection or a bookmark as a page of its own", async () => {
    const sel = await call({ action: "clip", mode: "selection", url: "https://ex.com/a", pageTitle: "Kyoto guide", html: "Visit <b>early</b>." });
    expect(sel.status).toBe(200);
    expect(await get(sel.data.pageId)).toMatchObject({ title: "Kyoto guide", style: "paper" });
    expect((await get(sel.data.pageId)).blocks.map((b: any) => b.type)).toEqual(["caption", "quote"]);

    const mark = await call({ action: "clip", mode: "bookmark", url: "https://ex.com/a", title: "Read later", siteName: "Kyoto Guide", description: "A guide to Kyoto." });
    const page = await get(mark.data.pageId);
    expect(page).toMatchObject({ title: "Read later", mark: "🔖" });
    expect(JSON.stringify(page.blocks[0].content)).toContain("Kyoto Guide");
    expect(page.blocks[1].props.link).toBe("https://ex.com/a");
    expect(page.blocks.map((b: any) => b.type)).toEqual(["caption", "embed", "paragraph"]);
    expect((await call({ action: "clip", mode: "selection", url: "https://ex.com/a", html: "" })).status).toBe(400);
  });

  it("adds a bookmark to a page with a remark and tags", async () => {
    await call({ action: "addClip", pageId: "trip", kind: "bookmark", href: "https://ex.com/a", pageUrl: "https://ex.com/a", pageTitle: "", description: "Temples", remark: "Day 3", tags: ["kyoto"] });
    const page = await get("trip");
    expect(page.blocks.slice(-4).map((b: any) => b.type)).toEqual(["embed", "paragraph", "callout", "paragraph"]);
  });

  it("makes new pages in the default style", async () => {
    const { data } = await call({ action: "create", title: "Reading list" });
    expect((await get(data.page_id)).style).toBe("paper");
  });
});
