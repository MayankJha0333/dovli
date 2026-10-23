import fs from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import zlib from "node:zlib";
import type { NextConfig } from "next";

/**
 * Excalidraw shrinks fonts for exports in a Web Worker. It finds the worker through
 * `import.meta.url`, which Next's bundler turns into a file:// path the browser can't load.
 * So we serve the worker (and the chunks it imports) as plain files from
 * public/excalidraw/<version>/, and tell Excalidraw that address (see src/lib/excalidraw.ts and
 * patches/@excalidraw__excalidraw*.patch). Runs whenever Next loads this config, for dev and build.
 */
function serveExcalidrawWorker(): string {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const dist = path.dirname(require.resolve("@excalidraw/excalidraw")); // …/dist/prod
  const version: string = JSON.parse(fs.readFileSync(path.join(dist, "../../package.json"), "utf8")).version;
  const outDir = path.join(process.cwd(), "public/excalidraw", version);
  const entry = "subset-worker.chunk.js";
  const queue = [entry];
  const seen = new Set<string>();
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = fs.readFileSync(path.join(dist, file), "utf8");
    for (const m of code.matchAll(/(?:from|import)\s*["']\.\/([\w.-]+\.js)["']/g)) queue.push(m[1]);
    const out = path.join(outDir, file);
    if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== code) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(out, code);
    }
  }
  return `/excalidraw/${version}/${entry}`;
}

/** A gzipped ustar archive. Fixed metadata, so the same files always pack to the same bytes. */
function tarGz(files: { name: string; data: Buffer; mode: number }[]): Buffer {
  const blocks: Buffer[] = [];
  for (const { name, data, mode } of files) {
    const h = Buffer.alloc(512);
    const field = (value: string, at: number, len: number) => h.write(value.slice(0, len), at, len, "ascii");
    const octal = (n: number, at: number, len: number) => field(n.toString(8).padStart(len - 1, "0") + "\0", at, len);
    field(name, 0, 100);
    octal(mode, 100, 8);
    octal(0, 108, 8);
    octal(0, 116, 8);
    octal(data.length, 124, 12);
    octal(0, 136, 12);
    h.fill(" ", 148, 156);
    field("0", 156, 1);
    field("ustar\0", 257, 6);
    field("00", 263, 2);
    octal(h.reduce((sum, byte) => sum + byte, 0), 148, 7);
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks), { level: 9 });
}

/**
 * Serves the MCP bridge (dovli-mcp.mjs at the repo root) as public/dovli-mcp.mjs and as an npm
 * package for `npx -y <site>/dovli-mcp-<version>.tgz`, and returns that version. It is the file's
 * hash because npx reuses whatever it first installed from an address.
 */
function packMcpBridge(): string {
  const root = path.join(process.cwd(), "../../dovli-mcp.mjs");
  const served = path.join(process.cwd(), "public/dovli-mcp.mjs");
  if (fs.existsSync(root) && (!fs.existsSync(served) || fs.readFileSync(root, "utf8") !== fs.readFileSync(served, "utf8"))) fs.copyFileSync(root, served);
  const bridge = fs.readFileSync(served);
  const version = createHash("sha256").update(bridge).digest("hex").slice(0, 10);
  const manifest = { name: "dovli-mcp", version: `1.0.0-${version}`, description: "Dovli for AI apps that start MCP servers as a command", bin: { "dovli-mcp": "dovli-mcp.mjs" }, engines: { node: ">=18" }, license: "MIT" };
  const tgz = tarGz([
    { name: "package/package.json", data: Buffer.from(JSON.stringify(manifest, null, 2)), mode: 0o644 },
    { name: "package/dovli-mcp.mjs", data: bridge, mode: 0o755 },
  ]);
  const out = path.join(process.cwd(), "public/dovli-mcp.tgz");
  if (!fs.existsSync(out) || !fs.readFileSync(out).equals(tgz)) fs.writeFileSync(out, tgz);
  return version;
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_EXCALIDRAW_WORKER: serveExcalidrawWorker(),
    // Shown in each device's record (users/{uid}/devices), to know which version people run.
    NEXT_PUBLIC_APP_VERSION: JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).version,
    NEXT_PUBLIC_MCP_BRIDGE_VERSION: packMcpBridge(),
  },
  async rewrites() {
    return [{ source: "/dovli-mcp-:version.tgz", destination: "/dovli-mcp.tgz" }];
  },
  // Our shared packages ship TypeScript source, so Next compiles them like app code.
  transpilePackages: ["@dovli/core", "@dovli/theme", "@dovli/ui", "@dovli/editor", "@dovli/sync"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
