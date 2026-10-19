#!/usr/bin/env node
// Dovli for AI apps that start MCP servers as a local command (Claude Desktop, Codex, Cursor…).
// It passes the app's messages to your Dovli address and the answers back. No installs needed:
// just Node.js 18 or newer.
//
//   node dovli-mcp.mjs https://dovli.in/api/mcp/dvl_…
//
// (or set DOVLI_MCP_URL instead of passing the address). Get the address in Dovli → Settings →
// AI apps. Messages arrive on stdin, one JSON message per line, and answers go to stdout the
// same way; anything for people goes to stderr, which the AI app shows in its logs.

import { createInterface } from "node:readline";

const url = process.argv[2] || process.env.DOVLI_MCP_URL;
const log = (...a) => console.error("[dovli]", ...a);

if (!url || !/^https?:\/\/.+\/api\/mcp(\/dvl_[A-Za-z0-9_-]+)?$/.test(url)) {
  log("Give your Dovli address, from Dovli → Settings → AI apps: node dovli-mcp.mjs https://…/api/mcp/dvl_…");
  process.exit(1);
}
if (typeof fetch !== "function") {
  log("This needs Node.js 18 or newer.");
  process.exit(1);
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const failWith = (msg, message) => {
  if (msg && msg.id !== undefined && msg.id !== null) send({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message } });
};

async function forward(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(msg),
    });
    if (res.status === 202) return; // a notification: nothing comes back
    const text = await res.text();
    let reply;
    try {
      reply = JSON.parse(text);
    } catch {
      return failWith(msg, `Dovli answered with something unexpected (HTTP ${res.status}).`);
    }
    for (const r of Array.isArray(reply) ? reply : [reply]) send(r);
  } catch (e) {
    log(`Can't reach Dovli at ${new URL(url).origin}: ${e.message}`);
    failWith(msg, `Can't reach Dovli at ${new URL(url).origin}. Is it running, and is this computer online?`);
  }
}

// Answers may come back in any order; MCP matches them by id.
const pending = new Set();
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const p = forward(line).finally(() => pending.delete(p));
  pending.add(p);
});
rl.on("close", async () => {
  await Promise.allSettled([...pending]);
  process.exit(0);
});
log(`Connected to ${new URL(url).origin}`);
