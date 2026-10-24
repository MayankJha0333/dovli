import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SWAP_SCRIPT, bundleOf, cantReplace, checkInfo, clearOldStages, compareVersions, parseCodesign, plistString } from "../src/main/macInstall";

const tmp: string[] = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dovli-update-"));
  tmp.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of tmp.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("Mac signing", () => {
  it("tells ad hoc, Developer ID and unsigned apart", () => {
    expect(parseCodesign("Executable=/Applications/Dovli.app/Contents/MacOS/Dovli\nIdentifier=app.dovli.desktop\nSignature=adhoc\nTeamIdentifier=not set\n")).toBe("ad-hoc");
    expect(parseCodesign("Identifier=app.dovli.desktop\nAuthority=Developer ID Application: Dovli (AB12CD34EF)\nTeamIdentifier=AB12CD34EF\n")).toBe("developer-id");
    expect(parseCodesign("/Applications/Dovli.app: code object is not signed at all\n")).toBe("unsigned");
  });
});

describe("where the app is", () => {
  it("finds the .app from its executable", () => {
    expect(bundleOf("/Applications/Dovli.app/Contents/MacOS/Dovli")).toBe("/Applications/Dovli.app");
    expect(bundleOf("/usr/local/bin/dovli")).toBeNull();
  });

  it("says why it can't replace itself", () => {
    expect(cantReplace("/Applications/Dovli.app", true)).toBeNull();
    expect(cantReplace("/private/var/folders/x/AppTranslocation/1234/d/Dovli.app", true)).toMatch(/Applications folder/);
    expect(cantReplace("/Volumes/Dovli 1.0.1/Dovli.app", false)).toMatch(/disk image/);
    expect(cantReplace("/Applications/Dovli.app", false)).toMatch(/can't change/);
  });
});

describe("checking the update", () => {
  const plist = `<?xml version="1.0"?><plist version="1.0"><dict>
    <key>CFBundleIdentifier</key>
    <string>app.dovli.desktop</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.2</string>
  </dict></plist>`;

  it("reads Info.plist strings", () => {
    expect(plistString(plist, "CFBundleIdentifier")).toBe("app.dovli.desktop");
    expect(plistString(plist, "CFBundleName")).toBeNull();
  });

  it("only takes Dovli at the expected version", () => {
    expect(() => checkInfo(plist, { bundleId: "app.dovli.desktop", version: "1.0.2" })).not.toThrow();
    expect(() => checkInfo(plist, { bundleId: "app.dovli.desktop", version: "1.0.3" })).toThrow(/1\.0\.2, not 1\.0\.3/);
    expect(() => checkInfo(plist, { bundleId: "com.example.other", version: "1.0.2" })).toThrow(/isn't Dovli/);
  });

  it("compares versions", () => {
    expect(compareVersions("1.0.10", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.1", "1.0.1")).toBe(0);
    expect(compareVersions("0.9.0", "1.0.0")).toBeLessThan(0);
  });

  it("clears unpacked updates this copy already has", async () => {
    const root = tempDir();
    for (const v of ["1.0.0", "1.0.1", "1.0.2"]) fs.mkdirSync(path.join(root, v));
    await clearOldStages(root, "1.0.1");
    expect(fs.readdirSync(root)).toEqual(["1.0.2"]);
  });
});

// The script that swaps the app, run for real against folders standing in for apps.
describe("swapping the app", () => {
  const setup = () => {
    const dir = tempDir();
    const installed = path.join(dir, "Applications/Dovli.app");
    const stage = path.join(dir, "update/1.0.2");
    const staged = path.join(stage, "Dovli.app");
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(path.join(installed, "version"), "1.0.1");
    fs.mkdirSync(staged, { recursive: true });
    fs.writeFileSync(path.join(staged, "version"), "1.0.2");
    return { dir, installed, stage, staged };
  };
  const swap = (pid: number, staged: string, installed: string, stage: string) =>
    execFileSync("/bin/sh", ["-c", SWAP_SCRIPT, "dovli-update", String(pid), staged, installed, "0", stage], { encoding: "utf8" });

  it("waits for Dovli to quit, then moves the new app in", async () => {
    const { dir, installed, stage, staged } = setup();
    // A stand-in for Dovli that isn't this test's child (a child would linger as a zombie while
    // the test waits, as a real app's process doesn't).
    const pid = Number(execFileSync("/bin/sh", ["-c", "sleep 0.5 >/dev/null 2>&1 & echo $!"], { encoding: "utf8" }).trim());
    const started = Date.now();
    const out = swap(pid, staged, installed, stage);
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
    expect(out).toMatch(/installed the update/);
    expect(fs.readFileSync(path.join(installed, "version"), "utf8")).toBe("1.0.2");
    expect(fs.existsSync(stage)).toBe(false);
    expect(fs.readdirSync(path.join(dir, "Applications"))).toEqual(["Dovli.app"]);
  });

  it("leaves the old app alone when the update has gone", () => {
    const { installed, stage, staged } = setup();
    fs.rmSync(stage, { recursive: true });
    const out = (() => {
      try {
        return swap(999_999, staged, installed, stage);
      } catch (e) {
        return String((e as { stdout?: string }).stdout);
      }
    })();
    expect(out).toMatch(/nothing changed/);
    expect(fs.readFileSync(path.join(installed, "version"), "utf8")).toBe("1.0.1");
  });
});

describe("swap safety", () => {
  it("refuses anything that isn't an .app", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dovli-update-"));
    tmp.push(dir);
    fs.writeFileSync(path.join(dir, "keep"), "x");
    let out = "";
    try {
      execFileSync("/bin/sh", ["-c", SWAP_SCRIPT, "dovli-update", "999999", path.join(dir, "new.app"), dir, "0", ""], { encoding: "utf8" });
    } catch (e) {
      out = String((e as { stdout?: string }).stdout);
    }
    expect(out).toMatch(/isn't an app/);
    expect(fs.existsSync(path.join(dir, "keep"))).toBe(true);
  });
});

describe("swap with a leftover previous copy", () => {
  it("stops rather than moving the app inside a folder it can't clear", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dovli-update-"));
    tmp.push(dir);
    const apps = path.join(dir, "Applications");
    const installed = path.join(apps, "Dovli.app");
    const stage = path.join(dir, "update/1.0.2");
    const staged = path.join(stage, "Dovli.app");
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(path.join(installed, "version"), "1.0.1");
    fs.mkdirSync(staged, { recursive: true });
    // A fake rm that can't delete anything stands in for a leftover that won't clear.
    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(apps, ".Dovli-previous.app"));
    fs.writeFileSync(path.join(bin, "rm"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    let out = "";
    try {
      execFileSync("/bin/sh", ["-c", SWAP_SCRIPT, "dovli-update", "999999", staged, installed, "0", stage], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
    } catch (e) {
      out = String((e as { stdout?: string }).stdout);
    }
    expect(out).toMatch(/couldn't clear/);
    expect(fs.readFileSync(path.join(installed, "version"), "utf8")).toBe("1.0.1");
    expect(fs.readdirSync(path.join(apps, ".Dovli-previous.app"))).toEqual([]);
  });
});
