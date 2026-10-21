import { builtinModules } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";

// Electron's own side, as CommonJS for Node: the main process (--mode main) and the window's
// preload script (--mode preload). They're built one at a time because a sandboxed preload can
// only require Electron itself, so it must be a single file with nothing shared.

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../web/src") } },
  build: {
    ssr: true,
    outDir: path.join(import.meta.dirname, "dist/main"),
    emptyOutDir: mode === "main",
    target: "node22",
    sourcemap: true,
    rollupOptions: {
      input: { [mode]: path.join(import.meta.dirname, mode === "preload" ? "src/preload/preload.ts" : "src/main/main.ts") },
      external: ["electron", "electron-updater", ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      output: { format: "cjs", entryFileNames: "[name].cjs" },
    },
  },
  ssr: { noExternal: true },
}));
