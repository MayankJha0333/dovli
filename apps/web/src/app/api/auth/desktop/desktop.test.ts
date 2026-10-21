import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Both routes for real, with Firebase Admin faked: ID tokens are "<uid>:<auth_time>:<provider>[:<claim>]",
// and codes live in memory (as with the Auth emulator and no Firestore).
const minted: { uid: string; claims?: object }[] = [];
const fakeAuth = {
  async verifyIdToken(token: string) {
    const [uid, authTime, provider, claim] = token.split(":");
    if (uid === "revoked") throw Object.assign(new Error("revoked"), { code: "auth/id-token-revoked" });
    if (uid === "disabled") throw Object.assign(new Error("disabled"), { code: "auth/user-disabled" });
    return { uid, auth_time: Number(authTime), firebase: { sign_in_provider: provider }, signInMethod: claim };
  },
  async createCustomToken(uid: string, claims?: object) {
    minted.push({ uid, claims });
    return `custom-${uid}`;
  },
  getUser: async (uid: string) => ({ uid, email: `${uid}@example.com`, emailVerified: false, providerData: [], metadata: {} }),
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/firebaseAdmin", async (real) => ({ ...(await real<object>()), adminAuth: () => fakeAuth, adminDb: () => null, usingEmulators: true }));
vi.mock("@/lib/server/cloud", () => ({ cloudStore: () => ({ upsertUser: async () => {} }) }));

const start = (await import("./start/route")).POST;
const redeem = (await import("./redeem/route")).POST;

const now = () => Math.floor(Date.now() / 1000);
const pkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};
async function call(route: (r: Request) => Promise<Response>, body: unknown, origin?: string) {
  const headers: Record<string, string> = { "content-type": "application/json", host: "localhost" };
  if (origin) headers.origin = origin;
  const res = await route(new Request("http://localhost/api/auth/desktop", { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: res.status, data: (await res.json()) as any };
}

beforeEach(() => void (minted.length = 0));

describe("desktop sign-in", () => {
  it("gives the app a token for a fresh browser sign-in, keeping how they signed in", async () => {
    const { verifier, challenge } = pkce();
    const s = await call(start, { idToken: `asha:${now() - 10}:google.com`, challenge }, "http://localhost");
    expect(s.status).toBe(200);
    expect(s.data.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(minted).toEqual([]); // nothing usable leaves the browser

    expect(await call(redeem, { code: s.data.code, verifier })).toEqual({ status: 200, data: { token: "custom-asha" } });
    expect(minted).toEqual([{ uid: "asha", claims: { signInMethod: "google" } }]);
  });

  it("keeps an email-code sign-in an email-code sign-in", async () => {
    const { verifier, challenge } = pkce();
    const s = await call(start, { idToken: `ravi:${now()}:custom:email-code`, challenge });
    await call(redeem, { code: s.data.code, verifier });
    expect(minted).toEqual([{ uid: "ravi", claims: { signInMethod: "email-code" } }]);
  });

  it("works once, and only with the app's verifier", async () => {
    const { verifier, challenge } = pkce();
    const s = await call(start, { idToken: `asha:${now()}:google.com`, challenge });
    expect(await call(redeem, { code: s.data.code, verifier: pkce().verifier })).toMatchObject({ status: 400, data: { code: "invalid_code" } });
    // A wrong guess used the code up too.
    expect(await call(redeem, { code: s.data.code, verifier })).toMatchObject({ status: 410, data: { code: "expired" } });

    const again = await call(start, { idToken: `asha:${now()}:google.com`, challenge });
    expect((await call(redeem, { code: again.data.code, verifier })).status).toBe(200);
    expect((await call(redeem, { code: again.data.code, verifier })).status).toBe(410);
  });

  it("runs out after two minutes", async () => {
    const { verifier, challenge } = pkce();
    const s = await call(start, { idToken: `asha:${now()}:google.com`, challenge });
    vi.useFakeTimers({ now: Date.now() + 121_000 });
    try {
      expect((await call(redeem, { code: s.data.code, verifier })).status).toBe(410);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses old, revoked and turned-off sign-ins, other websites, and junk", async () => {
    const { challenge } = pkce();
    expect(await call(start, { idToken: `asha:${now() - 3600}:google.com`, challenge })).toMatchObject({ status: 401, data: { code: "stale" } });
    expect(await call(start, { idToken: `revoked:${now()}:google.com`, challenge })).toMatchObject({ status: 401, data: { code: "invalid" } });
    expect(await call(start, { idToken: `disabled:${now()}:google.com`, challenge })).toMatchObject({ status: 403, data: { code: "disabled" } });
    expect((await call(start, { idToken: `asha:${now()}:google.com`, challenge }, "https://evil.example")).status).toBe(403);
    expect(await call(start, { idToken: `asha:${now()}:google.com`, challenge: "short" })).toMatchObject({ status: 400, data: { code: "bad_request" } });
    expect(await call(redeem, { code: "nope", verifier: "nope" })).toMatchObject({ status: 400, data: { code: "bad_request" } });
    expect(minted).toEqual([]);
  });
});
