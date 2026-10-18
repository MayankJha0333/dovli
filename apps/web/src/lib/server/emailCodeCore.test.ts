import { beforeEach, describe, expect, it } from "vitest";
import { CODES, CodeError, createEmailCodes, emailKey, type CodeStore, type CodeTx } from "./emailCodeCore";

/** An in-memory store with all-or-nothing transactions, like Firestore's. */
function memory() {
  const data = new Map<string, Record<string, any>>();
  const k = (c: string, id: string) => `${c}/${id}`;
  const store: CodeStore = {
    async transaction(fn) {
      const writes: [string, Record<string, any>][] = [];
      const tx: CodeTx = {
        get: async (c, id) => structuredClone(data.get(k(c, id))),
        set: (c, id, d) => void writes.push([k(c, id), { ...d }]),
        update: (c, id, p) => void writes.push([k(c, id), { ...(data.get(k(c, id)) ?? {}), ...p }]),
      };
      const out = await fn(tx);
      for (const [key, v] of writes) data.set(key, v);
      return out;
    },
    update: async (c, id, p) => void data.set(k(c, id), { ...(data.get(k(c, id)) ?? {}), ...p }),
    delete: async (c, id) => void data.delete(k(c, id)),
  };
  return { store, data };
}

let clock = 1_800_000_000_000;
let nextCode = "123456";
let sent: { to: string; code: string }[] = [];
let failEmail = false;
let users: Map<string, { uid: string; emailVerified: boolean; disabled: boolean; name?: string }>;
let mem: ReturnType<typeof memory>;
let codes: ReturnType<typeof createEmailCodes>;

async function error(p: Promise<unknown>): Promise<CodeError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof CodeError) return e;
    throw e;
  }
  throw new Error("expected a CodeError");
}

beforeEach(() => {
  clock = 1_800_000_000_000;
  nextCode = "123456";
  sent = [];
  failEmail = false;
  users = new Map();
  mem = memory();
  codes = createEmailCodes({
    store: mem.store,
    now: () => clock,
    makeCode: () => nextCode,
    secret: () => "test-secret-that-is-long-enough-1234567890",
    sendEmail: async (to, code) => {
      if (failEmail) throw new Error("smtp down");
      sent.push({ to, code });
    },
    accounts: {
      findByEmail: async (email) => users.get(email) ?? null,
      create: async (email, name) => {
        const u = { uid: `uid-${users.size + 1}`, emailVerified: true, disabled: false, name };
        users.set(email, u);
        return u;
      },
      markVerified: async (uid) => {
        for (const u of users.values()) if (u.uid === uid) u.emailVerified = true;
      },
      signInToken: async (uid) => `token-for-${uid}`,
    },
  });
});

describe("sending a code", () => {
  it("emails a code and keeps only a hash of it", async () => {
    const r = await codes.send("Asha@Example.com ", "1.2.3.4");
    expect(r).toEqual({ resendAfter: 60, expiresIn: 600 });
    expect(sent).toEqual([{ to: "asha@example.com", code: "123456" }]);
    const doc = mem.data.get(`${CODES}/${emailKey("asha@example.com")}`)!;
    expect(doc.codeHash).toBeTruthy();
    expect(JSON.stringify(doc)).not.toContain("123456");
  });

  it("refuses an address that isn't one", async () => {
    expect((await error(codes.send("not-an-email", "ip"))).kind).toBe("invalid_email");
    expect((await error(codes.send("a@b", "ip"))).kind).toBe("invalid_email");
  });

  it("waits 60 seconds before sending again", async () => {
    await codes.send("a@example.com", "ip");
    clock += 20_000;
    const e = await error(codes.send("a@example.com", "ip"));
    expect(e.kind).toBe("wait");
    expect(e.extra.retryAfter).toBe(40);
    clock += 40_000;
    await expect(codes.send("a@example.com", "ip")).resolves.toBeTruthy();
  });

  it("allows at most 5 codes an hour for one address", async () => {
    for (let i = 0; i < 5; i++) {
      await codes.send("a@example.com", "ip");
      clock += 61_000;
    }
    const e = await error(codes.send("a@example.com", "ip"));
    expect(e.kind).toBe("too_many");
    expect(e.status).toBe(429);
    clock += 60 * 60 * 1000;
    await expect(codes.send("a@example.com", "ip")).resolves.toBeTruthy();
  });

  it("allows at most 30 codes an hour from one network", async () => {
    for (let i = 0; i < 30; i++) await codes.send(`p${i}@example.com`, "9.9.9.9");
    expect((await error(codes.send("p31@example.com", "9.9.9.9"))).kind).toBe("too_many");
    await expect(codes.send("p31@example.com", "8.8.8.8")).resolves.toBeTruthy();
  });

  it("lets you retry straight away when the email couldn't be sent", async () => {
    failEmail = true;
    expect((await error(codes.send("a@example.com", "ip"))).kind).toBe("email_failed");
    failEmail = false;
    await expect(codes.send("a@example.com", "ip")).resolves.toBeTruthy();
  });
});

describe("checking a code", () => {
  beforeEach(async () => {
    await codes.send("asha@example.com", "ip");
  });

  it("signs in with the right code, creating the account the first time", async () => {
    expect(await codes.verify("ASHA@example.com", "123 456")).toEqual({ token: "token-for-uid-1" });
    expect(users.get("asha@example.com")?.uid).toBe("uid-1");
  });

  it("names a new account from the sign-up form, tidied up", async () => {
    await codes.verify("asha@example.com", "123456", "  Asha \n  Rao ");
    expect(users.get("asha@example.com")?.name).toBe("Asha Rao");
  });

  it("leaves an existing account's name alone", async () => {
    users.set("asha@example.com", { uid: "u1", emailVerified: true, disabled: false, name: "Asha" });
    await codes.verify("asha@example.com", "123456", "Someone Else");
    expect(users.get("asha@example.com")?.name).toBe("Asha");
  });

  it("works only once", async () => {
    await codes.verify("asha@example.com", "123456");
    expect((await error(codes.verify("asha@example.com", "123456"))).kind).toBe("expired");
  });

  it("expires after 10 minutes", async () => {
    clock += 10 * 60 * 1000 + 1;
    expect((await error(codes.verify("asha@example.com", "123456"))).kind).toBe("expired");
  });

  it("counts wrong tries and locks after 5", async () => {
    for (let left = 4; left >= 1; left--) {
      const e = await error(codes.verify("asha@example.com", "000000"));
      expect(e.kind).toBe("wrong_code");
      expect(e.extra.triesLeft).toBe(left);
      expect(e.message).toContain(left === 1 ? "1 try left" : `${left} tries left`);
    }
    expect((await error(codes.verify("asha@example.com", "000000"))).kind).toBe("locked");
    // Even the right code no longer works: a new one has to be sent.
    expect((await error(codes.verify("asha@example.com", "123456"))).kind).toBe("expired");
  });

  it("a new code replaces the old one", async () => {
    clock += 61_000;
    nextCode = "654321";
    await codes.send("asha@example.com", "ip");
    expect((await error(codes.verify("asha@example.com", "123456"))).kind).toBe("wrong_code");
    await expect(codes.verify("asha@example.com", "654321")).resolves.toBeTruthy();
  });

  it("uses the existing account for that email (for example one made with Google)", async () => {
    users.set("asha@example.com", { uid: "google-uid", emailVerified: false, disabled: false });
    expect(await codes.verify("asha@example.com", "123456")).toEqual({ token: "token-for-google-uid" });
    expect(users.get("asha@example.com")?.emailVerified).toBe(true);
  });

  it("refuses a turned-off account", async () => {
    users.set("asha@example.com", { uid: "u", emailVerified: true, disabled: true });
    expect((await error(codes.verify("asha@example.com", "123456"))).kind).toBe("disabled");
  });

  it("asks for 6 digits", async () => {
    expect((await error(codes.verify("asha@example.com", "12ab"))).kind).toBe("invalid_code");
  });

  it("without a code sent, says it has expired (and doesn't reveal accounts)", async () => {
    expect((await error(codes.verify("nobody@example.com", "123456"))).kind).toBe("expired");
  });
});
