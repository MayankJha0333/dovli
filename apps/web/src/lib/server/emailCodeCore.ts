// The rules for email sign-in codes, with no Firebase or Next.js inside, so they can be tested on
// their own. lib/server/emailCode.ts plugs in Firestore, Firebase Auth and the mailer.
//
//   send:   make a random 6-digit code, keep only a keyed hash of it (with an expiry, a try counter
//           and a send history), and email the code.
//   verify: check the code against the hash. On a match, find or create the account for that
//           email and return a one-time Firebase custom token; the app signs in with it.
//
// Safety: codes are never stored in plain form, expire after 10 minutes, work once, allow 5 wrong
// tries, and can be re-sent after 60 seconds, at most 5 times an hour per email and 30 times an
// hour per network address. Replies are the same whether or not an account exists, so the form
// can't be used to find out who has one.

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_MINUTES = 10;
export const RESEND_SECONDS = 60;
export const MAX_TRIES = 5;
export const MAX_SENDS_PER_HOUR = 5;
export const MAX_SENDS_PER_IP_PER_HOUR = 30;
const HOUR = 60 * 60 * 1000;

export const CODES = "authEmailCodes";
export const LIMITS = "authRateLimits";

export type CodeErrorKind =
  | "not_configured"
  | "bad_request"
  | "invalid_email"
  | "invalid_code"
  | "wait"
  | "too_many"
  | "wrong_code"
  | "expired"
  | "locked"
  | "disabled"
  | "email_failed";

export class CodeError extends Error {
  constructor(
    public kind: CodeErrorKind,
    message: string,
    public status: number,
    public extra: { retryAfter?: number; triesLeft?: number } = {},
  ) {
    super(message);
  }
}

/** Where codes and limits are kept. Transactions make concurrent tries safe. */
export interface CodeTx {
  get(collection: string, id: string): Promise<Record<string, any> | undefined>;
  set(collection: string, id: string, data: Record<string, any>): void;
  update(collection: string, id: string, patch: Record<string, any>): void;
}
export interface CodeStore {
  transaction<T>(fn: (tx: CodeTx) => Promise<T>): Promise<T>;
  update(collection: string, id: string, patch: Record<string, any>): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
}

/** The few account operations sign-in needs (Firebase Admin Auth in the app). */
export interface CodeAccounts {
  findByEmail(email: string): Promise<{ uid: string; emailVerified: boolean; disabled: boolean } | null>;
  create(email: string, name?: string): Promise<{ uid: string; disabled: boolean }>;
  markVerified(uid: string): Promise<void>;
  signInToken(uid: string): Promise<string>;
}

export interface CodeDeps {
  store: CodeStore;
  accounts: CodeAccounts;
  sendEmail(to: string, code: string, minutes: number): Promise<void>;
  secret: () => string;
  now?: () => number;
  makeCode?: () => string;
  /** A sign-in for app store reviewers, who can't read our inbox: this email's code is fixed and never sent. */
  reviewLogin?: () => { email: string; code: string } | null;
}

interface CodeDoc {
  codeHash: string | null;
  expiresAt: number;
  tries: number;
  sentAt: number;
  sends: number[];
  /** For a Firestore TTL policy, so old documents clean themselves up. */
  deleteAt: Date;
}

export function normalizeEmail(raw: unknown): string {
  const email = String(raw ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new CodeError("invalid_email", "Please type a full email address, like you@example.com.", 400);
  return email;
}

/** A display name from the sign-up form: trimmed, single-spaced, at most 80 characters, or none. */
export function normalizeName(raw: unknown): string | undefined {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return name || undefined;
}

export const emailKey = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const waitText = (s: number) => (s >= 90 ? plural(Math.ceil(s / 60), "minute", "minutes") : plural(s, "second", "seconds"));
const expiredError = () => new CodeError("expired", "This code has expired. Send a new one.", 400);
const lockedError = () => new CodeError("locked", "Too many wrong tries. Send a new code.", 429);

export function createEmailCodes(deps: CodeDeps) {
  const now = deps.now ?? Date.now;
  const makeCode = deps.makeCode ?? (() => String(randomInt(0, 1_000_000)).padStart(6, "0"));
  const hash = (key: string, code: string) => createHmac("sha256", deps.secret()).update(`${key}:${code}`).digest();

  async function send(rawEmail: unknown, ip: string): Promise<{ resendAfter: number; expiresIn: number }> {
    const email = normalizeEmail(rawEmail);
    const key = emailKey(email);
    const t = now();

    // Per network address: a light limit so one place can't spray codes at many inboxes.
    const ipId = `ip_${emailKey(ip || "unknown")}`;
    await deps.store.transaction(async (tx) => {
      const sends = (((await tx.get(LIMITS, ipId))?.sends as number[]) ?? []).filter((x) => x > t - HOUR);
      if (sends.length >= MAX_SENDS_PER_IP_PER_HOUR) {
        const retryAfter = Math.ceil((sends[0] + HOUR - t) / 1000);
        throw new CodeError("too_many", `Too many codes were asked for from this network. Try again in ${waitText(retryAfter)}.`, 429, { retryAfter });
      }
      tx.set(LIMITS, ipId, { sends: [...sends, t], deleteAt: new Date(t + 2 * HOUR) });
    });

    const review = deps.reviewLogin?.();
    const fixed = review?.email === email ? review.code : null;
    const code = fixed ?? makeCode();
    await deps.store.transaction(async (tx) => {
      const prev = (await tx.get(CODES, key)) as CodeDoc | undefined;
      const sends = (prev?.sends ?? []).filter((x) => x > t - HOUR);
      const since = prev?.sentAt ? t - prev.sentAt : Infinity;
      if (since < RESEND_SECONDS * 1000) {
        const retryAfter = Math.ceil((RESEND_SECONDS * 1000 - since) / 1000);
        throw new CodeError("wait", `Please wait ${waitText(retryAfter)} before asking for another code.`, 429, { retryAfter });
      }
      if (sends.length >= MAX_SENDS_PER_HOUR) {
        const retryAfter = Math.ceil((sends[0] + HOUR - t) / 1000);
        throw new CodeError("too_many", `That's a lot of codes for one address. Try again in ${waitText(retryAfter)}.`, 429, { retryAfter });
      }
      const doc: CodeDoc = {
        codeHash: hash(key, code).toString("base64"),
        expiresAt: t + CODE_MINUTES * 60 * 1000,
        tries: 0,
        sentAt: t,
        sends: [...sends, t],
        deleteAt: new Date(t + 2 * HOUR),
      };
      tx.set(CODES, key, doc as unknown as Record<string, any>);
    });

    if (fixed) return { resendAfter: RESEND_SECONDS, expiresIn: CODE_MINUTES * 60 };
    try {
      await deps.sendEmail(email, code, CODE_MINUTES);
    } catch (e) {
      console.error("[dovli] Couldn't send a sign-in email:", e instanceof Error ? e.message : e);
      // The code never arrived: forget it and allow an immediate retry.
      await deps.store.update(CODES, key, { codeHash: null, sentAt: 0 });
      throw new CodeError("email_failed", "We couldn't send the email just now. Please try again in a moment.", 502);
    }
    return { resendAfter: RESEND_SECONDS, expiresIn: CODE_MINUTES * 60 };
  }

  /** `name` (from the sign-up page) is used only when this email has no account yet. */
  async function verify(rawEmail: unknown, rawCode: unknown, rawName?: unknown): Promise<{ token: string }> {
    const email = normalizeEmail(rawEmail);
    const name = normalizeName(rawName);
    const code = String(rawCode ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) throw new CodeError("invalid_code", "The code is the 6 digits in the email.", 400);
    const key = emailKey(email);
    const t = now();

    // In a transaction, so two quick tries can't both slip past the try limit.
    const problem = await deps.store.transaction(async (tx): Promise<CodeError | null> => {
      const doc = (await tx.get(CODES, key)) as CodeDoc | undefined;
      if (!doc?.codeHash) return expiredError();
      if (doc.expiresAt < t) {
        tx.update(CODES, key, { codeHash: null });
        return expiredError();
      }
      if (doc.tries >= MAX_TRIES) return lockedError();
      const expected = Buffer.from(doc.codeHash, "base64");
      const given = hash(key, code);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
        const tries = doc.tries + 1;
        const left = MAX_TRIES - tries;
        tx.update(CODES, key, left > 0 ? { tries } : { tries, codeHash: null });
        return left > 0 ? new CodeError("wrong_code", `That code isn't right. ${plural(left, "try", "tries")} left.`, 400, { triesLeft: left }) : lockedError();
      }
      tx.update(CODES, key, { codeHash: null, tries: 0 }); // one use only
      return null;
    });
    if (problem) throw problem;

    // The same email always means the same account, whether it signed up with Google or a code.
    let user = await deps.accounts.findByEmail(email);
    if (!user) user = { ...(await deps.accounts.create(email, name)), emailVerified: true };
    else if (!user.emailVerified) await deps.accounts.markVerified(user.uid);
    if (user.disabled) throw new CodeError("disabled", "This account has been turned off. Contact support if that's a mistake.", 403);
    return { token: await deps.accounts.signInToken(user.uid) };
  }

  /** Forget the code record for an email (used when an account is deleted). */
  const forget = (email: string) => deps.store.delete(CODES, emailKey(email)).catch(() => {});

  return { send, verify, forget };
}
