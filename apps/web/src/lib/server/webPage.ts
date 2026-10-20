import "server-only";

// Fetching a web page for "Notes from a link", safely. Every connection is checked after its name is
// looked up, so neither a link, a redirect, nor a name that points at 127.0.0.1 can make the server
// read something inside its own network. Pages are capped in size and time.

import { lookup, type LookupAddress } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { pipeline, type Readable } from "node:stream";
import zlib from "node:zlib";
import { checkUrl, isPublicAddress } from "./webPageCore";

const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;

export class WebPageError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}

const PRIVATE_ERROR = "That address is on a private network, so Dovli can't read it.";

/** dns.lookup that refuses names pointing at private addresses (Node calls it for every connection). */
function safeLookup(hostname: string, options: any, callback: (...args: any[]) => void) {
  if (typeof options === "function") [callback, options] = [options, {}];
  const opts = typeof options === "number" ? { family: options } : (options ?? {});
  lookup(hostname, { ...opts, all: true }, (err, found: LookupAddress[]) => {
    if (err) return callback(err);
    if (!found.length || found.some((a) => !isPublicAddress(a.address))) return callback(Object.assign(new Error(PRIVATE_ERROR), { code: "EPRIVATE" }));
    if (opts.all) callback(null, found);
    else callback(null, found[0].address, found[0].family);
  });
}

// Dovli says who it is first. Some sites (Medium, for one) refuse any reader that isn't a browser,
// so a refused page is asked for once more the way a browser asks. Others (NYTimes) refuse readers
// that only claim to be a browser, which is why that isn't the first try.
const AS_DOVLI = {
  "user-agent": "Mozilla/5.0 (compatible; Dovli/1.0; +https://dovli.in)",
  accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
};
const AS_BROWSER = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "upgrade-insecure-requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
};

function request(url: URL, signal: AbortSignal, language: string, asBrowser: boolean): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const get = url.protocol === "https:" ? https.get : http.get;
    const req = get(
      url,
      {
        lookup: safeLookup as any,
        signal,
        headers: { ...(asBrowser ? AS_BROWSER : AS_DOVLI), "accept-encoding": "gzip, deflate, br", "accept-language": language },
      },
      resolve,
    );
    req.on("error", reject);
  });
}

function explainNetworkError(e: any, signal: AbortSignal): WebPageError {
  if (e?.code === "EPRIVATE") return new WebPageError(PRIVATE_ERROR, 400);
  if (signal.aborted || e?.name === "AbortError") return new WebPageError("That website took too long to answer. Try again, or try another link.", 504);
  if (e?.code === "ENOTFOUND" || e?.code === "EAI_AGAIN") return new WebPageError("Couldn't find that website. Check the link.", 422);
  if (/CERT|SSL|TLS/i.test(String(e?.code ?? ""))) return new WebPageError("That website's security certificate isn't valid, so Dovli didn't read it.", 422);
  return new WebPageError("Couldn't connect to that website. Check the link and try again.", 502);
}

function explainStatus(status: number, res: IncomingMessage): WebPageError {
  // Cloudflare's "checking your browser" page: it needs a real browser running its script.
  if (res.headers["cf-mitigated"] === "challenge")
    return new WebPageError("That website only opens in a real browser (it checks for one first), so Dovli can't read it. You can copy the text into a page and ask the assistant to make notes from it.");
  if (status === 401 || status === 403) return new WebPageError("That website didn't let Dovli read the page. It may need you to sign in, or it turns away automatic readers.");
  if (status === 404 || status === 410) return new WebPageError("That page doesn't exist (the website said “not found”). Check the link.");
  if (status === 429) return new WebPageError("That website is turning away requests right now. Try again in a minute.", 429);
  if (status >= 500) return new WebPageError("That website had a problem answering. Try again later.", 502);
  return new WebPageError(`That website answered with an error (${status}).`);
}

/** The body, unzipped, up to MAX_BYTES (a page cut short still reads fine). */
async function readBody(res: IncomingMessage): Promise<Buffer> {
  const encoding = String(res.headers["content-encoding"] ?? "").trim().toLowerCase();
  const unzip = encoding === "gzip" || encoding === "x-gzip" ? zlib.createGunzip() : encoding === "deflate" ? zlib.createInflate() : encoding === "br" ? zlib.createBrotliDecompress() : null;
  // pipeline passes errors along, so a dropped connection ends the loop below instead of hanging it.
  const body: Readable = unzip ? pipeline(res, unzip, () => {}) : res;
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of body) {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= MAX_BYTES) break;
    }
  } catch {
    if (!chunks.length) throw new WebPageError("That website stopped answering part-way. Try again.", 502);
  } finally {
    res.destroy();
  }
  return Buffer.concat(chunks);
}

function decode(bytes: Buffer, type: string): string {
  const head = bytes.subarray(0, 4096).toString("latin1");
  const label = /charset=["']?([\w-]+)/i.exec(type)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

/** Read a web page. `url` must already have passed checkUrl; each redirect is checked again. */
export async function fetchPage(start: URL, signal: AbortSignal, language = "en"): Promise<{ url: string; body: string; kind: "html" | "text" }> {
  let url = start;
  let asBrowser = false;
  for (let hop = 0; ; hop++) {
    let res: IncomingMessage;
    try {
      res = await request(url, signal, language, asBrowser);
    } catch (e) {
      throw explainNetworkError(e, signal);
    }
    const status = res.statusCode ?? 0;
    const location = res.headers.location;
    if (status >= 300 && status < 400 && location) {
      res.resume();
      if (hop >= MAX_REDIRECTS) throw new WebPageError("That link redirects too many times.");
      let next;
      try {
        next = checkUrl(new URL(location, url).href);
      } catch {
        throw new WebPageError("That link redirects somewhere that doesn't make sense.");
      }
      if (!next.ok) throw new WebPageError(next.error);
      url = next.url;
      continue;
    }
    if ((status === 401 || status === 403) && !asBrowser) {
      res.resume();
      asBrowser = true;
      hop--; // the same address again, not a redirect
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw explainStatus(status, res);
    }
    const type = String(res.headers["content-type"] ?? "").toLowerCase();
    if (type.includes("application/pdf")) {
      res.resume();
      throw new WebPageError("That link is a PDF. Dovli can only make notes from web pages for now.", 415);
    }
    if (type && !/text\/html|application\/xhtml\+xml|text\/plain/.test(type)) {
      res.resume();
      throw new WebPageError("That link isn't a web page (it's a file or something else Dovli can't read).", 415);
    }
    try {
      const bytes = await readBody(res);
      return { url: url.href, body: decode(bytes, type), kind: type.includes("text/plain") ? "text" : "html" };
    } catch (e) {
      throw e instanceof WebPageError ? e : explainNetworkError(e, signal);
    }
  }
}
