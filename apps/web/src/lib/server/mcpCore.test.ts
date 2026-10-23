import { beforeEach, describe, expect, it } from "vitest";
import { blocksToMarkdown, markdownToBlocks } from "@dovli/core";
import { createCloud, personalWorkspaceId, type Doc } from "./cloudCore";
import { memoryCloudStore } from "./cloudMemory";
import { MCP_LIMIT, TOOLS, createMcp, findSecret, normalizeArgs, toolNamed, type Connection } from "./mcpCore";

let store: ReturnType<typeof memoryCloudStore>;
let cloud: ReturnType<typeof createCloud>;
let mcp: ReturnType<typeof createMcp>;
const page = (id: string, patch: Doc = {}) => ({ id, parentId: null, kind: "doc", title: id, mark: "¶", blocks: [], createdAt: 1, updatedAt: 1, order: 0, ...patch });

async function put(p: Doc) {
  const rows = await cloud.pull("u1", { cursor: 0 });
  const cur = rows.find((r) => r.id === p.id);
  const res = await cloud.push("u1", { id: p.id, data: p, baseRev: cur?.rev ?? null });
  expect(res.ok).toBe(true);
}
async function get(id: string) {
  return (await cloud.pull("u1", { cursor: 0 })).find((r) => r.id === id)?.data as any;
}
async function rpc(c: Connection, method: string, params?: Doc) {
  return mcp.handle(c, { jsonrpc: "2.0", id: 1, method, params });
}
async function tool(c: Connection, name: string, args: Doc = {}) {
  const r: any = await rpc(c, "tools/call", { name, arguments: args });
  return { error: r.result.isError ? r.result.content[0].text : null, out: r.result.structuredContent as any };
}

let edit: Connection;
beforeEach(async () => {
  store = memoryCloudStore();
  cloud = createCloud({ store });
  mcp = createMcp({ store, cloud, profile: async () => ({ name: "Asha Rao", email: "asha@example.com" }) });
  await cloud.upsertUser({ uid: "u1", email: "asha@example.com", name: "Asha Rao", signedIn: true });
  await cloud.upsertUser({ uid: "u2", email: "ben@example.com", name: "Ben", signedIn: true });
  const blocks = markdownToBlocks("# Trip\n\nPack the **bags**.\n\n- [ ] book flights\n- [x] get visa\n+ Ideas\n  Beach day");
  await put(page("trip", { title: "Japan trip", mark: "🗾", blocks, favorite: true }));
  await put(page("food", { title: "Food list", parentId: "trip", blocks: markdownToBlocks("- ramen\n- [ ] try sushi") }));
  await put(page("work", { title: "Work notes", blocks: markdownToBlocks("Quarterly server costs") }));
  edit = (await mcp.create("u1", { name: "Claude", scope: "all", permission: "edit" })).connection;
});

describe("connections", () => {
  it("makes a secret address that finds the connection, and only a hash is stored", async () => {
    const { connection, secret } = await mcp.create("u1", { name: "Codex", app: "codex", permission: "view" });
    expect(connection.app).toBe("codex");
    expect((await mcp.create("u1", { app: "nonsense" })).connection.app).toBe("other");
    expect(secret).toMatch(/^dvl_[A-Za-z0-9_-]{30,}$/);
    expect(await mcp.resolve(secret)).toMatchObject({ id: connection.id, uid: "u1", permission: "view", name: "Codex" });
    expect(JSON.stringify([...store.dump().values()])).not.toContain(secret);
    expect(await mcp.resolve("dvl_wrongwrongwrongwrongwrong")).toBeNull();
  });

  it("a new address replaces the old one at once; deleting stops it", async () => {
    const { connection, secret } = await mcp.create("u1", {});
    const next = await mcp.rotate("u1", connection.id);
    expect(await mcp.resolve(secret)).toBeNull();
    expect((await mcp.resolve(next.secret))?.id).toBe(connection.id);
    await mcp.remove("u1", connection.id);
    expect(await mcp.resolve(next.secret)).toBeNull();
  });

  it("is limited to 10, needs pages for a 'pages' scope, and can be switched off", async () => {
    for (let i = 1; i < MCP_LIMIT; i++) await mcp.create("u1", {});
    await expect(mcp.create("u1", {})).rejects.toThrow(/up to 10/);
    await expect(mcp.create("u2", { scope: "pages", pageIds: [] })).rejects.toThrow(/at least one page/);
    const off = await mcp.update("u1", edit.id, { enabled: false });
    expect(off.enabled).toBe(false);
  });
});

describe("protocol", () => {
  it("answers initialize, ping and tools/list, and ignores notifications", async () => {
    const init: any = await rpc(edit, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(init.result).toMatchObject({ protocolVersion: "2025-03-26", serverInfo: { name: "dovli" }, capabilities: { tools: {} } });
    expect(init.result.instructions).toContain("Dovli Markdown");
    expect(await mcp.handle(edit, { jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect(((await rpc(edit, "ping")) as any).result).toEqual({});
    const list: any = await rpc(edit, "tools/list");
    expect(list.result.tools.map((t: any) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(list.result.tools.find((t: any) => t.name === "read_page").annotations.readOnlyHint).toBe(true);
    expect(list.result.tools.find((t: any) => t.name === "delete_blocks").annotations.destructiveHint).toBe(true);
    expect(((await rpc(edit, "nope")) as any).error.code).toBe(-32601);
  });

  it("a read-only connection doesn't list or run the writing tools", async () => {
    const view = (await mcp.create("u1", { permission: "view" })).connection;
    const list: any = await rpc(view, "tools/list");
    expect(list.result.tools.every((t: any) => t.annotations.readOnlyHint)).toBe(true);
    expect((await tool(view, "create_page", { title: "x" })).error).toMatch(/only read/);
  });
});

describe("reading", () => {
  it("overview: counts, the page tree with ids, favourites", async () => {
    const { out } = await tool(edit, "get_overview");
    expect(out.person.name).toBe("Asha Rao");
    expect(out.counts).toMatchObject({ pages: 3, whiteboards: 0 });
    expect(out.pages.find((p: any) => p.id === "trip").inside[0]).toMatchObject({ id: "food", title: "Food list" });
    expect(out.favorites).toEqual([{ id: "trip", title: "Japan trip", icon: "🗾" }]);
  });

  it("search finds words and returns matching block ids", async () => {
    const { out } = await tool(edit, "search", { query: "sushi" });
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({ id: "food", path: ["Japan trip"] });
    expect(out.results[0].matches[0].text).toBe("try sushi");
  });

  it("read_page as Markdown and as blocks", async () => {
    const md = (await tool(edit, "read_page", { page_id: "trip" })).out;
    expect(md.markdown).toBe("# Trip\n\nPack the **bags**.\n\n- [ ] book flights\n- [x] get visa\n+ Ideas\n  Beach day");
    expect(md.pages_inside).toEqual([{ id: "food", title: "Food list" }]);
    const bl = (await tool(edit, "read_page", { page_id: "trip", format: "blocks" })).out;
    expect(bl.blocks.map((b: any) => [b.type, b.depth])).toEqual([["heading", 0], ["paragraph", 0], ["checkListItem", 0], ["checkListItem", 0], ["toggleListItem", 0], ["paragraph", 1]]);
    expect(bl.blocks[2]).toMatchObject({ markdown: "- [ ] book flights", done: false });
  });

  it("list_tasks across pages, or under one page", async () => {
    const all = (await tool(edit, "list_tasks", {})).out;
    expect(all.tasks.map((t: any) => t.text).sort()).toEqual(["book flights", "try sushi"]);
    const done = (await tool(edit, "list_tasks", { status: "done" })).out;
    expect(done.tasks.map((t: any) => t.text)).toEqual(["get visa"]);
  });

  it("a connection for chosen pages sees only them and what's inside", async () => {
    const some = (await mcp.create("u1", { scope: "pages", pageIds: ["trip"] })).connection;
    const ov = (await tool(some, "get_overview")).out;
    expect(ov.pages.map((p: any) => p.id)).toEqual(["trip"]);
    expect((await tool(some, "read_page", { page_id: "food" })).error).toBeNull();
    expect((await tool(some, "read_page", { page_id: "work" })).error).toMatch(/no page with id "work"/);
    expect((await tool(some, "search", { query: "server" })).out.results).toEqual([]);
    expect((await tool(some, "create_page", { title: "Loose" })).error).toMatch(/give parent_id/);
  });

  it("never sees another person's pages", async () => {
    const ben = (await mcp.create("u2", {})).connection;
    expect((await tool(ben, "read_page", { page_id: "trip" })).error).toMatch(/no page/);
    expect((await tool(ben, "get_overview")).out.counts.pages).toBe(0);
  });
});

describe("writing", () => {
  it("create_page makes a page inside another, with content, that syncs like any edit", async () => {
    const { out, error } = await tool(edit, "create_page", { title: "Day 1", parent_id: "trip", icon: "🌸", markdown: "## Morning\n\nVisit [[Food list]] spots." });
    expect(error).toBeNull();
    const p = await get(out.page_id);
    expect(p).toMatchObject({ title: "Day 1", parentId: "trip", mark: "🌸", kind: "doc" });
    expect(blocksToMarkdown(p.blocks)).toBe(`## Morning\n\nVisit [Food list](dovli:page/food) spots.`);
    const ws: any = store.dump().get(`workspaces/${personalWorkspaceId("u1")}`);
    expect(ws.pageCount).toBe(4);
  });

  it("add_blocks at the end, after a block, and inside a toggle", async () => {
    const bl = (await tool(edit, "read_page", { page_id: "trip", format: "blocks" })).out.blocks;
    await tool(edit, "add_blocks", { page_id: "trip", markdown: "Last line" });
    await tool(edit, "add_blocks", { page_id: "trip", markdown: "- [ ] buy yen", position: "after", block_id: bl[3].id });
    await tool(edit, "add_blocks", { page_id: "trip", markdown: "Hot springs", position: "inside", block_id: bl[4].id });
    expect(blocksToMarkdown((await get("trip")).blocks)).toBe("# Trip\n\nPack the **bags**.\n\n- [ ] book flights\n- [x] get visa\n- [ ] buy yen\n+ Ideas\n  Beach day\n\n  Hot springs\n\nLast line");
  });

  it("update_block keeps the block id and its children; delete and move blocks", async () => {
    const bl = (await tool(edit, "read_page", { page_id: "trip", format: "blocks" })).out.blocks;
    const up = await tool(edit, "update_block", { page_id: "trip", block_id: bl[4].id, markdown: "+ Ideas for **day 2**" });
    expect(up.out.block_ids[0]).toBe(bl[4].id);
    expect(blocksToMarkdown((await get("trip")).blocks)).toContain("+ Ideas for **day 2**\n  Beach day");
    await tool(edit, "delete_blocks", { page_id: "trip", block_ids: [bl[1].id] });
    await tool(edit, "move_blocks", { page_id: "trip", block_ids: [bl[2].id], to_page_id: "work" });
    expect(blocksToMarkdown((await get("trip")).blocks)).not.toMatch(/Pack|book flights/);
    expect(blocksToMarkdown((await get("work")).blocks)).toBe("Quarterly server costs\n\n- [ ] book flights");
    expect((await tool(edit, "update_block", { page_id: "trip", block_id: "nope", markdown: "x" })).error).toMatch(/no block "nope"/);
  });

  it("set_task, update_page (title, move, whole content keeping unknown blocks), trash and restore", async () => {
    const t = (await tool(edit, "list_tasks", {})).out.tasks.find((x: any) => x.text === "book flights");
    await tool(edit, "set_task", { page_id: t.page_id, block_id: t.block_id, done: true });
    expect((await get("trip")).blocks[2].props.checked).toBe(true);

    await put(page("work", { title: "Work notes", blocks: [...markdownToBlocks("Intro"), { id: "fc1", type: "flowchart", props: { scene: "{}" }, children: [] }] }));
    const md = (await tool(edit, "read_page", { page_id: "work" })).out.markdown;
    expect(md).toBe('Intro\n\n<block id="fc1" type="flowchart"/>');
    await tool(edit, "update_page", { page_id: "work", title: "Work", parent_id: "trip", content_markdown: md.replace("Intro", "New intro") });
    const w = await get("work");
    expect(w).toMatchObject({ title: "Work", parentId: "trip" });
    expect(w.blocks[1]).toEqual({ id: "fc1", type: "flowchart", props: { scene: "{}" }, children: [] });
    expect((await tool(edit, "update_page", { page_id: "trip", parent_id: "food" })).error).toMatch(/inside itself/);

    expect((await tool(edit, "trash_page", { page_id: "trip" })).out.moved_to_trash).toBe(3);
    expect((await get("food")).deletedAt).toBeTruthy();
    expect((await tool(edit, "read_page", { page_id: "food" })).error).toBeNull(); // reading the trash is fine
    expect((await tool(edit, "add_blocks", { page_id: "food", markdown: "x" })).error).toMatch(/in the trash/);
    await tool(edit, "trash_page", { page_id: "trip", restore: true });
    expect((await get("food")).deletedAt).toBeNull();
  });

  it("an edit made at the same moment on a device is kept: the change is applied to the newest copy", async () => {
    const before = await cloud.pull("u1", { cursor: 0 });
    const rev = before.find((r) => r.id === "work")!.rev;
    // A device saves first…
    await cloud.push("u1", { id: "work", data: page("work", { title: "Work notes", blocks: markdownToBlocks("Quarterly server costs\n\nFrom the phone") }), baseRev: rev });
    // …then the AI adds a line, starting from what it read before.
    await tool(edit, "add_blocks", { page_id: "work", markdown: "From Claude" });
    expect(blocksToMarkdown((await get("work")).blocks)).toBe("Quarterly server costs\n\nFrom the phone\n\nFrom Claude");
  });

  it("notes when a connection was last used", async () => {
    await tool(edit, "search", { query: "trip" });
    const [c] = await mcp.list("u1");
    expect(c).toMatchObject({ lastTool: "search", calls: 1 });
    expect(c.lastUsedAt).toBeGreaterThan(0);
  });
});

describe("forgiving", () => {
  it("finds the secret in a whole address, a Bearer header, quotes or URL-encoding", async () => {
    const { secret } = await mcp.create("u1", { name: "Cursor" });
    for (const raw of [secret, `Bearer ${secret}`, `"${secret}"`, ` ${secret}\n`, `https://dovli.in/api/mcp/${secret}/`, `https://dovli.in/api/mcp/${secret}/mcp`, encodeURIComponent(`Bearer ${secret}`)]) {
      expect(findSecret(raw), raw).toBe(secret);
      expect((await mcp.resolve(raw))?.name, raw).toBe("Cursor");
    }
    for (const raw of [null, "", "dvl_short", "Bearer nothing", 42]) expect(findSecret(raw)).toBeNull();
  });

  it("knows a tool by other spellings, and lists the tools when it doesn't", async () => {
    for (const n of ["read_page", "dovli_read_page", "mcp__dovli__read_page", "readPage", "Read-Page", " dovli.read_page "]) expect(toolNamed(n)?.name, n).toBe("read_page");
    expect(toolNamed("nope")).toBeUndefined();
    expect((await tool(edit, "dovli_search", { q: "sushi" })).out.results[0].id).toBe("food");
    expect((await tool(edit, "fly")).error).toMatch(/no tool called "fly". The tools are: get_overview, list_pages/);
  });

  it("takes arguments in camelCase, other names, other types and as a JSON string", async () => {
    const t = TOOLS.find((x) => x.name === "move_blocks")!;
    expect(normalizeArgs(t, { pageId: "trip", blockIds: "a, b c", toPageId: "work", position: "Below", blockId: "x", junk: 1 })).toEqual({ page_id: "trip", block_ids: ["a, b c"], to_page_id: "work", position: "after", block_id: "x" });
    expect(normalizeArgs(t, { page_id: "trip", block_ids: '["a","b"]' }).block_ids).toEqual(["a", "b"]);
    expect(normalizeArgs(TOOLS.find((x) => x.name === "delete_blocks")!, { page_id: "trip", block_id: "a" })).toEqual({ page_id: "trip", block_ids: ["a"] });
    expect(normalizeArgs(TOOLS.find((x) => x.name === "set_task")!, '{"page_id":"trip","block_id":"t","done":"yes"}')).toEqual({ page_id: "trip", block_id: "t", done: true });
    expect(normalizeArgs(TOOLS.find((x) => x.name === "list_pages")!, { where: "Favourites", limit: "5" })).toEqual({ where: "favorites", limit: 5 });
    expect(normalizeArgs(TOOLS.find((x) => x.name === "update_page")!, { id: "trip", markdown: "x", parent_id: null })).toEqual({ page_id: "trip", content_markdown: "x", parent_id: null });
    expect(normalizeArgs(TOOLS.find((x) => x.name === "read_page")!, { page_id: { id: "trip" }, format: "json" })).toEqual({ page_id: "trip", format: "blocks" });
    const r: any = await rpc(edit, "tools/call", { name: "read_page", arguments: JSON.stringify({ pageId: "trip" }) });
    expect(r.result.structuredContent.title).toBe("Japan trip");
  });

  it("finds a page by its title or a Dovli link, and suggests pages when it can't", async () => {
    expect((await tool(edit, "read_page", { page_id: "Japan trip" })).out.id).toBe("trip");
    expect((await tool(edit, "read_page", { page_id: "[[food list]]" })).out.id).toBe("food");
    expect((await tool(edit, "read_page", { page_id: "dovli:page/work" })).out.id).toBe("work");
    expect((await tool(edit, "add_blocks", { page: "Work notes", text: "Added by title" })).error).toBeNull();
    expect(blocksToMarkdown((await get("work")).blocks)).toContain("Added by title");
    expect((await tool(edit, "read_page", { page_id: "trip-x" })).error).toMatch(/no page with id "trip-x"/);
    expect((await tool(edit, "read_page", { page_id: "food" })).error).toBeNull();
    expect((await tool(edit, "read_page", { page_id: "list" })).error).toMatch(/Did you mean "Food list" \(food\)/);
    // A title only counts inside what the connection can reach.
    const some = (await mcp.create("u1", { scope: "pages", pageIds: ["trip"] })).connection;
    expect((await tool(some, "read_page", { page_id: "Work notes" })).error).toMatch(/no page/);
  });

  it("finds a block by its exact text when given that instead of an id", async () => {
    expect((await tool(edit, "set_task", { page_id: "trip", block_id: "book flights", done: true })).error).toBeNull();
    expect((await get("trip")).blocks[2].props.checked).toBe(true);
    expect((await tool(edit, "delete_blocks", { page_id: "trip", block_ids: ["- [x] get visa"] })).out.deleted).toBe(1);
    expect(blocksToMarkdown((await get("trip")).blocks)).not.toContain("get visa");
    await tool(edit, "add_blocks", { page_id: "work", markdown: "same\n\nsame" });
    expect((await tool(edit, "delete_blocks", { page_id: "work", block_ids: ["same"] })).error).toMatch(/More than one block says "same"/);
    const bl = (await tool(edit, "read_page", { page_id: "work", format: "blocks" })).out.blocks;
    expect((await tool(edit, "delete_blocks", { page_id: "work", block_ids: `${bl[1].id}, ${bl[2].id}` })).out.deleted).toBe(2);
    expect(blocksToMarkdown((await get("work")).blocks)).toBe("Quarterly server costs");
  });

  it("moves a block given by its text to another page without leaving a copy behind", async () => {
    const r = await tool(edit, "move_blocks", { page_id: "trip", block_ids: "Pack the bags.", to_page_id: "work" });
    expect(r.error).toBeNull();
    expect(blocksToMarkdown((await get("trip")).blocks)).not.toContain("Pack");
    expect(blocksToMarkdown((await get("work")).blocks)).toBe("Quarterly server costs\n\nPack the **bags**.");
    const bl = (await tool(edit, "read_page", { page_id: "work", format: "blocks" })).out.blocks;
    expect((await tool(edit, "move_blocks", { page_id: "work", block_ids: [bl[0].id], position: "after", block_id: bl[0].id })).error).toMatch(/next to or inside itself/);
  });

  it("deleting a block and a block inside it together works", async () => {
    const bl = (await tool(edit, "read_page", { page_id: "trip", format: "blocks" })).out.blocks;
    const r = await tool(edit, "delete_blocks", { page_id: "trip", block_ids: [bl[4].id, bl[5].id] });
    expect(r.error).toBeNull();
    expect(blocksToMarkdown((await get("trip")).blocks)).not.toMatch(/Ideas|Beach/);
  });

  it("answers messages without jsonrpc, newer protocol versions and the small extra methods", async () => {
    const init: any = await mcp.handle(edit, { id: 7, method: "initialize", params: { protocolVersion: "2025-11-25" } });
    expect(init.result.protocolVersion).toBe("2025-11-25");
    const future: any = await rpc(edit, "initialize", { protocolVersion: "2099-01-01" });
    expect(future.result.protocolVersion).toBe("2025-11-25");
    expect(((await rpc(edit, "resources/templates/list")) as any).result).toEqual({ resourceTemplates: [] });
    expect(((await rpc(edit, "logging/setLevel", { level: "info" })) as any).result).toEqual({});
    expect(((await mcp.handle(edit, { jsonrpc: "1.0", id: 1, method: "ping" })) as any).error.code).toBe(-32600);
  });

  it("moving a page inside one given by its title stores that page's id, not the title", async () => {
    expect((await tool(edit, "update_page", { page_id: "work", parent_id: "Japan trip" })).error).toBeNull();
    expect((await get("work")).parentId).toBe("trip");
    expect((await tool(edit, "update_page", { page_id: "work", parent: "dovli:page/food" })).error).toBeNull();
    expect((await get("work")).parentId).toBe("food");
    expect((await tool(edit, "update_page", { page_id: "work", parent_id: null })).error).toBeNull();
    expect((await get("work")).parentId).toBeNull();
  });

  it("words of a phrase are never matched to other blocks' text", async () => {
    await tool(edit, "add_blocks", { page_id: "work", markdown: "Milk\n\nEggs" });
    expect((await tool(edit, "delete_blocks", { page_id: "work", block_ids: ["Milk Eggs"] })).error).toMatch(/no block "Milk Eggs"/);
    expect(blocksToMarkdown((await get("work")).blocks)).toBe("Quarterly server costs\n\nMilk\n\nEggs");
  });

  it("\"under\" a block means inside it", async () => {
    const bl = (await tool(edit, "read_page", { page_id: "trip", format: "blocks" })).out.blocks;
    await tool(edit, "add_blocks", { page_id: "trip", markdown: "Hot springs", position: "under", block_id: bl[4].id });
    expect(blocksToMarkdown((await get("trip")).blocks)).toContain("+ Ideas\n  Beach day\n\n  Hot springs");
  });

  it("moving a block together with a block inside it moves it once", async () => {
    const bl = (await tool(edit, "read_page", { page_id: "trip", format: "blocks" })).out.blocks;
    const toggle = bl[4].id;
    const child = bl[5].id;
    const r = await tool(edit, "move_blocks", { page_id: "trip", block_ids: [toggle, child], to_page_id: "work" });
    expect(r.out.block_ids).toEqual([toggle]);
    const ids = (await tool(edit, "read_page", { page_id: "work", format: "blocks" })).out.blocks.map((b: any) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(blocksToMarkdown((await get("work")).blocks)).toBe("Quarterly server costs\n\n+ Ideas\n  Beach day");
    expect(blocksToMarkdown((await get("trip")).blocks)).not.toContain("Ideas");
    const again = (await tool(edit, "read_page", { page_id: "work", format: "blocks" })).out.blocks;
    expect((await tool(edit, "move_blocks", { page_id: "work", block_ids: [again[1].id, again[2].id], position: "start" })).error).toBeNull();
    expect(blocksToMarkdown((await get("work")).blocks)).toBe("+ Ideas\n  Beach day\n\nQuarterly server costs");
  });

  it("says which block it changed by its id, also when it was given by text", async () => {
    const bl = (await tool(edit, "read_page", { page_id: "trip", format: "blocks" })).out.blocks;
    expect((await tool(edit, "set_task", { page_id: "trip", block_id: "book flights", done: true })).out.block_id).toBe(bl[2].id);
    expect((await tool(edit, "update_block", { page_id: "trip", block_id: "Pack the bags.", markdown: "Pack light." })).out.updated).toBe(bl[1].id);
  });

  it("serves the same bridge it keeps in the repo", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "../../../../..");
    expect(fs.readFileSync(path.join(root, "apps/web/public/dovli-mcp.mjs"), "utf8")).toBe(fs.readFileSync(path.join(root, "dovli-mcp.mjs"), "utf8"));
  });

  it("records the tool's real name when it was called by another spelling", async () => {
    await tool(edit, "dovli_search", { query: "trip" });
    expect((await mcp.list("u1"))[0]).toMatchObject({ lastTool: "search" });
  });
});

describe("for the browser extension", () => {
  it("gives a new page the style it's asked for, and ignores styles that don't exist", async () => {
    const styled = await tool(edit, "create_page", { title: "Pancakes", style: "cafe" });
    expect((await get(styled.out.page_id)).style).toBe("cafe");
    const odd = await tool(edit, "create_page", { title: "Odd", style: "no-such-style" });
    expect((await get(odd.out.page_id)).style).toBeUndefined();
  });
  it("follows one page cheaply: changed only when that page was saved", async () => {
    const start = await mcp.follow(edit, "trip", null);
    expect(start.changed).toBe(false);
    expect((await mcp.follow(edit, "trip", start.cursor)).changed).toBe(false);

    await tool(edit, "add_blocks", { page_id: "work", markdown: "Another line" });
    const other = await mcp.follow(edit, "trip", start.cursor);
    expect(other).toMatchObject({ changed: false });
    expect(other.cursor).toBeGreaterThan(start.cursor);

    await tool(edit, "add_blocks", { page_id: "trip", markdown: "Book the hotel" });
    expect((await mcp.follow(edit, "trip", other.cursor)).changed).toBe(true);
  });
});
