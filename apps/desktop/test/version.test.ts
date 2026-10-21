import { describe, expect, it } from "vitest";
import { nextVersion } from "../scripts/version";

describe("release version", () => {
  it("starts at package.json's version", () => {
    expect(nextVersion([], "0.1.0", "patch")).toBe("0.1.0");
    expect(nextVersion(["mobile-1.0", "nightly"], "0.1.0", "minor")).toBe("0.1.0");
  });

  it("bumps the newest released version", () => {
    const tags = ["v0.1.0", "v0.1.1", "v0.10.0", "v0.2.3"];
    expect(nextVersion(tags, "0.1.0", "patch")).toBe("0.10.1");
    expect(nextVersion(tags, "0.1.0", "minor")).toBe("0.11.0");
    expect(nextVersion(tags, "0.1.0", "major")).toBe("1.0.0");
  });

  it("keeps a version raised by hand in package.json", () => {
    expect(nextVersion(["v0.3.2"], "1.0.0", "patch")).toBe("1.0.0");
    expect(nextVersion(["v0.3.2"], "0.3.3", "patch")).toBe("0.3.3");
  });

  it("refuses a package.json version it can't read", () => {
    expect(() => nextVersion([], "1.0", "patch")).toThrow();
  });
});
