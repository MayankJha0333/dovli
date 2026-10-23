#!/usr/bin/env node
// Dovli for AI apps that start MCP servers as a local command (Claude Desktop, Codex, Cursor…).
// It passes the app's messages (one JSON message per line on stdin and stdout) to your Dovli
// address. Needs Node.js 18 or newer.
//
//   npx -y https://dovli.in/dovli-mcp.tgz https://dovli.in/api/mcp/dvl_…
//   node dovli-mcp.mjs https://dovli.in/api/mcp/dvl_…
//
// The address can also come from DOVLI_MCP_URL, or just the key from DOVLI_MCP_TOKEN with
// DOVLI_SERVER (https://dovli.in by default). Messages for people go to stderr, the app's log.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const log = (...a) => console.error("[dovli]", ...a);
const SECRET = /dvl_[A-Za-z0-9_-]{20,64}/;

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#]|$)/;

function address(given, token, server) {
  const raw = (given ?? "").trim().replace(/^["'<]+|["'>]+$/g, "").trim().replace(/\/+$/, "");
  const key = raw.match(SECRET)?.[0] ?? (token ?? "").match(SECRET)?.[0];
  if (!key) return null;
  if (!raw || raw === key) return `${(server || "https://dovli.in").trim().replace(/\/+$/, "")}/api/mcp/${key}`;
  // A pasted address keeps its own host even without http(s)://, so the key never goes elsewhere.
  let u;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `${LOCAL.test(raw) ? "http" : "https"}://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const at = u.pathname.indexOf("/api/mcp");
  return `${u.origin}${at > 0 ? u.pathname.slice(0, at) : ""}/api/mcp/${key}`;
}

const given = process.argv.slice(2).find((a) => SECRET.test(a) || /^\s*["']?https?:\/\//i.test(a)) ?? process.env.DOVLI_MCP_URL;
const url = address(given, process.env.DOVLI_MCP_TOKEN, process.env.DOVLI_SERVER);

if (!url) {
  log("Give your Dovli address, from Dovli → Settings → AI apps: node dovli-mcp.mjs https://…/api/mcp/dvl_…");
  process.exit(1);
}
if (typeof fetch !== "function") {
  log("This needs Node.js 18 or newer.");
  process.exit(1);
}
const origin = new URL(url).origin;

process.stdout.on("error", (e) => {
  if (e.code === "EPIPE") process.exit(0); // the AI app closed us
  throw e;
});
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const failWith = (msg, message) => {
  for (const m of Array.isArray(msg) ? msg : [msg]) if (m && m.id !== undefined && m.id !== null) send({ jsonrpc: "2.0", id: m.id, error: { code: -32000, message } });
};

const HINTS = {
  401: "Dovli didn't get the address's key. Copy the whole address from Dovli → Settings → AI apps.",
  403: "This connection is switched off in Dovli → Settings → AI apps.",
  404: "This Dovli address isn't valid any more. Make a new one in Dovli → Settings → AI apps.",
  429: "Too many requests in a minute. Wait a moment and try again.",
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// A change (tools/call) is sent again only if it surely never arrived: a dropped connection
// (ECONNRESET) or a 503 can come after Dovli already made it.
const unsent = (e) => ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(e?.cause?.code);
const safeToRepeat = (msg) => (Array.isArray(msg) ? msg : [msg]).every((m) => m?.method !== "tools/call");

function answers(text, type) {
  if (!type.includes("text/event-stream")) return [].concat(JSON.parse(text));
  const out = [];
  for (const event of text.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (data) out.push(...[].concat(JSON.parse(data)));
  }
  return out;
}

async function forward(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify(msg),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.status === 202 || res.status === 204) return; // a notification: nothing comes back
      const retry = res.status === 429 || (safeToRepeat(msg) && [502, 503, 504].includes(res.status));
      if (retry && attempt < 4) {
        await wait(500 * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      let replies;
      try {
        replies = answers(text, res.headers.get("content-type") ?? "");
      } catch {
        return failWith(msg, HINTS[res.status] ?? `Dovli answered with something unexpected (HTTP ${res.status}).`);
      }
      if (!res.ok && HINTS[res.status]) log(HINTS[res.status]);
      // Errors from before Dovli read the message (a wrong key) have id null; the app needs its own.
      if (replies.length === 1 && replies[0]?.error && (replies[0].id === null || replies[0].id === undefined)) return failWith(msg, replies[0].error.message);
      for (const r of replies) send(r);
      return;
    } catch (e) {
      if ((unsent(e) || safeToRepeat(msg)) && e?.name !== "TimeoutError" && attempt < 4) {
        await wait(500 * 2 ** attempt);
        continue;
      }
      const why = e?.name === "TimeoutError" ? "Dovli took too long to answer" : `Can't reach Dovli at ${origin}`;
      log(`${why}: ${e?.cause?.code ?? e?.message ?? e}`);
      return failWith(msg, `${why}. Is it running, and is this computer online?`);
    }
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

fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) })
  .then(async (res) => {
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok) log(`Connected to ${origin} as "${body.connection}" (${body.can}).`);
    else log(HINTS[res.status] ?? `Dovli at ${origin} answered HTTP ${res.status}.`);
    // Dovli reports this file's hash as the current version (apps/web/next.config.ts).
    const mine = createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex").slice(0, 10);
    if (typeof body?.bridge === "string" && body.bridge !== mine) log("A newer version of this connector is out: copy the setup again from Dovli → Settings → AI apps.");
  })
  .catch((e) => log(`Can't reach Dovli at ${origin} yet: ${e?.cause?.code ?? e?.message ?? e}`));
