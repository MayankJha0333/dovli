import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAppProtocol, forwardHeaders, resolveFile } from "../src/main/protocol";

const root = path.resolve("/app/dist/renderer");
const files: Record<string, string> = {
  [path.join(root, "index.html")]: "<html>app</html>",
  [path.join(root, "assets/app.js")]: "console.log(1)",
};
const readFile = async (file: string) => (file in files ? new Response(files[file]) : null);

function setup(fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"rows":[]}', { status: 200 }))) {
  return { handle: createAppProtocol({ root, site: "https://dovli.in", fetch: fetchImpl, readFile }), fetchImpl };
}

describe("resolveFile", () => {
  it("finds files inside the app and nothing outside it", () => {
    expect(resolveFile(root, "/assets/app.js")).toBe(path.join(root, "assets/app.js"));
    expect(resolveFile(root, "/assets/%61pp.js")).toBe(path.join(root, "assets/app.js"));
    expect(resolveFile(root, "/../../etc/passwd")).toBe(path.join(root, "etc/passwd"));
    expect(resolveFile(root, "/%2e%2e/%2e%2e/secret")).toBe(path.join(root, "secret"));
    expect(resolveFile(root, "/bad%zz")).toBeNull();
    expect(resolveFile(root, "/a%00b")).toBeNull();
  });
});

describe("app:// protocol", () => {
  it("serves the app's files, and its page for in-app paths", async () => {
    const { handle } = setup();
    expect(await (await handle(new Request("app://dovli/assets/app.js"))).text()).toBe("console.log(1)");
    expect(await (await handle(new Request("app://dovli/"))).text()).toBe("<html>app</html>");
    expect(await (await handle(new Request("app://dovli/login?next=%2Fapp"))).text()).toBe("<html>app</html>");
    expect((await handle(new Request("app://dovli/assets/missing.js"))).status).toBe(404);
    // URLs settle "../" before the handler sees them, so this is just an in-app path.
    expect(await (await handle(new Request("app://dovli/../../etc/passwd"))).text()).toBe("<html>app</html>");
    expect((await handle(new Request("app://elsewhere/"))).status).toBe(404);
    expect((await handle(new Request("app://dovli/", { method: "POST", body: "x" }))).status).toBe(405);
  });

  it("forwards /api to Dovli's server as Dovli's own page, without the window's cookies", async () => {
    const { handle, fetchImpl } = setup();
    const res = await handle(
      new Request("app://dovli/api/sync/pull?x=1", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer t", origin: "app://dovli", cookie: "a=b" },
        body: JSON.stringify({ cursor: 3 }),
      }),
    );
    expect(await res.json()).toEqual({ rows: [] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://dovli.in/api/sync/pull?x=1");
    const headers = init.headers as Headers;
    expect(init.method).toBe("POST");
    expect(headers.get("authorization")).toBe("Bearer t");
    expect(headers.get("origin")).toBe("https://dovli.in");
    expect(headers.get("cookie")).toBeNull();
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"cursor":3}');
  });

  it("sends no body with GET, and passes the server's answer through as it is", async () => {
    const { handle, fetchImpl } = setup(vi.fn(async () => new Response("slow down", { status: 429 })));
    const res = await handle(new Request("app://dovli/api/ai/models"));
    expect(res.status).toBe(429);
    expect(fetchImpl.mock.calls[0][1].body).toBeUndefined();
  });

  it("fails like a browser does when there's no network, so sync knows it's offline", async () => {
    const { handle } = setup(vi.fn(async () => Promise.reject(new TypeError("net::ERR_INTERNET_DISCONNECTED"))));
    await expect(handle(new Request("app://dovli/api/sync/pull", { method: "POST", body: "{}" }))).rejects.toThrow(/INTERNET_DISCONNECTED/);
  });
});

describe("forwardHeaders", () => {
  it("leaves out what the connection sets itself", () => {
    const h = forwardHeaders(new Headers({ host: "dovli", "content-length": "3", referer: "app://dovli/", accept: "application/json" }), "http://localhost:3000");
    expect([...h.keys()]).toEqual(["accept"]);
  });
});
