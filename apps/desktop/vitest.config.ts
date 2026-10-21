import path from "node:path";
import { defineConfig } from "vitest/config";

// "@/…" is the web app's src/, as in the app's own build.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../web/src") } },
  test: { include: ["test/**/*.test.ts"] },
});
