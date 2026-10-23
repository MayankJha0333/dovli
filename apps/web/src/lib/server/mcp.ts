import "server-only";
import { NextResponse } from "next/server";
import { backingStore, cloudStore } from "./cloud";
import { createMcp, findSecret, type Connection } from "./mcpCore";

// Dovli's MCP server (see mcpCore.ts), on the same database as everything else.
// An AI app reaches it at /api/mcp/<secret> (the address shown in Settings → AI apps), or at
// /api/mcp with the secret in a header (Authorization, X-API-Key) or ?key=. It speaks MCP's
// Streamable HTTP transport without sessions: each POST carries one JSON-RPC message (or a
// batch) and gets a JSON reply, which every MCP client understands.

let server: ReturnType<typeof createMcp> | null = null;

export function mcpServer() {
  if (server) return server;
  const store = backingStore();
  server = createMcp({
    store,
    cloud: cloudStore(),
    profile: (uid) => store.transaction(async (tx) => {
      const u = await tx.get(`users/${uid}`);
      return { name: u?.name ?? null, email: u?.email ?? null };
    }),
  });
  return server;
}

function secretOf(req: Request, path: string[]): string | null {
  const url = new URL(req.url);
  const h = req.headers;
  for (const raw of [path.join("/"), h.get("authorization"), h.get("x-api-key"), h.get("x-dovli-key"), url.searchParams.get("key"), url.searchParams.get("token"), url.searchParams.get("secret")]) {
    const s = findSecret(raw);
    if (s) return s;
  }
  return null;
}

// Web pages are refused (MCP's advice against DNS rebinding), except this site and pages on this
// computer such as the MCP Inspector. AI apps send no Origin header.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const allowedOrigin = (req: Request) => {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const extra = (process.env.MCP_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return origin === new URL(req.url).origin || LOCAL.test(origin) || extra.includes(origin) ? origin : false;
};

const baseHeaders = (req: Request): Record<string, string> => {
  const origin = allowedOrigin(req);
  return {
    "cache-control": "no-store",
    ...(origin
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          "access-control-allow-headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id, x-api-key, x-dovli-key",
          "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
          "access-control-max-age": "86400",
          vary: "origin",
        }
      : {}),
  };
};

const rpcError = (req: Request, status: number, message: string, id: unknown = null) =>
  NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32001, message } }, { status, headers: baseHeaders(req) });

const NOT_VALID = "This Dovli address isn't valid any more. Make a new one in Dovli → Settings → AI apps.";
const NO_SECRET = "Dovli needs your connection's address, like https://…/api/mcp/dvl_…, or its dvl_… key as \"Authorization: Bearer dvl_…\". Get one in Dovli → Settings → AI apps.";

/** The connection a request may use, or the error reply that refuses it. */
async function authorize(req: Request, path: string[]): Promise<{ mcp: ReturnType<typeof createMcp>; connection: Connection } | Response> {
  if (allowedOrigin(req) === false) return rpcError(req, 403, "Requests from web pages aren't allowed.");
  let mcp: ReturnType<typeof createMcp>;
  try {
    mcp = mcpServer();
  } catch {
    return rpcError(req, 503, "Dovli's cloud isn't set up on this server, so AI apps can't connect yet.");
  }
  const secret = secretOf(req, path);
  const connection = await mcp.resolve(secret);
  if (!connection) return rpcError(req, secret ? 404 : 401, secret ? NOT_VALID : NO_SECRET);
  if (!connection.enabled) return rpcError(req, 403, `The "${connection.name}" connection is switched off in Dovli → Settings → AI apps.`);
  return { mcp, connection };
}

/** Answer one HTTP request from an AI app. */
export async function answerMcp(req: Request, path: string[] = []): Promise<Response> {
  const auth = await authorize(req, path);
  if (auth instanceof Response) return auth;
  const { mcp, connection } = auth;
  const headers = baseHeaders(req);

  const text = (await req.text()).replace(/^﻿/, "").trim();
  if (text.length > 1_000_000) return rpcError(req, 413, "That request was too big.");
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: send one JSON-RPC message (or a list of them) as JSON." } }, { status: 400, headers });
  }
  const messages = Array.isArray(body) ? body : [body];
  const replies: unknown[] = [];
  for (const m of messages.slice(0, 50)) {
    try {
      const r = await mcp.handle(connection, m);
      if (r) replies.push(r);
    } catch (e) {
      console.error("[dovli] MCP request failed:", e);
      replies.push({ jsonrpc: "2.0", id: m?.id ?? null, error: { code: -32603, message: "Something went wrong in Dovli. Please try again." } });
    }
  }
  // Only notifications: nothing to say back.
  if (!replies.length) return new Response(null, { status: 202, headers });
  const out = Array.isArray(body) ? replies : replies[0];
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream") && !accept.includes("application/json") && !accept.includes("*/*"))
    return new Response(`event: message\ndata: ${JSON.stringify(out)}\n\n`, { headers: { ...headers, "content-type": "text/event-stream" } });
  return NextResponse.json(out, { headers });
}

/** No event stream (the MCP spec allows that). A plain GET says whether the address works. */
export async function answerMcpGet(req: Request, path: string[] = []): Promise<Response> {
  if ((req.headers.get("accept") ?? "").includes("text/event-stream")) return new Response(null, { status: 405, headers: { allow: "POST", ...baseHeaders(req) } });
  const auth = await authorize(req, path);
  if (auth instanceof Response) return auth;
  const c = auth.connection;
  return NextResponse.json(
    {
      ok: true,
      server: "Dovli MCP",
      connection: c.name,
      can: c.permission === "edit" ? "read and edit" : "read only",
      // Lets dovli-mcp.mjs tell it is out of date: npx keeps running the copy it installed first.
      bridge: process.env.NEXT_PUBLIC_MCP_BRIDGE_VERSION ?? null,
      message: "This address works. Paste it into your AI app as an MCP server (type: HTTP / Streamable HTTP). AI apps send their requests here with POST.",
    },
    { headers: baseHeaders(req) },
  );
}

export const answerMcpOptions = (req: Request) => (allowedOrigin(req) === false ? new Response(null, { status: 403 }) : new Response(null, { status: 204, headers: baseHeaders(req) }));

export const answerMcpDelete = (req: Request) => new Response(null, { status: 405, headers: { allow: "POST", ...baseHeaders(req) } });
