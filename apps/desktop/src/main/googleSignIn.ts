import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { donePage } from "./pages";

// Signing in through the system browser, which can show Google's page (an app window can't).
// The app's half of the handshake in apps/web/src/lib/server/desktopAuthCore.ts:
//   1. Make a secret verifier, and listen on 127.0.0.1 (a port the system picks).
//   2. Open <site>/desktop/sign-in?port=…&challenge=<SHA-256 of the verifier>.
//   3. After signing in there, the browser comes to http://127.0.0.1:<port>/done?code=….
//   4. Swap the code and the verifier for a Firebase custom token at the server.

export interface GoogleSignInDeps {
  site: string;
  openExternal(url: string): Promise<void>;
  /** POST /api/auth/desktop/redeem: the code and verifier for a custom token. */
  redeem(code: string, verifier: string): Promise<string>;
  /** Bring the app back to the front once the browser is done. */
  focusApp?(): void;
  timeoutMs?: number;
}

export interface GoogleSignIn {
  /** The custom token, or null when cancelled or timed out. Rejects when the server refused. */
  result: Promise<string | null>;
  cancel(): void;
  /** Where the browser comes back to (for tests). */
  port: Promise<number>;
}

export function startGoogleSignIn({ site, openExternal, redeem, focusApp, timeoutMs = 10 * 60_000 }: GoogleSignInDeps): GoogleSignIn {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let settle!: (token: string | null, error?: Error) => void;
  let handled = false;
  let port = 0;

  const result = new Promise<string | null>((resolve, reject) => {
    settle = (token, error) => {
      clearTimeout(timer);
      server.close();
      server.closeAllConnections?.();
      if (error) reject(error);
      else resolve(token);
      settle = () => {};
    };
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    // Only this exact address: a web page can't reach us through a look-alike name (DNS rebinding).
    if (req.headers.host !== `127.0.0.1:${port}` || req.method !== "GET" || url.pathname !== "/done") {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    const code = url.searchParams.get("code") ?? "";
    if (handled || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(donePage("error", "This sign-in link was already used. Go back to Dovli and try again."));
      return;
    }
    handled = true;
    try {
      const token = await redeem(code, verifier);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(donePage("ok"));
      focusApp?.();
      settle(token);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign-in didn't work. Please try again.";
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(donePage("error", message));
      focusApp?.();
      settle(null, new Error(message));
    }
  });

  const timer = setTimeout(() => settle(null), timeoutMs);

  const listening = new Promise<number>((resolve, reject) => {
    server.once("error", (e) => {
      reject(e);
      settle(null, new Error("Couldn't start signing in. Please try again."));
    });
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      resolve(port);
      openExternal(`${site}/desktop/sign-in?port=${port}&challenge=${challenge}`).catch(() =>
        settle(null, new Error("Couldn't open your web browser. Please try again.")),
      );
    });
  });
  listening.catch(() => {});

  return { result, cancel: () => settle(null), port: listening };
}
