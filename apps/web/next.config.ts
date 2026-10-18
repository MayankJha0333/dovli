import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
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

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_EXCALIDRAW_WORKER: serveExcalidrawWorker(),
    // Shown in each device's record (users/{uid}/devices), to know which version people run.
    NEXT_PUBLIC_APP_VERSION: JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).version,
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
