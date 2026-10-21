import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { CodeError } from "./emailCodeCore";

// How the desktop app signs in: OAuth's pattern for native apps (RFC 8252), with PKCE.
//   1. The app makes a secret `verifier` and opens /desktop/sign-in in the system browser with its
//      SHA-256 (the `challenge`) and the port of a small server it runs on 127.0.0.1.
//   2. The person signs in on that page. `start` takes that fresh sign-in and the challenge, and
//      keeps them for two minutes under a random one-time `code`.
//   3. The page sends the browser to http://127.0.0.1:<port>/done?code=…, where the app hears it.
//   4. The app sends the code and its verifier to `redeem` and gets a Firebase custom token. Only
//      the app knows the verifier, so a code seen anywhere else (browser history, another program
//      on the computer) is useless. Each code works once, and only its hash is stored.

export const DESKTOP_CODES = "authDesktopCodes";
export const DESKTOP_CODE_SECONDS = 120;

export interface DesktopCode {
  uid: string;
  signInMethod: string | null;
  challenge: string;
  expiresAt: Date;
}

export interface DesktopCodeStore {
  put(id: string, code: DesktopCode): Promise<void>;
  /** Read and delete in one step, so a code can't be used twice. */
  take(id: string): Promise<DesktopCode | undefined>;
}

export interface DesktopAuthDeps {
  store: DesktopCodeStore;
  /** A Firebase custom token for this account. */
  mint(uid: string, signInMethod: string | null): Promise<string>;
  now?: () => number;
}

const b64url = (b: Buffer) => b.toString("base64url");
const sha256 = (s: string) => createHash("sha256").update(s).digest();
/** 32 random bytes, base64url: what the app's verifier and our codes look like. */
const TOKEN_LIKE = /^[A-Za-z0-9_-]{43}$/;

export function createDesktopAuth({ store, mint, now = () => Date.now() }: DesktopAuthDeps) {
  async function start(user: { uid: string; signInMethod?: string }, challenge: unknown): Promise<{ code: string }> {
    if (typeof challenge !== "string" || !TOKEN_LIKE.test(challenge)) throw new CodeError("bad_request", "Open this page from the Dovli app to sign in.", 400);
    const code = b64url(randomBytes(32));
    await store.put(b64url(sha256(code)), { uid: user.uid, signInMethod: user.signInMethod ?? null, challenge, expiresAt: new Date(now() + DESKTOP_CODE_SECONDS * 1000) });
    return { code };
  }

  async function redeem(code: unknown, verifier: unknown): Promise<{ token: string }> {
    if (typeof code !== "string" || !TOKEN_LIKE.test(code) || typeof verifier !== "string" || !TOKEN_LIKE.test(verifier))
      throw new CodeError("bad_request", "That sign-in didn't work. Please try again.", 400);
    const saved = await store.take(b64url(sha256(code)));
    if (!saved || saved.expiresAt.getTime() < now()) throw new CodeError("expired", "That sign-in took too long. Please try again.", 410);
    const expected = Buffer.from(saved.challenge);
    const actual = Buffer.from(b64url(sha256(verifier)));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new CodeError("invalid_code", "That sign-in didn't work. Please try again.", 400);
    return { token: await mint(saved.uid, saved.signInMethod) };
  }

  return { start, redeem };
}

/** For tests and local runs without Firestore. */
export function memoryDesktopCodes(): DesktopCodeStore {
  const codes = new Map<string, DesktopCode>();
  return {
    put: async (id, c) => void codes.set(id, { ...c }),
    async take(id) {
      const c = codes.get(id);
      codes.delete(id);
      return c;
    },
  };
}
