import { describe, expect, it } from "vitest";
import { redactUrl } from "./analytics";

describe("addresses sent to analytics", () => {
  it("groups shared and invited page links, without their ids", () => {
    expect(redactUrl("https://dovli.in/s/abc123")).toBe("https://dovli.in/s/[id]");
    expect(redactUrl("https://dovli.in/p/ws_1/pg_2")).toBe("https://dovli.in/p/[workspace]/[page]");
  });
  it("drops page ids after # and private query values, keeps campaign tags", () => {
    expect(redactUrl("https://dovli.in/app#p-xyz")).toBe("https://dovli.in/app");
    expect(redactUrl("https://dovli.in/login?next=%2Fapp%23p-1&utm_source=x")).toBe("https://dovli.in/login?utm_source=x");
  });
  it("leaves ordinary pages alone", () => {
    expect(redactUrl("https://dovli.in/")).toBe("https://dovli.in/");
  });
});
