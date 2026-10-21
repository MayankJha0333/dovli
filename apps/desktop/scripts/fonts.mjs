// Copies Dovli's Google Fonts (FONT_STYLESHEET in packages/theme) into renderer/fonts, so the
// desktop app looks the same with no internet. Run it again when that stylesheet changes:
//   pnpm --filter @dovli/desktop fonts

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(import.meta.dirname, "../renderer/fonts");
const themeSource = await readFile(path.join(import.meta.dirname, "../../../packages/theme/src/appThemes.ts"), "utf8");
const stylesheet = themeSource.match(/FONT_STYLESHEET\s*=\s*"([^"]+)"/)?.[1];
if (!stylesheet) throw new Error("FONT_STYLESHEET not found in packages/theme/src/appThemes.ts");

// Google sends woff2 (the smallest) only to browsers it knows support it.
const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const css = await (await fetch(stylesheet, { headers: { "user-agent": ua } })).text();

await rm(dir, { recursive: true, force: true });
await mkdir(path.join(dir, "files"), { recursive: true });

let n = 0;
const files = new Map();
for (const [, url] of css.matchAll(/url\((https:[^)]+)\)/g)) {
  if (files.has(url)) continue;
  const name = `${String(++n).padStart(2, "0")}-${path.basename(new URL(url).pathname)}`;
  files.set(url, name);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  await writeFile(path.join(dir, "files", name), Buffer.from(await res.arrayBuffer()));
}

const local = css.replace(/url\((https:[^)]+)\)/g, (_, url) => `url(./files/${files.get(url)})`);
await writeFile(path.join(dir, "fonts.css"), `/* Made by scripts/fonts.mjs from ${stylesheet} */\n${local}`);
console.log(`Saved ${files.size} font files to ${path.relative(process.cwd(), dir)}`);
