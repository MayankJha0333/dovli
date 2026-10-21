import { describe, expect, it } from "vitest";
import { detectOs, formatSize, parseRelease } from "./desktopRelease";

const asset = (name: string, size = 230_000_000) => ({ name, size, browser_download_url: `https://github.com/x/y/releases/download/v1.2.0/${name}` });
const release = (over: Record<string, unknown> = {}) => ({
  tag_name: "v1.2.0",
  draft: false,
  prerelease: false,
  published_at: "2026-10-22T10:00:00Z",
  html_url: "https://github.com/x/y/releases/tag/v1.2.0",
  assets: [
    asset("Dovli-1.2.0-mac-universal.dmg"),
    asset("Dovli-1.2.0-mac-universal.zip"),
    asset("Dovli-1.2.0-mac-universal.dmg.blockmap", 200_000),
    asset("Dovli-1.2.0-win-setup.exe", 180_000_000),
    asset("latest.yml", 400),
    asset("latest-mac.yml", 500),
  ],
  ...over,
});

describe("desktop release", () => {
  it("picks the disk image and the installer, not the update files", () => {
    expect(parseRelease(release())).toEqual({
      version: "1.2.0",
      publishedAt: "2026-10-22T10:00:00Z",
      notesUrl: "https://github.com/x/y/releases/tag/v1.2.0",
      mac: { name: "Dovli-1.2.0-mac-universal.dmg", url: "https://github.com/x/y/releases/download/v1.2.0/Dovli-1.2.0-mac-universal.dmg", size: 230_000_000 },
      windows: { name: "Dovli-1.2.0-win-setup.exe", url: "https://github.com/x/y/releases/download/v1.2.0/Dovli-1.2.0-win-setup.exe", size: 180_000_000 },
    });
  });

  it("offers what's there when only one system was built", () => {
    const r = parseRelease(release({ assets: [asset("Dovli-1.2.0-mac-universal.dmg")] }));
    expect(r?.mac?.name).toBe("Dovli-1.2.0-mac-universal.dmg");
    expect(r?.windows).toBeNull();
  });

  it("says nothing for drafts, pre-releases, odd tags, no installers or a broken answer", () => {
    expect(parseRelease(release({ draft: true }))).toBeNull();
    expect(parseRelease(release({ prerelease: true }))).toBeNull();
    expect(parseRelease(release({ tag_name: "nightly" }))).toBeNull();
    expect(parseRelease(release({ assets: [asset("latest.yml")] }))).toBeNull();
    expect(parseRelease({ message: "Not Found" })).toBeNull();
    expect(parseRelease(null)).toBeNull();
  });

  it("knows the visitor's computer", () => {
    expect(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel")).toBe("mac");
    expect(detectOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32")).toBe("windows");
    expect(detectOs("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", "MacIntel")).toBe("other");
    expect(detectOs("Mozilla/5.0 (Linux; Android 15)")).toBe("other");
    expect(detectOs("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
  });

  it("writes sizes in megabytes", () => {
    expect(formatSize(234_698_725)).toBe("235 MB");
    expect(formatSize(1)).toBe("1 MB");
  });
});
