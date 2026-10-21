// The version the next desktop release gets, for the Desktop workflow (.github/workflows/desktop.yml):
//   node apps/desktop/scripts/version.ts patch|minor|major
// Released versions are the repo's v1.2.3 tags (GitHub makes the tag when a release is published).
// The first release, and any version raised by hand in package.json, use package.json's version.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export type Bump = "patch" | "minor" | "major";
type Parts = [number, number, number];

const parse = (v: string): Parts | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const compare = (a: Parts, b: Parts) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function nextVersion(tags: string[], packageVersion: string, bump: Bump): string {
  const own = parse(packageVersion);
  if (!own) throw new Error(`package.json version "${packageVersion}" isn't x.y.z`);
  const released = tags.map(parse).filter((p): p is Parts => p !== null).sort(compare).at(-1);
  if (!released) return own.join(".");
  const [major, minor, patch] = released;
  const bumped: Parts = bump === "major" ? [major + 1, 0, 0] : bump === "minor" ? [major, minor + 1, 0] : [major, minor, patch + 1];
  return (compare(own, bumped) > 0 ? own : bumped).join(".");
}

if (import.meta.main) {
  const bump = process.argv[2] as Bump;
  if (!["patch", "minor", "major"].includes(bump)) {
    console.error("Usage: node scripts/version.ts patch|minor|major");
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(path.join(import.meta.dirname, "../package.json"), "utf8")) as { version: string };
  const tags = execFileSync("git", ["tag", "--list", "v*"], { encoding: "utf8" }).split("\n").filter(Boolean);
  console.log(nextVersion(tags, pkg.version, bump));
}
