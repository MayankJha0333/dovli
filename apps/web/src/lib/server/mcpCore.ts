// Dovli's MCP server: lets AI apps (Claude Desktop, Claude Code, Codex, ChatGPT and others that
// speak the Model Context Protocol) read and write a person's pages, the way Craft's "MCP
// Connections" do. No Firebase in here, so it can be tested on its own (mcpCore.test.ts).
//
// Connections, as in Craft: each has a name, what it can reach (all pages, or chosen pages and
// everything inside them), what it may do (view, or view and edit), and can be switched off.
// Each gets its own secret address (…/api/mcp/dvl_…); only a hash of the secret is kept, so it is
// shown once and can be replaced. At most 10 per person (Craft's limit too).
//
//   users/{uid}/mcp/{id}      the connection: name, scope, permission, on/off, last used
//   mcpTokens/{sha256}        which person and connection a secret belongs to
//
// Tools are split into reading and writing (like Craft's craft_read / craft_write), with MCP
// annotations, so an AI app can be allowed to read freely and ask before it writes. Read-only
// connections don't list the writing tools at all. Pages travel as Markdown (see
// @dovli/core markdown.ts); blocks have ids, so an AI can change one part of a page without
// rewriting the rest. Every change goes through the same save as a device (cloud.push), so it
// syncs to the person's browsers and phones like any other edit.

import { createHash, randomBytes } from "node:crypto";
import {
  blocksToMarkdown,
  blockToMarkdown,
  displayTitle,
  flattenBlocks,
  inlineText,
  markdownToBlocks,
  searchPages,
  todoItems,
  type Page,
} from "@dovli/core";
import { getStyle } from "@dovli/theme";
import { CloudError, isId, type CloudStore, type Doc, type createCloud } from "./cloudCore";

type Cloud = ReturnType<typeof createCloud>;

export const MCP_LIMIT = 10;
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "dovli", title: "Dovli", version: "1.0.0" };
const MAX_MARKDOWN = 200_000;
const MAX_READ = 120_000;

export type Permission = "view" | "edit";
export type Scope = "all" | "pages";

/** Which AI app a connection is for (only used to show the right icon and setup steps). */
export type AppKind = "claude-desktop" | "claude-code" | "codex" | "other";
const APPS: AppKind[] = ["claude-desktop", "claude-code", "codex", "other"];

export interface Connection {
  id: string;
  uid: string;
  name: string;
  app: AppKind;
  scope: Scope;
  /** For scope "pages": the pages it can reach (and everything inside them). */
  pageIds: string[];
  permission: Permission;
  enabled: boolean;
  /** The secret's last 4 characters, so the person can tell addresses apart. */
  hint: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  lastTool: string | null;
  calls: number;
}

export interface ConnectionInput {
  name?: unknown;
  app?: unknown;
  scope?: unknown;
  pageIds?: unknown;
  permission?: unknown;
  enabled?: unknown;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const newSecret = () => `dvl_${randomBytes(24).toString("base64url")}`;
const newId = (n = 10) => randomBytes(16).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, n).padEnd(n, "x");
const connPath = (uid: string, id: string) => `users/${uid}/mcp/${id}`;
const tokenPath = (hash: string) => `mcpTokens/${hash}`;
const SECRET = /^dvl_[A-Za-z0-9_-]{20,64}$/;

/** The secret in whatever was sent: a whole address, "Bearer …", quotes, URL-encoding. */
export function findSecret(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    /* not URL-encoded */
  }
  const m = s.match(/dvl_[A-Za-z0-9_-]{20,64}/);
  return m && SECRET.test(m[0]) ? m[0] : null;
}

function clean(input: ConnectionInput, prev?: Connection) {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : prev?.name;
  const scope: Scope = input.scope === "pages" ? "pages" : input.scope === "all" ? "all" : (prev?.scope ?? "all");
  const pageIds = Array.isArray(input.pageIds) ? [...new Set(input.pageIds.filter(isId))].slice(0, 50) : (prev?.pageIds ?? []);
  const permission: Permission = input.permission === "view" ? "view" : input.permission === "edit" ? "edit" : (prev?.permission ?? "edit");
  const enabled = typeof input.enabled === "boolean" ? input.enabled : (prev?.enabled ?? true);
  const app: AppKind = APPS.includes(input.app as AppKind) ? (input.app as AppKind) : (prev?.app ?? "other");
  if (scope === "pages" && !pageIds.length) throw new CloudError("bad_request", "Pick at least one page for this connection.", 400);
  return { name: name || "AI app", app, scope, pageIds: scope === "pages" ? pageIds : [], permission, enabled };
}

// ------------------------------------------------------------------ the tools

type Args = Record<string, any>;
interface Tool {
  name: string;
  title: string;
  description: string;
  write: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  inputSchema: Doc;
}

const str = (description: string, extra: Doc = {}) => ({ type: "string", description, ...extra });
const pageIdArg = str("The page's id (from get_overview, list_pages or search).");

export const TOOLS: Tool[] = [
  {
    name: "get_overview",
    title: "Overview",
    write: false,
    description:
      "Start here. Who this is, what this connection can reach and do, how many pages there are, the top of the page tree, favourites and recently edited pages, all with ids.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_pages",
    title: "List pages",
    write: false,
    description: "List pages: the top level, the pages inside one page (parent_id), favourites, recently edited, or the trash. Newest edits first for 'recent'.",
    inputSchema: {
      type: "object",
      properties: {
        parent_id: str("List the pages inside this page. Leave out for the top level."),
        where: str("Which pages.", { enum: ["tree", "favorites", "recent", "trash"], default: "tree" }),
        limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search",
    title: "Search pages",
    write: false,
    description: "Find pages by words in their title or text (or a #tag). Returns each page with the matching lines and their block ids.",
    inputSchema: {
      type: "object",
      properties: { query: str("Words to find, e.g. 'launch plan' or '#ideas'."), limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "read_page",
    title: "Read a page",
    write: false,
    description:
      "Read a page. format 'markdown' (default) gives the whole page as Dovli Markdown. format 'blocks' lists every block with its id, type, depth and text: use it before update_block, delete_blocks, move_blocks or add_blocks with a position.",
    inputSchema: {
      type: "object",
      properties: { page_id: pageIdArg, format: str("How to return the content.", { enum: ["markdown", "blocks"], default: "markdown" }) },
      required: ["page_id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_tasks",
    title: "List to-dos",
    write: false,
    description: "List to-do items, across every page this connection can reach or in one page. Each comes with its page and block id (for set_task).",
    inputSchema: {
      type: "object",
      properties: {
        page_id: str("Only the to-dos in this page (and the pages inside it)."),
        status: str("Which to-dos.", { enum: ["open", "done", "all"], default: "open" }),
        limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_page",
    title: "Create a page",
    write: true,
    description: "Create a new page, optionally inside another page, with its content written in Dovli Markdown. Returns the new page's id.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("The page title."),
        markdown: str("The page content, in Dovli Markdown (see the server instructions). Optional."),
        parent_id: str("Put the new page inside this page. Leave out for the top level."),
        icon: str("An emoji for the page icon, e.g. '🚀'. Optional."),
        style: str("A page style id (paper, cafe, graphite, notebook…). Optional."),
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "add_blocks",
    title: "Add to a page",
    write: true,
    description:
      "Add content (Dovli Markdown) to a page: at the end (default), at the start, after or before a block, or inside a block (as its children, e.g. under a toggle). Returns the new block ids.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: pageIdArg,
        markdown: str("What to add, in Dovli Markdown."),
        position: str("Where it goes.", { enum: ["end", "start", "after", "before", "inside"], default: "end" }),
        block_id: str("For after, before and inside: the block it goes next to or inside."),
      },
      required: ["page_id", "markdown"],
      additionalProperties: false,
    },
  },
  {
    name: "update_block",
    title: "Change a block",
    write: true,
    description:
      "Rewrite one block with new Dovli Markdown. The first block of the Markdown replaces it (keeping its id and, unless you give new ones, the blocks inside it); any more blocks are added right after it.",
    inputSchema: {
      type: "object",
      properties: { page_id: pageIdArg, block_id: str("The block to change (from read_page with format 'blocks')."), markdown: str("Its new content, in Dovli Markdown.") },
      required: ["page_id", "block_id", "markdown"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_blocks",
    title: "Delete blocks",
    write: true,
    destructive: true,
    description: "Delete blocks from a page, with the blocks inside them. This can't be undone from here, so delete only what the person asked for.",
    inputSchema: {
      type: "object",
      properties: { page_id: pageIdArg, block_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 200 } },
      required: ["page_id", "block_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "move_blocks",
    title: "Move blocks",
    write: true,
    description: "Move blocks within a page or to another page: to the end (default) or start, or after, before or inside a block of the target page.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: pageIdArg,
        block_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 200 },
        to_page_id: str("The page to move them to. Leave out to move within the same page."),
        position: str("Where they go.", { enum: ["end", "start", "after", "before", "inside"], default: "end" }),
        block_id: str("For after, before and inside: the block in the target page."),
      },
      required: ["page_id", "block_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "update_page",
    title: "Change a page",
    write: true,
    description:
      "Change a page's title, icon or favourite star, move it inside another page (parent_id, or null for the top level), or replace its whole content with new Dovli Markdown (content_markdown). Blocks named <block id=…/> in the Markdown are kept as they are.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: pageIdArg,
        title: str("New title."),
        icon: str("New icon: one emoji."),
        favorite: { type: "boolean", description: "Star or unstar the page." },
        parent_id: { type: ["string", "null"], description: "Move the page inside this page; null for the top level." },
        content_markdown: str("Replace the whole page content with this Dovli Markdown."),
      },
      required: ["page_id"],
      additionalProperties: false,
    },
  },
  {
    name: "set_task",
    title: "Tick a to-do",
    write: true,
    idempotent: true,
    description: "Mark a to-do as done or not done.",
    inputSchema: {
      type: "object",
      properties: { page_id: pageIdArg, block_id: str("The to-do's block id (from list_tasks or read_page)."), done: { type: "boolean" } },
      required: ["page_id", "block_id", "done"],
      additionalProperties: false,
    },
  },
  {
    name: "trash_page",
    title: "Move a page to the trash",
    write: true,
    destructive: true,
    description: "Move a page (and the pages inside it) to the trash, where it stays for 30 days; or bring it back with restore: true.",
    inputSchema: {
      type: "object",
      properties: { page_id: pageIdArg, restore: { type: "boolean", default: false } },
      required: ["page_id"],
      additionalProperties: false,
    },
  },
];

// ------------------------------------------------------------------ forgiving calls
// AI apps prefix tool names (mcp__dovli__readPage) and send arguments in other shapes than the
// schema (pageId, "true", one id for a list, "below"); they're mapped to what the tools expect.

const snake = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const unquote = (s: string) => s.trim().replace(/^["'`]+|["'`]+$/g, "");
const isPlain = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const parseJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

export function toolNamed(raw: unknown): Tool | undefined {
  if (typeof raw !== "string") return undefined;
  const n = snake(raw.trim())
    .replace(/[-.\s/:]+/g, "_")
    .replace(/^(mcp_+)?(dovli_+)?/, "");
  return TOOLS.find((t) => t.name === n);
}

const SAME_AS: Record<string, string[]> = {
  page_id: ["id", "page", "pageid", "page_ref"],
  block_id: ["block", "target_block_id", "anchor_block_id", "anchor_id"],
  block_ids: ["ids", "blocks"],
  to_page_id: ["target_page_id", "destination_page_id", "to_page", "to"],
  parent_id: ["parent", "parent_page_id", "inside"],
  markdown: ["content", "text", "body", "md", "content_markdown"],
  content_markdown: ["markdown", "content", "body", "md"],
  query: ["q", "text", "search", "words", "term"],
  title: ["name"],
  icon: ["emoji", "mark"],
  done: ["checked", "completed", "complete"],
  favorite: ["favourite", "starred", "star"],
};

const ENUM_SAME_AS: Record<string, Record<string, string>> = {
  position: { below: "after", next: "after", under: "inside", above: "before", top: "start", beginning: "start", first: "start", bottom: "end", last: "end", append: "end", prepend: "start", into: "inside", in: "inside", child: "inside", children: "inside" },
  format: { md: "markdown", text: "markdown", json: "blocks", ids: "blocks", block: "blocks" },
  where: { top: "tree", root: "tree", all: "tree", favourites: "favorites", starred: "favorites", recently_edited: "recent", latest: "recent", deleted: "trash", bin: "trash" },
  status: { todo: "open", pending: "open", unchecked: "open", incomplete: "open", undone: "open", checked: "done", complete: "done", completed: "done", finished: "done", any: "all", both: "all" },
};

function coerce(schema: Doc | undefined, key: string, v: unknown): unknown {
  const type = Array.isArray(schema?.type) ? schema!.type.find((t: string) => t !== "null") : schema?.type;
  if (v === null && Array.isArray(schema?.type) && schema!.type.includes("null")) return null;
  if (type === "boolean") {
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "yes", "1", "on", "done", "checked"].includes(s)) return true;
      if (["false", "no", "0", "off", "open", "unchecked"].includes(s)) return false;
    }
    if (typeof v === "number") return v !== 0;
    return v;
  }
  if (type === "integer" || type === "number") return typeof v === "string" && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : v;
  if (type === "array") {
    if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x.trim() : isPlain(x) && typeof x.id === "string" ? x.id : x));
    if (typeof v === "string") {
      const s = v.trim();
      const list = s.startsWith("[") ? parseJson(s) : undefined;
      return Array.isArray(list) ? list : s ? [s] : [];
    }
    return v;
  }
  if (type === "string") {
    if (typeof v === "number") return String(v);
    if (isPlain(v) && typeof v.id === "string" && key.endsWith("_id")) return v.id;
    if (typeof v !== "string") return v;
    const s = key.endsWith("_id") ? unquote(v) : v;
    if (schema?.enum) {
      const low = s.trim().toLowerCase().replace(/[\s-]+/g, "_");
      return schema.enum.includes(low) ? low : (ENUM_SAME_AS[key]?.[low] ?? s);
    }
    return s;
  }
  return v;
}

/** Arguments under the tool's own names and types; anything it doesn't take is left out. */
export function normalizeArgs(tool: Tool, raw: unknown): Args {
  const given = typeof raw === "string" ? parseJson(raw) : raw;
  const src: Args = {};
  for (const [k, v] of Object.entries(isPlain(given) ? given : {})) src[snake(k)] = v;
  const props: Record<string, Doc> = tool.inputSchema.properties ?? {};
  const out: Args = {};
  for (const key of Object.keys(props)) {
    const from = [key, ...(SAME_AS[key] ?? [])].find((k) => src[k] !== undefined && !(k !== key && props[k]));
    if (from !== undefined) out[key] = coerce(props[key], key, src[from]);
  }
  if (out.block_ids === undefined && props.block_ids && !props.block_id && src.block_id !== undefined) out.block_ids = coerce(props.block_ids, "block_ids", src.block_id);
  return out;
}

export const INSTRUCTIONS = `Dovli is a notes app. Its pages hold blocks (paragraphs, headings, lists, to-dos, tables…) and can sit inside other pages. You reach the person's pages through these tools.

How to work:
- Start with get_overview, or search for words. Use ids from the results; never guess an id.
- read_page gives a page as Markdown; read_page with format "blocks" gives every block with its id, for precise changes.
- Prefer small changes (add_blocks, update_block) over replacing a whole page. Change only what the person asked for.
- Only use delete_blocks and trash_page when the person asked for it.

Dovli Markdown (what read_page returns and what the writing tools accept):
# Heading 1 / ## Heading 2 / ### Heading 3
Paragraphs separated by a blank line. **bold** *italic* ~~strike~~ \`code\` <u>underline</u> ==highlight== [link](https://…) <br> for a line break.
- bullet   1. numbered   - [ ] to-do   - [x] done to-do   + toggle (its content indented by 2 spaces under it)
Indent any line by 2 spaces to put it inside the block above it.
> quote      --- divider      \`\`\`lang code \`\`\`      | a | b | tables (with a | --- | --- | row)
![caption](https://…) picture
<callout tone="note|tip|warning|danger" emoji="💡">text</callout> (or > [!TIP] text)
<small>small grey text</small>
\`\`\`mermaid with a flowchart (flowchart TD …) becomes a real, editable Dovli flowchart. Use it for any flowchart or diagram.
<embed url="https://…"/> a link preview card (YouTube, a website…)
[Page title](dovli:page/PAGE_ID) or [[Page title]] links to another Dovli page; <page id="PAGE_ID"/> shows a page inside this one as a card.
<block id="…" type="…"/> stands for a block Markdown can't hold (a whiteboard sketch, a data table, a file). Leave these lines as they are when you write a page back, and the blocks are kept.`;

// ------------------------------------------------------------------ the server

interface Loaded {
  pages: Record<string, Page>;
  revs: Record<string, number>;
}

export function createMcp(deps: { store: CloudStore; cloud: Cloud; now?: () => Date; profile?: (uid: string) => Promise<{ name?: string | null; email?: string | null }> }) {
  const { store, cloud } = deps;
  const now = deps.now ?? (() => new Date());
  const rate = new Map<string, number[]>();

  // ---------------------------------------------------------------- connections

  async function list(uid: string): Promise<Connection[]> {
    const docs = (await store.list(`users/${uid}/mcp`, 50)) as Connection[];
    return docs.sort((a, b) => a.createdAt - b.createdAt);
  }

  async function create(uid: string, input: ConnectionInput): Promise<{ connection: Connection; secret: string }> {
    if (!isId(uid)) throw new CloudError("bad_request", "That account id doesn't look right.", 400);
    const existing = await list(uid);
    if (existing.length >= MCP_LIMIT) throw new CloudError("limit", `You can have up to ${MCP_LIMIT} connections. Delete one you don't use first.`, 409);
    const fields = clean(input);
    const secret = newSecret();
    const t = now().getTime();
    const connection: Connection = { id: newId(), uid, ...fields, hint: secret.slice(-4), createdAt: t, updatedAt: t, lastUsedAt: null, lastTool: null, calls: 0 };
    await store.transaction(async (tx) => {
      tx.set(connPath(uid, connection.id), { ...connection, tokenHash: sha(secret) });
      tx.set(tokenPath(sha(secret)), { uid, connectionId: connection.id, createdAt: t });
    });
    return { connection, secret };
  }

  async function update(uid: string, id: string, input: ConnectionInput): Promise<Connection> {
    if (!isId(id)) throw new CloudError("bad_request", "That connection id doesn't look right.", 400);
    return store.transaction(async (tx) => {
      const cur = (await tx.get(connPath(uid, id))) as (Connection & { tokenHash: string }) | undefined;
      if (!cur) throw new CloudError("not_found", "That connection doesn't exist any more.", 404);
      const next = { ...cur, ...clean(input, cur), updatedAt: now().getTime() };
      tx.set(connPath(uid, id), next);
      const { tokenHash, ...pub } = next;
      return pub;
    });
  }

  /** A new secret address for a connection; the old one stops working at once. */
  async function rotate(uid: string, id: string): Promise<{ connection: Connection; secret: string }> {
    if (!isId(id)) throw new CloudError("bad_request", "That connection id doesn't look right.", 400);
    const secret = newSecret();
    return store.transaction(async (tx) => {
      const cur = (await tx.get(connPath(uid, id))) as (Connection & { tokenHash: string }) | undefined;
      if (!cur) throw new CloudError("not_found", "That connection doesn't exist any more.", 404);
      const next = { ...cur, hint: secret.slice(-4), tokenHash: sha(secret), updatedAt: now().getTime() };
      tx.delete(tokenPath(cur.tokenHash));
      tx.set(tokenPath(sha(secret)), { uid, connectionId: id, createdAt: next.updatedAt });
      tx.set(connPath(uid, id), next);
      const { tokenHash, ...pub } = next;
      return { connection: pub, secret };
    });
  }

  async function remove(uid: string, id: string): Promise<void> {
    if (!isId(id)) throw new CloudError("bad_request", "That connection id doesn't look right.", 400);
    await store.transaction(async (tx) => {
      const cur = await tx.get(connPath(uid, id));
      if (!cur) return;
      tx.delete(tokenPath(cur.tokenHash));
      tx.delete(connPath(uid, id));
    });
  }

  /** Everything for an account (when it is deleted). */
  async function removeAll(uid: string) {
    for (const c of await list(uid)) await remove(uid, c.id);
  }

  /** The connection a secret belongs to, if it exists and is switched on. */
  async function resolve(raw: string | null | undefined): Promise<Connection | null> {
    const secret = findSecret(raw);
    if (!secret) return null;
    const hash = sha(secret);
    return store.transaction(async (tx) => {
      const tok = await tx.get(tokenPath(hash));
      if (!tok) return null;
      const conn = (await tx.get(connPath(tok.uid, tok.connectionId))) as (Connection & { tokenHash: string }) | undefined;
      if (!conn || conn.tokenHash !== hash) return null;
      const { tokenHash, ...pub } = conn;
      return pub;
    });
  }

  async function noteUse(c: Connection, tool: string) {
    await store.transaction(async (tx) => {
      const cur = await tx.get(connPath(c.uid, c.id));
      if (!cur) return;
      tx.set(connPath(c.uid, c.id), { lastUsedAt: now().getTime(), lastTool: tool, calls: (cur.calls ?? 0) + 1 }, true);
    });
  }

  // ---------------------------------------------------------------- pages

  async function load(uid: string): Promise<Loaded> {
    const pages: Record<string, Page> = {};
    const revs: Record<string, number> = {};
    let cursor = 0;
    for (let round = 0; round < 40; round++) {
      const rows = await cloud.pull(uid, { cursor, limit: 500 });
      for (const r of rows) {
        revs[r.id] = r.rev;
        if (r.purged || !r.data) delete pages[r.id];
        else pages[r.id] = r.data;
        cursor = Math.max(cursor, r.rev);
      }
      if (rows.length < 500) break;
    }
    return { pages, revs };
  }

  const ancestorsOf = (pages: Record<string, Page>, id: string) => {
    const out: string[] = [];
    let cur = pages[id]?.parentId;
    while (cur && pages[cur] && !out.includes(cur)) {
      out.push(cur);
      cur = pages[cur].parentId;
    }
    return out;
  };
  const reach = (c: Connection, pages: Record<string, Page>, id: string) => c.scope === "all" || c.pageIds.includes(id) || ancestorsOf(pages, id).some((a) => c.pageIds.includes(a));
  const visible = (c: Connection, data: Loaded) => Object.values(data.pages).filter((p) => reach(c, data.pages, p.id));

  /** A page id from an id, a Dovli link, or a title that only one reachable page has. */
  function pageRef(c: Connection, data: Loaded, raw: unknown): unknown {
    if (typeof raw !== "string" || data.pages[raw]) return raw;
    const s = raw.trim();
    const linked = s.match(/(?:dovli:page\/|[?&]page=|\/p\/)([A-Za-z0-9_-]{1,128})/)?.[1];
    if (linked && data.pages[linked]) return linked;
    const title = s.replace(/^\[\[|\]\]$/g, "").trim().toLowerCase();
    const named = visible(c, data).filter((p) => !p.deletedAt && displayTitle(p).trim().toLowerCase() === title);
    return named.length === 1 ? named[0].id : s;
  }

  function page(c: Connection, data: Loaded, id: unknown, { trash = false } = {}): Page {
    if (typeof id === "string" && !data.pages[id]) id = pageRef(c, data, id);
    if (typeof id !== "string" || !id.trim()) throw new ToolError("Give a page_id (from get_overview, list_pages or search).");
    const p = isId(id) ? data.pages[id] : undefined;
    if (!p || !reach(c, data.pages, id)) {
      const words = id.toLowerCase();
      const like = visible(c, data)
        .filter((x) => !x.deletedAt && displayTitle(x).toLowerCase().includes(words))
        .slice(0, 5)
        .map((x) => `"${displayTitle(x)}" (${x.id})`);
      throw new ToolError(`There's no page with id "${id}" that this connection can reach.${like.length ? ` Did you mean ${like.join(", ")}?` : " Use search or get_overview for page ids."}`);
    }
    if (p.deletedAt && !trash) throw new ToolError(`"${displayTitle(p)}" is in the trash. Restore it first (trash_page with restore: true).`);
    return p;
  }

  const summary = (p: Page, pages: Record<string, Page>) => ({
    id: p.id,
    title: displayTitle(p),
    icon: p.mark,
    kind: p.kind === "board" ? "whiteboard" : "page",
    parent_id: p.parentId,
    pages_inside: Object.values(pages).filter((x) => x.parentId === p.id && !x.deletedAt).length,
    favorite: !!p.favorite,
    updated_at: new Date(p.updatedAt).toISOString(),
    ...(p.deletedAt ? { in_trash_since: new Date(p.deletedAt).toISOString() } : {}),
  });

  const pathOf = (p: Page, pages: Record<string, Page>) => [...ancestorsOf(pages, p.id)].reverse().map((id) => displayTitle(pages[id]));

  /** Save one page; if another device saved it meanwhile, re-read and apply the change again. */
  async function save(c: Connection, pageId: string, change: (p: Page, data: Loaded) => Page | null, data?: Loaded): Promise<Page> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const d = data && attempt === 0 ? data : await load(c.uid);
      const cur = d.pages[pageId] ?? null;
      const next = change(cur as Page, d);
      if (!next) throw new ToolError("Nothing to change.");
      const res = await cloud.push(c.uid, { id: pageId, data: { ...next, updatedAt: now().getTime() }, baseRev: cur ? (d.revs[pageId] ?? null) : null });
      if (res.ok) return next;
      if (res.tooBig) throw new ToolError("That would make the page too big to save. Split it into a few pages.");
    }
    throw new ToolError("The page kept changing while saving. Try again.");
  }

  const editable = (p: Page) => {
    if (p.kind !== "doc") throw new ToolError("That's a whiteboard. Only pages with text can be changed here.");
    return p.blocks ?? [];
  };

  const toBlocks = (md: unknown, data: Loaded, existing?: any[]) => {
    if (typeof md !== "string") throw new ToolError("Give the content as a Markdown string.");
    if (md.length > MAX_MARKDOWN) throw new ToolError(`That's too much at once (over ${MAX_MARKDOWN.toLocaleString("en")} characters). Add it in parts.`);
    const byTitle = new Map(Object.values(data.pages).filter((p) => !p.deletedAt).map((p) => [displayTitle(p).toLowerCase(), p] as const));
    const kept = new Map(flattenBlocks(existing).map(({ block }) => [block.id, block] as const));
    return markdownToBlocks(md, {
      existing: kept,
      findPage: (t) => {
        const p = byTitle.get(t.toLowerCase());
        return p ? { id: p.id, title: displayTitle(p) } : null;
      },
    });
  };

  const plain = (block: any) => (Array.isArray(block.content) ? inlineText(block.content) : typeof block.content === "string" ? block.content : "").trim().toLowerCase();

  /** Find a block anywhere in a tree, by id or by its exact text: the list it sits in and its index. */
  function locate(blocks: any[], id: unknown): { list: any[]; index: number; block: any } {
    if (typeof id !== "string" || !id.trim()) throw new ToolError("Give a block_id (from read_page with format 'blocks').");
    const all = flattenBlocks(blocks);
    const at = (x: (typeof all)[number]) => ({ list: x.parent, index: x.parent.indexOf(x.block), block: x.block });
    const byId = all.find((x) => x.block.id === id) ?? all.find((x) => x.block.id === unquote(id));
    if (byId) return at(byId);
    const said = id.trim().toLowerCase();
    const byText = all.filter((x) => plain(x.block) === said || blockToMarkdown(x.block).join("\n").trim().toLowerCase() === said);
    if (byText.length === 1) return at(byText[0]);
    throw new ToolError(
      byText.length > 1
        ? `More than one block says "${id}". Use its id from read_page with format 'blocks'.`
        : `There's no block "${id}" in that page. Read it again with format 'blocks' for the current ids.`,
    );
  }

  /**
   * Real ids for blocks given by id or text. "a, b" is one block's text first, then a list whose
   * parts must be ids: single words could match other blocks. Blocks inside listed ones go with them.
   */
  const blockIds = (blocks: any[], given: unknown[]): string[] => {
    const all = flattenBlocks(blocks);
    const ids = new Set(
      given.flatMap((raw) => {
        try {
          return [locate(blocks, raw).block.id as string];
        } catch (e) {
          const parts = typeof raw === "string" ? raw.split(/[\s,;]+/).filter(Boolean) : [];
          if (parts.length < 2 || !parts.every((part) => all.some((x) => x.block.id === part))) throw e;
          return parts;
        }
      }),
    );
    const inside = new Set(all.filter((x) => ids.has(x.block.id)).flatMap((x) => flattenBlocks(x.block.children ?? []).map((y) => y.block.id as string)));
    return [...ids].filter((id) => !inside.has(id));
  };

  const cloneBlocks = (b: any[]) => structuredClone(b ?? []);

  function insert(blocks: any[], items: any[], position: unknown, blockId: unknown) {
    const pos = position ?? "end";
    if (pos === "end") blocks.push(...items);
    else if (pos === "start") blocks.unshift(...items);
    else if (pos === "after" || pos === "before" || pos === "inside") {
      const at = locate(blocks, blockId);
      if (pos === "inside") (at.block.children ??= []).push(...items);
      else at.list.splice(at.index + (pos === "after" ? 1 : 0), 0, ...items);
    } else throw new ToolError("position must be end, start, after, before or inside.");
  }

  const childrenOf = (pages: Record<string, Page>, parent: string | null) =>
    Object.values(pages)
      .filter((p) => p.parentId === parent && !p.deletedAt)
      .sort((a, b) => a.order - b.order);

  // ---------------------------------------------------------------- tool calls

  async function call(c: Connection, asked: string, given: unknown): Promise<unknown> {
    const tool = toolNamed(asked);
    if (!tool) throw new ToolError(`There's no tool called "${asked}". The tools are: ${toolList(c).map((t) => t.name).join(", ")}.`);
    if (tool.write && c.permission !== "edit") throw new ToolError("This connection can only read. The person can allow editing in Dovli → Settings → AI apps.");
    const a = normalizeArgs(tool, given);
    const data = await load(c.uid);
    const mine = visible(c, data);
    const name = tool.name;

    switch (name) {
      case "get_overview": {
        const who = (await deps.profile?.(c.uid)) ?? {};
        const live = mine.filter((p) => !p.deletedAt);
        const roots = c.scope === "all" ? childrenOf(data.pages, null) : c.pageIds.map((id) => data.pages[id]).filter((p): p is Page => !!p && !p.deletedAt);
        const tree = (p: Page, depth: number): Doc => ({
          id: p.id,
          title: displayTitle(p),
          icon: p.mark,
          ...(p.kind === "board" ? { kind: "whiteboard" } : {}),
          ...(depth < 1 && childrenOf(data.pages, p.id).length ? { inside: childrenOf(data.pages, p.id).slice(0, 25).map((k) => tree(k, depth + 1)) } : {}),
        });
        return {
          person: { name: who.name ?? null, email: who.email ?? null },
          connection: { name: c.name, can: c.permission === "edit" ? "read and edit" : "read only", reaches: c.scope === "all" ? "all pages" : `${roots.length} chosen page(s) and the pages inside them` },
          counts: { pages: live.filter((p) => p.kind === "doc").length, whiteboards: live.filter((p) => p.kind === "board").length, in_trash: mine.filter((p) => p.deletedAt).length },
          pages: roots.slice(0, 60).map((p) => tree(p, 0)),
          favorites: live.filter((p) => p.favorite).slice(0, 20).map((p) => ({ id: p.id, title: displayTitle(p), icon: p.mark })),
          recently_edited: [...live].sort((x, y) => y.updatedAt - x.updatedAt).slice(0, 10).map((p) => ({ id: p.id, title: displayTitle(p), icon: p.mark, updated_at: new Date(p.updatedAt).toISOString() })),
          tip: "Use read_page with a page id to read one. Dovli Markdown is described in the server instructions.",
        };
      }

      case "list_pages": {
        const limit = Math.min(200, Math.max(1, Number(a.limit) || 50));
        const offset = Math.max(0, Number(a.offset) || 0);
        let items: Page[];
        const where = a.where ?? "tree";
        if (a.parent_id !== undefined && a.parent_id !== null) items = childrenOf(data.pages, page(c, data, a.parent_id).id);
        else if (where === "favorites") items = mine.filter((p) => p.favorite && !p.deletedAt);
        else if (where === "recent") items = mine.filter((p) => !p.deletedAt).sort((x, y) => y.updatedAt - x.updatedAt);
        else if (where === "trash") items = mine.filter((p) => p.deletedAt && !(p.parentId && data.pages[p.parentId]?.deletedAt));
        else items = c.scope === "all" ? childrenOf(data.pages, null) : c.pageIds.map((id) => data.pages[id]).filter((p): p is Page => !!p && !p.deletedAt);
        return { total: items.length, offset, pages: items.slice(offset, offset + limit).map((p) => summary(p, data.pages)), ...(offset + limit < items.length ? { next_offset: offset + limit } : {}) };
      }

      case "search": {
        if (typeof a.query !== "string" || !a.query.trim()) throw new ToolError("Give some words to search for.");
        const scoped = Object.fromEntries(mine.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
        const hits = searchPages(scoped, a.query, Math.min(50, Math.max(1, Number(a.limit) || 10)));
        const words = a.query.toLowerCase().replace(/^#/, "").split(/\s+/).filter(Boolean);
        return {
          query: a.query,
          results: hits.map((h) => ({
            ...summary(h.page, data.pages),
            path: pathOf(h.page, data.pages),
            matches: flattenBlocks(h.page.blocks)
              .map(({ block }) => ({ block_id: block.id, text: (Array.isArray(block.content) ? inlineText(block.content) : typeof block.content === "string" ? block.content : "").trim() }))
              .filter((m) => m.text && words.some((w) => m.text.toLowerCase().includes(w)))
              .slice(0, 3)
              .map((m) => ({ ...m, text: m.text.length > 200 ? `${m.text.slice(0, 200)}…` : m.text })),
          })),
        };
      }

      case "read_page": {
        const p = page(c, data, a.page_id, { trash: true });
        const head = { ...summary(p, data.pages), path: pathOf(p, data.pages), pages_inside: childrenOf(data.pages, p.id).map((k) => ({ id: k.id, title: displayTitle(k) })) };
        if (p.kind === "board") return { ...head, content: `This is a whiteboard with ${p.board?.elements?.length ?? 0} shapes. Whiteboards can't be read as text.` };
        if (a.format === "blocks") {
          const blocks = flattenBlocks(p.blocks).map(({ block, depth }) => ({
            id: block.id,
            type: block.type,
            depth,
            markdown: blockToMarkdown(block).join("\n"),
            ...(block.type === "checkListItem" ? { done: !!block.props?.checked } : {}),
          }));
          return { ...head, block_count: blocks.length, blocks: blocks.slice(0, 1500), ...(blocks.length > 1500 ? { note: "Only the first 1500 blocks are listed." } : {}) };
        }
        const md = blocksToMarkdown(p.blocks);
        return { ...head, markdown: md.length > MAX_READ ? `${md.slice(0, MAX_READ)}\n\n…(the page goes on; read it with format 'blocks' to see the rest)` : md };
      }

      case "list_tasks": {
        const status = a.status ?? "open";
        const limit = Math.min(500, Math.max(1, Number(a.limit) || 100));
        let pool = mine.filter((p) => !p.deletedAt && p.kind === "doc");
        if (a.page_id) {
          const root = page(c, data, a.page_id);
          pool = pool.filter((p) => p.id === root.id || ancestorsOf(data.pages, p.id).includes(root.id));
        }
        const tasks = pool
          .sort((x, y) => y.updatedAt - x.updatedAt)
          .flatMap((p) => todoItems(p).map((t) => ({ page_id: p.id, page_title: displayTitle(p), block_id: t.id, text: t.text, done: t.checked })))
          .filter((t) => (status === "all" ? true : status === "done" ? t.done : !t.done));
        return { total: tasks.length, tasks: tasks.slice(0, limit) };
      }

      case "create_page": {
        if (typeof a.title !== "string" || !a.title.trim()) throw new ToolError("Give the new page a title.");
        const parentId = a.parent_id ? page(c, data, a.parent_id).id : null;
        if (!parentId && c.scope !== "all") throw new ToolError("This connection can only reach some pages, so the new page has to go inside one of them (give parent_id).");
        if (parentId && data.pages[parentId].kind !== "doc") throw new ToolError("Pages can't go inside a whiteboard.");
        const id = newId();
        const t = now().getTime();
        const siblings = childrenOf(data.pages, parentId);
        const blocks = a.markdown ? toBlocks(a.markdown, data) : [];
        const created: Page = {
          id,
          parentId,
          kind: "doc",
          title: a.title.trim().slice(0, 200),
          mark: typeof a.icon === "string" && a.icon.trim() ? [...a.icon.trim()].slice(0, 2).join("") : "¶",
          ...(typeof a.style === "string" && getStyle(a.style) ? { style: a.style } : {}),
          blocks,
          createdAt: t,
          updatedAt: t,
          order: siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0,
        };
        await save(c, id, () => created, data);
        return { created: true, page_id: id, title: created.title, block_ids: flattenBlocks(blocks).map(({ block }) => block.id) };
      }

      case "add_blocks": {
        const p = page(c, data, a.page_id);
        let ids: string[] = [];
        await save(
          c,
          p.id,
          (cur, d) => {
            const blocks = cloneBlocks(editable(cur));
            const items = toBlocks(a.markdown, d);
            if (!items.length) throw new ToolError("The Markdown was empty.");
            insert(blocks, items, a.position, a.block_id);
            ids = flattenBlocks(items).map(({ block }) => block.id);
            return { ...cur, blocks };
          },
          data,
        );
        return { added: ids.length, block_ids: ids };
      }

      case "update_block": {
        const p = page(c, data, a.page_id);
        let ids: string[] = [];
        await save(
          c,
          p.id,
          (cur, d) => {
            const blocks = cloneBlocks(editable(cur));
            const at = locate(blocks, a.block_id);
            const items = toBlocks(a.markdown, d, blocks);
            if (!items.length) throw new ToolError("The Markdown was empty. To remove the block, use delete_blocks.");
            const [first, ...more] = items;
            first.id = at.block.id;
            if (!first.children?.length && at.block.children?.length) first.children = at.block.children;
            at.list.splice(at.index, 1, first, ...more);
            ids = [first.id, ...more.map((b: any) => b.id)];
            return { ...cur, blocks };
          },
          data,
        );
        return { updated: ids[0], block_ids: ids };
      }

      case "delete_blocks": {
        const p = page(c, data, a.page_id);
        if (!Array.isArray(a.block_ids) || !a.block_ids.length) throw new ToolError("Give the block_ids to delete.");
        const ids = blockIds(editable(p), a.block_ids);
        await save(
          c,
          p.id,
          (cur) => {
            const blocks = cloneBlocks(editable(cur));
            for (const id of ids) {
              const at = flattenBlocks(blocks).find((x) => x.block.id === id);
              if (at) at.parent.splice(at.parent.indexOf(at.block), 1);
            }
            return { ...cur, blocks };
          },
          data,
        );
        return { deleted: ids.length, block_ids: ids };
      }

      case "move_blocks": {
        const from = page(c, data, a.page_id);
        const to = a.to_page_id ? page(c, data, a.to_page_id) : from;
        if (!Array.isArray(a.block_ids) || !a.block_ids.length) throw new ToolError("Give the block_ids to move.");
        const ids = blockIds(editable(from), a.block_ids);
        if (to.id === from.id) {
          if (a.block_id !== undefined && ["after", "before", "inside"].includes(a.position) && ids.includes(locate(editable(from), a.block_id).block.id))
            throw new ToolError("A block can't be moved next to or inside itself.");
          await save(
            c,
            from.id,
            (cur) => {
              const blocks = cloneBlocks(editable(cur));
              const moving = ids.map((id) => {
                const at = locate(blocks, id);
                at.list.splice(at.index, 1);
                return at.block;
              });
              insert(blocks, moving, a.position, a.block_id);
              return { ...cur, blocks };
            },
            data,
          );
          return { moved: ids.length, block_ids: ids };
        }
        // To another page: add them there first, then take them out here, so nothing is lost.
        const moving = ids.map((id) => structuredClone(locate(editable(from), id).block));
        await save(c, to.id, (cur) => {
          const blocks = cloneBlocks(editable(cur));
          insert(blocks, moving, a.position, a.block_id);
          return { ...cur, blocks };
        });
        await save(c, from.id, (cur) => {
          const blocks = cloneBlocks(editable(cur));
          for (const id of ids) {
            const at = flattenBlocks(blocks).find((x) => x.block.id === id);
            if (at) at.parent.splice(at.parent.indexOf(at.block), 1);
          }
          return { ...cur, blocks };
        });
        return { moved: ids.length, to_page_id: to.id, block_ids: ids };
      }

      case "update_page": {
        const p = page(c, data, a.page_id);
        // Resolved here: the parent may have been given by title or link.
        let parentId: string | null | undefined;
        if (a.parent_id !== undefined) {
          if (a.parent_id === null && c.scope !== "all") throw new ToolError("This connection can only reach some pages, so it can't move a page to the top level.");
          if (a.parent_id !== null) {
            const parent = page(c, data, a.parent_id);
            if (parent.id === p.id || ancestorsOf(data.pages, parent.id).includes(p.id)) throw new ToolError("A page can't go inside itself or a page inside it.");
            if (parent.kind !== "doc") throw new ToolError("Pages can't go inside a whiteboard.");
            parentId = parent.id;
          } else parentId = null;
        }
        const changed: string[] = [];
        await save(
          c,
          p.id,
          (cur, d) => {
            const next: Page = { ...cur };
            if (typeof a.title === "string") (next.title = a.title.trim().slice(0, 200)), changed.push("title");
            if (typeof a.icon === "string" && a.icon.trim()) (next.mark = [...a.icon.trim()].slice(0, 2).join("")), changed.push("icon");
            if (typeof a.favorite === "boolean") (next.favorite = a.favorite), changed.push("favorite");
            if (parentId !== undefined && parentId !== cur.parentId) {
              next.parentId = parentId;
              const sib = childrenOf(d.pages, parentId);
              next.order = sib.length ? Math.max(...sib.map((s) => s.order)) + 1 : 0;
              changed.push("parent");
            }
            if (typeof a.content_markdown === "string") {
              next.blocks = toBlocks(a.content_markdown, d, editable(cur));
              changed.push("content");
            }
            return changed.length ? next : null;
          },
          data,
        );
        return { updated: p.id, changed };
      }

      case "set_task": {
        const p = page(c, data, a.page_id);
        if (typeof a.done !== "boolean") throw new ToolError("Say done: true or done: false.");
        let id = a.block_id;
        await save(
          c,
          p.id,
          (cur) => {
            const blocks = cloneBlocks(editable(cur));
            const at = locate(blocks, a.block_id);
            if (at.block.type !== "checkListItem") throw new ToolError("That block isn't a to-do.");
            at.block.props = { ...(at.block.props ?? {}), checked: a.done };
            id = at.block.id;
            return { ...cur, blocks };
          },
          data,
        );
        return { block_id: id, done: a.done };
      }

      case "trash_page": {
        const p = page(c, data, a.page_id, { trash: true });
        const restore = a.restore === true;
        const ids = [p.id, ...Object.values(data.pages).filter((x) => ancestorsOf(data.pages, x.id).includes(p.id)).map((x) => x.id)];
        const t = now().getTime();
        for (const id of ids)
          await save(c, id, (cur) => {
            if (!cur) return null;
            if (restore) return cur.deletedAt ? { ...cur, deletedAt: null } : cur;
            return cur.deletedAt ? cur : { ...cur, deletedAt: t };
          });
        return restore ? { restored: ids.length } : { moved_to_trash: ids.length, note: "It can be restored for 30 days (trash_page with restore: true)." };
      }
    }
    throw new ToolError(`There's no tool called "${name}".`);
  }

  // ---------------------------------------------------------------- JSON-RPC

  const toolList = (c: Connection) =>
    TOOLS.filter((t) => !t.write || c.permission === "edit").map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { title: t.title, readOnlyHint: !t.write, destructiveHint: !!t.destructive, idempotentHint: !t.write || !!t.idempotent, openWorldHint: false },
    }));

  function limited(c: Connection) {
    const t = Date.now();
    const recent = (rate.get(c.id) ?? []).filter((x) => t - x < 60_000);
    recent.push(t);
    rate.set(c.id, recent);
    return recent.length > 240;
  }

  /** One JSON-RPC message in, its reply out (null for notifications). */
  async function handle(c: Connection, msg: any): Promise<Doc | null> {
    const id = msg?.id ?? null;
    const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
    const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
    // Some hand-made clients leave out "jsonrpc".
    if (!isPlain(msg) || (msg.jsonrpc !== undefined && msg.jsonrpc !== "2.0") || typeof msg.method !== "string") return fail(-32600, "Invalid request: send a JSON-RPC 2.0 message with a method.");
    const isNote = msg.id === undefined || msg.id === null;
    if (isNote) return null; // notifications/initialized, cancelled… need no answer
    switch (msg.method.trim()) {
      case "initialize": {
        const asked = msg.params?.protocolVersion;
        return reply({
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: toolList(c) });
      case "resources/list":
        return reply({ resources: [] });
      case "resources/templates/list":
        return reply({ resourceTemplates: [] });
      case "prompts/list":
        return reply({ prompts: [] });
      case "logging/setLevel":
        return reply({});
      case "completion/complete":
        return reply({ completion: { values: [], hasMore: false } });
      case "tools/call": {
        const name = msg.params?.name ?? msg.params?.tool;
        const args = msg.params?.arguments ?? msg.params?.args ?? msg.params?.input ?? {};
        if (typeof name !== "string") return fail(-32602, "Invalid params: give the tool's name.");
        if (limited(c)) return reply({ isError: true, content: [{ type: "text", text: "Too many requests in a minute. Wait a moment and try again." }] });
        try {
          const out = await call(c, name, args);
          await noteUse(c, toolNamed(name)?.name ?? name).catch(() => {});
          return reply({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out });
        } catch (e) {
          if (e instanceof ToolError || e instanceof CloudError) return reply({ isError: true, content: [{ type: "text", text: e.message }] });
          throw e;
        }
      }
      default:
        return fail(-32601, `Method not found: ${msg.method}`);
    }
  }

  /**
   * Whether a page changed after revision `cursor`, for a client that keeps one page open (the
   * browser extension). One small query, instead of reading every page again. With no cursor, it
   * only says where to start from.
   */
  async function follow(c: Connection, pageId: string, cursor: number | null): Promise<{ cursor: number; changed: boolean }> {
    if (cursor === null || cursor < 0) return { cursor: await cloud.latest(c.uid), changed: false };
    const rows = await cloud.pull(c.uid, { cursor, limit: 200 });
    const next = rows.reduce((m, r) => Math.max(m, r.rev), cursor);
    // More than one page of changes: say it changed, to be safe.
    return { cursor: next, changed: rows.length >= 200 || rows.some((r) => r.id === pageId) };
  }

  /** A page as it's stored, if this connection reaches it: for clients that draw pages themselves. */
  async function getPage(c: Connection, pageId: string): Promise<Page> {
    return page(c, await load(c.uid), pageId);
  }

  return { list, create, update, rotate, remove, removeAll, resolve, handle, call, follow, getPage, tools: toolList };
}

/** A problem with a tool call that the AI app should see and can fix (wrong id, empty title…). */
export class ToolError extends Error {}
