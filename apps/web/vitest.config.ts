import path from "node:path";
import { defineConfig } from "vitest/config";

// "@/…" means src/, as in tsconfig.json, so route handlers can be tested too.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
