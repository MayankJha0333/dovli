import "server-only";
import { NextResponse } from "next/server";
import { backingStore, cloudStore } from "./cloud";
import { createMcp } from "./mcpCore";

// Dovli's MCP server (see mcpCore.ts), on the same database as everything else.
// An AI app reaches it at /api/mcp/<secret> (the address shown in Settings → AI apps), or at
// /api/mcp with the secret as "Authorization: Bearer <secret>". It speaks MCP's Streamable HTTP
// transport without sessions: each POST carries one JSON-RPC message (or a batch) and gets a
// JSON reply, which every MCP client understands.

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

const headers = { "cache-control": "no-store" };
const rpcError = (status: number, message: string, id: unknown = null) =>
  NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32001, message } }, { status, headers });

/** Answer one HTTP request from an AI app. */
export async function answerMcp(req: Request, secret: string | null): Promise<Response> {
  // A browser page on another website must not reach it (MCP's advice against DNS rebinding).
  // AI apps don't send an Origin header.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return rpcError(403, "Requests from web pages aren't allowed.");

  let mcp: ReturnType<typeof createMcp>;
  try {
    mcp = mcpServer();
  } catch {
    return rpcError(503, "Dovli's cloud isn't set up on this server, so AI apps can't connect yet.");
  }
  const connection = await mcp.resolve(secret);
  if (!connection) return rpcError(secret ? 404 : 401, "This Dovli address isn't valid any more. Make a new one in Dovli → Settings → AI apps.");
  if (!connection.enabled) return rpcError(403, `The "${connection.name}" connection is switched off in Dovli → Settings → AI apps.`);

  const text = await req.text();
  if (text.length > 1_000_000) return rpcError(413, "That request was too big.");
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers });
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
  return NextResponse.json(Array.isArray(body) ? replies : replies[0], { headers });
}

/** No event stream: this server only answers requests (allowed by the MCP spec). */
export const noStream = () => new Response(null, { status: 405, headers: { allow: "POST", ...headers } });
