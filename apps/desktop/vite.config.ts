import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { APP_THEMES, themeStylesheet } from "@dovli/theme";
import { themeBootScript } from "../web/src/lib/themeBoot";

// The desktop app's window content: the web app's own workspace (apps/web/src, as "@/…"), built as
// plain files the app serves itself, so it opens with no internet. See README.md.

const web = path.resolve(import.meta.dirname, "../web");
const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "package.json"), "utf8"));

/** Excalidraw's font worker, found through import.meta.url (see apps/web/next.config.ts). */
function excalidrawWorker(): Plugin {
  const require = createRequire(path.join(web, "package.json"));
  const dist = path.dirname(require.resolve("@excalidraw/excalidraw"));
  const version: string = JSON.parse(fs.readFileSync(path.join(dist, "../../package.json"), "utf8")).version;
  const files: string[] = [];
  const queue = ["subset-worker.chunk.js"];
  while (queue.length) {
    const file = queue.shift()!;
    if (files.includes(file)) continue;
    files.push(file);
    const code = fs.readFileSync(path.join(dist, file), "utf8");
    for (const m of code.matchAll(/(?:from|import)\s*["']\.\/([\w.-]+\.js)["']/g)) queue.push(m[1]);
  }
  const base = `excalidraw/${version}`;
  return {
    name: "dovli-excalidraw-worker",
    config: () => ({ define: { "process.env.NEXT_PUBLIC_EXCALIDRAW_WORKER": JSON.stringify(`/${base}/subset-worker.chunk.js`) } }),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url?.startsWith(`/${base}/`) && path.basename(req.url);
        if (!file || !files.includes(file)) return next();
        res.setHeader("content-type", "text/javascript");
        res.end(fs.readFileSync(path.join(dist, file)));
      });
    },
    generateBundle() {
      for (const file of files) this.emitFile({ type: "asset", fileName: `${base}/${file}`, source: fs.readFileSync(path.join(dist, file)) });
    },
  };
}

/**
 * The theme's colours and the script that picks the saved theme, inline in the page so the first
 * paint already has the right colours. The script's hash goes in the page's Content Security Policy.
 */
function themeBoot(env: Record<string, string>): Plugin {
  const boot = themeBootScript(Object.fromEntries(APP_THEMES.map((t) => [t.id, { scheme: t.scheme, bg: t.colors.bg }])));
  const hash = createHash("sha256").update(boot).digest("base64");
  const emulator = env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'sha256-${hash}' 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Firebase sign-in, link previews and embeds talk to other sites; Dovli's own server is /api.
    `connect-src 'self' https: wss:${emulator ? ` http://${emulator}` : ""}`,
    "frame-src https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return {
    name: "dovli-theme-boot",
    transformIndexHtml: {
      order: "pre",
      handler: (html) =>
        html
          .replace("<!--csp-->", `<meta http-equiv="Content-Security-Policy" content="${csp}" />`)
          .replace("<!--theme-->", `<script>${boot}</script>\n    <style id="dovli-themes">${themeStylesheet()}</style>`),
    },
  };
}

export default defineConfig(({ mode }) => {
  // The web app's public settings (apps/web/.env.local), unless this process sets them.
  const fileEnv = loadEnv(mode, web, "NEXT_PUBLIC_");
  const env: Record<string, string> = { ...fileEnv };
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith("NEXT_PUBLIC_") && v !== undefined) env[k] = v;
  env.NEXT_PUBLIC_APP_VERSION = pkg.version;

  const define: Record<string, string> = { "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development") };
  for (const [k, v] of Object.entries(env)) define[`process.env.${k}`] = JSON.stringify(v);
  // Anything else the shared code reads is unset here, as in a browser.
  define["process.env"] = "{}";

  return {
    root: path.join(import.meta.dirname, "renderer"),
    // Excalidraw's fonts and the rest of the web app's public files.
    publicDir: path.join(web, "public"),
    base: "/",
    envPrefix: "DOVLI_DESKTOP_",
    resolve: { alias: { "@": path.join(web, "src") } },
    define,
    plugins: [react(), excalidrawWorker(), themeBoot(env)],
    server: {
      port: 5173,
      strictPort: true,
      // Development only: the web app's server for /api (pnpm dev:web).
      proxy: { "/api": { target: process.env.DOVLI_SITE_URL ?? "http://localhost:3000", changeOrigin: true } },
    },
    build: {
      outDir: path.join(import.meta.dirname, "dist/renderer"),
      emptyOutDir: true,
      target: "chrome140",
      chunkSizeWarningLimit: 6000,
      sourcemap: true,
    },
  };
});
