import path from "node:path";

// The window loads app://dovli/, which this answers:
//   /api/…     forwarded to Dovli's server, so the web app's own calls (fetch("/api/sync/pull"))
//              work unchanged and stay same-origin. With no network the fetch fails, exactly as
//              it would in a browser tab, and the sync engine waits to retry.
//   anything   a file from the built app (dist/renderer), or the app's page for in-app paths
//              (/login, /app…), as a website's server would answer.

export const APP_SCHEME = "app";
export const APP_HOST = "dovli";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

export interface AppProtocolDeps {
  /** dist/renderer */
  root: string;
  /** Dovli's server, e.g. https://dovli.in */
  site: string;
  /** Network requests (Electron's net.fetch). */
  fetch: (url: string, init: RequestInit & { duplex?: "half" }) => Promise<Response>;
  /** Read a file from `root`, or null if there's none. */
  readFile: (file: string) => Promise<Response | null>;
}

/** The file for a URL path, or null when the path tries to leave `root`. */
export function resolveFile(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const file = path.resolve(root, `.${path.posix.normalize(`/${decoded}`)}`);
  return file === root || file.startsWith(root + path.sep) ? file : null;
}

/** Headers for the forwarded request: none of the window's cookies, and the site's own origin. */
export function forwardHeaders(from: Headers, site: string): Headers {
  const headers = new Headers(from);
  for (const h of ["host", "cookie", "referer", "connection", "content-length"]) headers.delete(h);
  // The server refuses requests sent from other websites (lib/server/http.ts sameOrigin); this is
  // Dovli's own app, so it says it's from Dovli.
  if (headers.has("origin")) headers.set("origin", new URL(site).origin);
  return headers;
}

export function createAppProtocol({ root, site, fetch, readFile }: AppProtocolDeps) {
  const index = path.join(root, "index.html");

  async function api(req: Request, url: URL): Promise<Response> {
    const target = new URL(url.pathname + url.search, site).toString();
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    return fetch(target, {
      method: req.method,
      headers: forwardHeaders(req.headers, site),
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
    });
  }

  async function file(url: URL): Promise<Response> {
    const found = resolveFile(root, url.pathname);
    if (!found) return new Response("Not found", { status: 404 });
    const res = found !== root ? await readFile(found) : null;
    if (res) return res;
    // An in-app path (no file extension) gets the app's page; a missing file stays missing.
    if (!path.extname(found)) return (await readFile(index)) ?? new Response("Not found", { status: 404 });
    return new Response("Not found", { status: 404 });
  }

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.host !== APP_HOST) return new Response("Not found", { status: 404 });
    if (url.pathname.startsWith("/api/")) return api(req, url);
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    return file(url);
  };
}
