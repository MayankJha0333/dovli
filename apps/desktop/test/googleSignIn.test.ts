import { createHash } from "node:crypto";
import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startGoogleSignIn, type GoogleSignIn } from "../src/main/googleSignIn";

// The real loopback server, with the browser played by plain HTTP requests.

const code = "c".repeat(43);
let flow: GoogleSignIn | null = null;
afterEach(() => flow?.cancel());

/** A browser visiting the app's address (Host as the browser would send it, unless given). */
function visit(port: number, path: string, host = `127.0.0.1:${port}`): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, headers: { host } }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

function start(redeem = vi.fn(async () => "custom-token"), timeoutMs?: number) {
  const opened: string[] = [];
  const focusApp = vi.fn();
  flow = startGoogleSignIn({ site: "https://dovli.in", openExternal: async (u) => void opened.push(u), redeem, focusApp, timeoutMs });
  return { flow, opened, redeem, focusApp };
}

describe("Google sign-in through the browser", () => {
  it("opens the sign-in page with a challenge, and swaps the returned code for a token", async () => {
    const { flow, opened, redeem, focusApp } = start();
    const port = await flow.port;
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    const page = new URL(opened[0]);
    expect(page.origin + page.pathname).toBe("https://dovli.in/desktop/sign-in");
    expect(page.searchParams.get("port")).toBe(String(port));

    const res = await visit(port, `/done?code=${code}`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("You're signed in");
    expect(await flow.result).toBe("custom-token");
    expect(focusApp).toHaveBeenCalled();

    // The verifier sent with the code is the one behind the challenge in the page's address.
    const [sentCode, verifier] = redeem.mock.calls[0] as unknown as [string, string];
    expect(sentCode).toBe(code);
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(page.searchParams.get("challenge"));
  });

  it("only listens to its own address and path", async () => {
    const { flow, redeem } = start();
    const port = await flow.port;
    expect((await visit(port, `/done?code=${code}`, `evil.example:${port}`)).status).toBe(404);
    expect((await visit(port, `/other?code=${code}`)).status).toBe(404);
    expect((await visit(port, "/done?code=short")).status).toBe(400);
    expect(redeem).not.toHaveBeenCalled();
  });

  it("shows why it failed, in the browser and the app", async () => {
    const { flow } = start(vi.fn(async () => Promise.reject(new Error("That sign-in took too long. Please try again."))));
    const failed = flow.result.catch((e: Error) => e);
    const port = await flow.port;
    const res = await visit(port, `/done?code=${code}`);
    expect(res.status).toBe(400);
    expect(res.body).toContain("That sign-in took too long.");
    expect(await failed).toMatchObject({ message: "That sign-in took too long. Please try again." });
  });

  it("can be cancelled, and gives up after a while", async () => {
    const a = start();
    await a.flow.port;
    a.flow.cancel();
    expect(await a.flow.result).toBeNull();

    const b = start(undefined, 50);
    expect(await b.flow.result).toBeNull();
  });

  it("stops listening once it's done", async () => {
    const { flow } = start();
    const port = await flow.port;
    await visit(port, `/done?code=${code}`);
    await flow.result;
    await expect(visit(port, `/done?code=${code}`)).rejects.toThrow();
  });
});
