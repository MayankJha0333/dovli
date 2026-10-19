import { describe, expect, it } from "vitest";
import { redactUrl } from "./analytics";

describe("addresses sent to analytics", () => {
  it("groups shared and invited page links, without their ids", () => {
    expect(redactUrl("https://dovli.app/s/abc123")).toBe("https://dovli.app/s/[id]");
    expect(redactUrl("https://dovli.app/p/ws_1/pg_2")).toBe("https://dovli.app/p/[workspace]/[page]");
  });
  it("drops page ids after # and private query values, keeps campaign tags", () => {
    expect(redactUrl("https://dovli.app/app#p-xyz")).toBe("https://dovli.app/app");
    expect(redactUrl("https://dovli.app/login?next=%2Fapp%23p-1&utm_source=x")).toBe("https://dovli.app/login?utm_source=x");
  });
  it("leaves ordinary pages alone", () => {
    expect(redactUrl("https://dovli.app/")).toBe("https://dovli.app/");
  });
});
