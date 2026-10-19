import { describe, expect, it } from "vitest";
import { APP_PATH, loginUrl, safeNext, sessionLooksLive } from "./authGate";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const cookie = (claims: object) => `${b64({ alg: "RS256" })}.${b64(claims)}.signature`;

describe("where to go after signing in", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app#p-abc")).toBe("/app#p-abc");
    expect(safeNext(["/x", "/y"])).toBe("/x");
  });
  it("sends the landing page and old page links on to the app", () => {
    expect(safeNext("/")).toBe(APP_PATH);
    expect(safeNext("/#p-abc")).toBe("/app#p-abc");
    expect(safeNext(undefined)).toBe(APP_PATH);
  });
  it("refuses other websites and loops back to sign-in", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", undefined, 42, "/login", "/signup?next=/"]) expect(safeNext(bad)).toBe(APP_PATH);
  });
  it("builds the sign-in address", () => {
    expect(loginUrl("/app")).toBe("/login");
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("/app?x=1")).toBe("/login?next=%2Fapp%3Fx%3D1");
    expect(loginUrl("/app", "/signup")).toBe("/signup");
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
