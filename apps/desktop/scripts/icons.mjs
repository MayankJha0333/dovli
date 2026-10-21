// Makes the desktop app's icons from Dovli's mark (apps/web/src/app/icon.svg):
//   resources/icon.png      macOS: the rounded square on Apple's 1024 grid (824 px, with a shadow)
//   resources/icon-win.png  Windows: the same tile, filling more of the square, as Windows icons do
//   resources/mark.png      the mark alone, for the page the browser shows after signing in
// electron-builder turns the PNGs into .icns and .ico. Run again if the mark changes:
//   node apps/desktop/scripts/icons.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const out = path.join(import.meta.dirname, "../resources");
const svg = await readFile(path.join(import.meta.dirname, "../../web/src/app/icon.svg"), "utf8");
const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

/** A rounded tile of `size` px at `inset`, with the mark at `markScale` of the tile. */
function tile({ inset, size, radius, shadow, markScale }) {
  const mark = size * markScale;
  const at = inset + (size - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="paper" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset=".55" stop-color="#F6F3FF"/>
      <stop offset="1" stop-color="#E9E2FB"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#B9A6FF" stop-opacity=".28"/>
      <stop offset="1" stop-color="#B9A6FF" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${shadow ? 12 : 0}" stdDeviation="${shadow ? 14 : 0}" flood-color="#2A1F5C" flood-opacity="${shadow ? 0.28 : 0}"/>
    </filter>
  </defs>
  <rect x="${inset}" y="${inset}" width="${size}" height="${size}" rx="${radius}" fill="url(#paper)" filter="url(#shadow)"/>
  <rect x="${inset}" y="${inset}" width="${size}" height="${size}" rx="${radius}" fill="url(#glow)"/>
  <rect x="${inset + 1}" y="${inset + 1}" width="${size - 2}" height="${size - 2}" rx="${radius - 1}" fill="none" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="2"/>
  <svg x="${at}" y="${at}" width="${mark}" height="${mark}" viewBox="${viewBox}">${inner}</svg>
</svg>`;
}

const png = (s, size = 1024) => sharp(Buffer.from(s), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

await writeFile(path.join(out, "icon.png"), await png(tile({ inset: 100, size: 824, radius: 185, shadow: true, markScale: 0.66 })));
await writeFile(path.join(out, "icon-win.png"), await png(tile({ inset: 24, size: 976, radius: 200, shadow: false, markScale: 0.7 })));
await writeFile(path.join(out, "mark.png"), await png(svg, 256));
console.log("Wrote resources/icon.png, icon-win.png and mark.png");
