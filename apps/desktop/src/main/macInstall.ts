import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

// Installing a Mac update without macOS's own updater (src/main/updater.ts says when).
//
// macOS's updater (Squirrel.Mac) only installs an update signed by the same developer as the
// running app. A build signed "ad hoc" (no Apple Developer ID, which is how the workflow signs it
// until there's a certificate) has no developer, so Squirrel.Mac turns every update down. Here
// Dovli does it itself:
//   1. prepareUpdate: unzip the update electron-updater downloaded (it has already checked the zip
//      against the release's sha512), and check it's Dovli, at the new version, with its signature
//      intact.
//   2. scheduleSwap: start a small script that waits for Dovli to quit, moves the new app into the
//      old one's place (putting the old one back if anything fails), and opens it again.
// Nothing here needs Electron, so it can be tested on its own.

const run = promisify(execFile);

/** How a Mac app is signed. Only "developer-id" can update through Squirrel.Mac. */
export type MacSigning = "developer-id" | "ad-hoc" | "unsigned";

/** Reads `codesign -dv --verbose=2` (it answers on stderr). */
export function parseCodesign(output: string): MacSigning {
  if (/^Signature=adhoc\s*$/m.test(output)) return "ad-hoc";
  if (/^TeamIdentifier=(?!not set)\S+/m.test(output)) return "developer-id";
  return "unsigned";
}

export async function macSigning(bundle: string): Promise<MacSigning> {
  try {
    const { stderr } = await run("/usr/bin/codesign", ["-dv", "--verbose=2", bundle]);
    return parseCodesign(stderr);
  } catch (e) {
    // An unsigned app makes codesign fail; its message still says why.
    return parseCodesign(String((e as { stderr?: unknown }).stderr ?? ""));
  }
}

/** The .app a Mac executable sits in (…/Dovli.app/Contents/MacOS/Dovli), or null. */
export function bundleOf(exe: string): string | null {
  const bundle = path.resolve(exe, "../../..");
  return bundle.endsWith(".app") ? bundle : null;
}

/** Why the app at `bundle` can't replace itself, in words for the person; null when it can. */
export function cantReplace(bundle: string, writable: boolean): string | null {
  // macOS runs a downloaded app from a hidden, read-only copy until it's moved out of Downloads.
  if (bundle.includes("/AppTranslocation/"))
    return "Dovli is running from a temporary copy macOS made. Move Dovli into your Applications folder, open it from there, and updates will install themselves.";
  if (writable) return null;
  if (bundle.startsWith("/Volumes/"))
    return "Dovli is running from its disk image. Drag Dovli into your Applications folder, open it from there, and updates will install themselves.";
  return "Dovli can't change the folder it's installed in. Move Dovli into your Applications folder, or download the new version from dovli.in.";
}

/** Whether this user can replace the app: they need to write to it and to the folder it's in. */
export async function canWrite(bundle: string): Promise<boolean> {
  try {
    await fs.promises.access(path.dirname(bundle), fs.constants.W_OK);
    await fs.promises.access(bundle, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** A <string> value from an XML Info.plist (the kind electron-builder writes). */
export function plistString(xml: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`<key>${escaped}</key>\\s*<string>([^<]*)</string>`).exec(xml);
  return m ? m[1].trim() : null;
}

/** Checks an unpacked app is the update we expect. Throws a message for the person if not. */
export function checkInfo(xml: string, expected: { bundleId: string; version: string }) {
  const id = plistString(xml, "CFBundleIdentifier");
  if (id !== expected.bundleId) throw new Error(`The update isn't Dovli (it says it's ${id ?? "nothing"}).`);
  const version = plistString(xml, "CFBundleShortVersionString");
  if (version !== expected.version) throw new Error(`The update says it's version ${version ?? "unknown"}, not ${expected.version}.`);
}

/** Checks an unpacked app's signature still covers every file in it. */
export async function verifyApp(staged: string) {
  try {
    await run("/usr/bin/codesign", ["--verify", "--deep", staged]);
  } catch (e) {
    throw new Error(`The update's signature doesn't check out, so it wasn't installed. (${String((e as { stderr?: unknown }).stderr ?? e).trim()})`);
  }
}

/**
 * Unpacks the downloaded update into `dir` (emptied first) and checks it. Returns the new .app.
 * Takes a few seconds for Dovli's size, so it runs as soon as the download finishes, not at quit.
 */
export async function prepareUpdate(options: { zip: string; dir: string; bundleId: string; version: string }): Promise<string> {
  const { zip, dir } = options;
  await fs.promises.rm(dir, { recursive: true, force: true });
  await fs.promises.mkdir(dir, { recursive: true });
  // ditto keeps what a Mac app needs (symlinks inside the frameworks, permissions, signatures).
  await run("/usr/bin/ditto", ["-x", "-k", zip, dir]);
  const apps = (await fs.promises.readdir(dir)).filter((name) => name.endsWith(".app"));
  if (apps.length !== 1) throw new Error("The update didn't have Dovli in it.");
  const staged = path.join(dir, apps[0]);
  checkInfo(await fs.promises.readFile(path.join(staged, "Contents/Info.plist"), "utf8"), options);
  await verifyApp(staged);
  // Files Dovli downloads itself aren't quarantined, but be sure: a quarantined copy would make
  // macOS ask about it again on its first open.
  await run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", staged]).catch(() => {});
  return staged;
}

/**
 * The script that swaps the app once Dovli has quit. $1 Dovli's process id, $2 the new .app,
 * $3 the installed .app, $4 "1" to open it afterwards, $5 the folder the update was unpacked in.
 * /bin/sh on a Mac is bash 3.2, so it stays plain sh. Its output goes to updates.log.
 */
export const SWAP_SCRIPT = String.raw`
pid="$1"; new="$2"; app="$3"; relaunch="$4"; stage="$5"
stamp() { date "+%Y-%m-%dT%H:%M:%S"; }
case "$app" in */*.app) ;; *) echo "$(stamp) swap: $app isn't an app; nothing changed"; exit 1 ;; esac
case "$new" in */*.app) ;; *) echo "$(stamp) swap: $new isn't an app; nothing changed"; exit 1 ;; esac
[ -n "$stage" ] || stage="$(dirname "$new")"
i=0
while kill -0 "$pid" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 600 ]; then echo "$(stamp) swap: Dovli didn't quit within a minute; update left for next time"; exit 1; fi
  sleep 0.1
done
if [ ! -d "$new" ]; then echo "$(stamp) swap: the unpacked update is gone; nothing changed"; [ "$relaunch" = 1 ] && open "$app"; exit 1; fi
old="$(dirname "$app")/.$(basename "$app" .app)-previous.app"
rm -rf "$old"
# If a leftover copy can't be cleared, mv would put the app inside it rather than rename it.
if [ -e "$old" ]; then echo "$(stamp) swap: couldn't clear $old; nothing changed"; [ "$relaunch" = 1 ] && open "$app"; exit 1; fi
if ! mv "$app" "$old"; then
  echo "$(stamp) swap: couldn't move the old app aside; nothing changed"
  [ "$relaunch" = 1 ] && open "$app"
  exit 1
fi
if mv "$new" "$app"; then
  rm -rf "$old" "$stage"
  touch "$app"
  echo "$(stamp) swap: installed the update at $app"
else
  rm -rf "$app"
  if [ -e "$app" ]; then
    echo "$(stamp) swap: couldn't move the update in or clear it; the previous app is at $old"
    exit 1
  fi
  mv "$old" "$app"
  echo "$(stamp) swap: couldn't move the update in; put the old app back"
fi
[ "$relaunch" = 1 ] && open "$app"
exit 0
`;

/** Starts the swap script, detached so it outlives Dovli. Dovli should quit right after. */
export function scheduleSwap(options: { pid: number; staged: string; installed: string; stage: string; relaunch: boolean; log: string }) {
  const out = fs.openSync(options.log, "a");
  try {
    const args = [String(options.pid), options.staged, options.installed, options.relaunch ? "1" : "0", options.stage];
    spawn("/bin/sh", ["-c", SWAP_SCRIPT, "dovli-update", ...args], { detached: true, stdio: ["ignore", out, out] }).unref();
  } finally {
    fs.closeSync(out);
  }
}

/** Compares x.y.z versions (anything after the numbers, like -beta, is ignored). */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(/[.-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** Removes unpacked updates for versions this copy already is (or is past). */
export async function clearOldStages(root: string, current: string) {
  let names: string[];
  try {
    names = await fs.promises.readdir(root);
  } catch {
    return;
  }
  await Promise.all(names.filter((v) => compareVersions(v, current) <= 0).map((v) => fs.promises.rm(path.join(root, v), { recursive: true, force: true })));
}
