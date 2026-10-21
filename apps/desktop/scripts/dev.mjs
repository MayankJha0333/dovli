// pnpm --filter @dovli/desktop dev: the desktop app with the window's code live-reloading.
//   1. Builds the main process and preload script once (restart this for changes there).
//   2. Starts Vite for the window (http://localhost:5173), which sends /api to DOVLI_SITE_URL
//      (default http://localhost:3000, the web app's `pnpm dev:web`).
//   3. Opens Electron on it. Closing the app stops everything.

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { createServer } from "vite";

const root = path.join(import.meta.dirname, "..");
const site = process.env.DOVLI_SITE_URL ?? "http://localhost:3000";

for (const mode of ["main", "preload"]) {
  const r = spawnSync("npx", ["vite", "build", "-c", "vite.main.config.ts", "--mode", mode, "--logLevel", "warn"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const server = await createServer({ configFile: path.join(root, "vite.config.ts"), configLoader: "runner", mode: "development" });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5173/";
console.log(`Window code at ${url}, Dovli's server at ${site}`);

// Editors built on Electron (VS Code, Cursor) set this for their own tools; it would start
// Electron as plain Node.
const env = { ...process.env, DOVLI_RENDERER_URL: url, DOVLI_SITE_URL: site };
delete env.ELECTRON_RUN_AS_NODE;

const electron = spawn("npx", ["electron", "."], { cwd: root, stdio: "inherit", env });
electron.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
