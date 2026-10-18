import { describe, expect, it } from "vitest";
import { loginUrl, safeNext, sessionLooksLive } from "./authGate";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const cookie = (claims: object) => `${b64({ alg: "RS256" })}.${b64(claims)}.signature`;

describe("where to go after signing in", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/#p-abc")).toBe("/#p-abc");
    expect(safeNext(["/x", "/y"])).toBe("/x");
  });
  it("refuses other websites and loops back to sign-in", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", undefined, 42, "/login", "/signup?next=/"]) expect(safeNext(bad)).toBe("/");
  });
  it("builds the sign-in address", () => {
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("/?x=1")).toBe("/login?next=%2F%3Fx%3D1");
    expect(loginUrl("/", "/signup")).toBe("/signup");
  });
});

describe("the quick cookie check", () => {
  const now = 1_800_000_000;
  it("accepts a live cookie for this project", () => {
    expect(sessionLooksLive(cookie({ exp: now + 60, aud: "dovli" }), "dovli", now)).toBe(true);
  });
  it("refuses expired, other-project, missing and junk cookies", () => {
    expect(sessionLooksLive(cookie({ exp: now - 1, aud: "dovli" }), "dovli", now)).toBe(false);
    expect(sessionLooksLive(cookie({ exp: now + 60, aud: "other" }), "dovli", now)).toBe(false);
    expect(sessionLooksLive(undefined, "dovli", now)).toBe(false);
    expect(sessionLooksLive("not-a-cookie", "dovli", now)).toBe(false);
    expect(sessionLooksLive("a.%%%.c", "dovli", now)).toBe(false);
  });
});
