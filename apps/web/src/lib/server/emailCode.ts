import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { CodeError, createEmailCodes, type CodeStore, type CodeTx } from "./emailCodeCore";
import { adminAuth, adminDb, firebaseOnServer, usingEmulators } from "./firebaseAdmin";
import { mailConfigured, mailDevLog, sendSignInCode } from "./mailer";

// Email sign-in codes, wired to Firestore (where the code hashes live), Firebase Auth (accounts and
// sign-in tokens) and the mailer. The rules themselves are in emailCodeCore.ts.

export { CodeError } from "./emailCodeCore";

/** Firestore, through the Admin SDK (which security rules don't apply to). */
function firestoreStore(db: Firestore): CodeStore {
  return {
    transaction: (fn) =>
      db.runTransaction((t) => {
        const tx: CodeTx = {
          get: async (c, id) => (await t.get(db.collection(c).doc(id))).data(),
          set: (c, id, data) => void t.set(db.collection(c).doc(id), data),
          update: (c, id, patch) => void t.update(db.collection(c).doc(id), patch),
        };
        return fn(tx);
      }),
    update: async (c, id, patch) => void (await db.collection(c).doc(id).update(patch)),
    delete: async (c, id) => void (await db.collection(c).doc(id).delete()),
  };
}

/**
 * Local testing only: with the Auth emulator but no Firestore emulator running, codes are kept in
 * this server's memory. Never used against a real Firebase project.
 */
function memoryStore(): CodeStore {
  const data = new Map<string, Record<string, any>>();
  const k = (c: string, id: string) => `${c}/${id}`;
  let queue = Promise.resolve();
  return {
    transaction(fn) {
      const run = queue.then(() => {
        const writes: [string, Record<string, any> | null][] = [];
        const tx: CodeTx = {
          get: async (c, id) => structuredClone(data.get(k(c, id))),
          set: (c, id, d) => void writes.push([k(c, id), { ...d }]),
          update: (c, id, p) => void writes.push([k(c, id), { ...(data.get(k(c, id)) ?? {}), ...p }]),
        };
        return fn(tx).then((out) => {
          for (const [key, v] of writes) if (v) data.set(key, v);
          return out;
        });
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
    update: async (c, id, p) => void data.set(k(c, id), { ...(data.get(k(c, id)) ?? {}), ...p }),
    delete: async (c, id) => void data.delete(k(c, id)),
  };
}

/** The key that seals the codes. Required in production; a fixed stand-in for local testing. */
function secret(): string {
  const s = process.env.AUTH_CODE_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production" || usingEmulators) return "dovli-development-only-secret-do-not-use";
  throw new CodeError("not_configured", "Email sign-in isn't set up on this server yet (AUTH_CODE_SECRET).", 503);
}

/** Play Store review sign-in: REVIEW_LOGIN_EMAIL always takes REVIEW_LOGIN_CODE. Off unless both are set. */
function reviewLogin() {
  const email = process.env.REVIEW_LOGIN_EMAIL?.trim().toLowerCase();
  const code = process.env.REVIEW_LOGIN_CODE?.trim();
  return email && code && /^\d{6}$/.test(code) ? { email, code } : null;
}

let codes: ReturnType<typeof createEmailCodes> | null = null;

function emailCodes() {
  const auth = adminAuth();
  if (!firebaseOnServer || !auth) throw new CodeError("not_configured", "Sign-in isn't set up on this server yet.", 503);
  if (!mailConfigured && !mailDevLog) throw new CodeError("not_configured", "Email sign-in isn't set up on this server yet (SMTP).", 503);
  secret(); // refuse before anything is stored or sent
  if (codes) return codes;
  const db = adminDb();
  if (!db && !usingEmulators) throw new CodeError("not_configured", "Sign-in isn't set up on this server yet (Firestore).", 503);
  codes = createEmailCodes({
    store: db ? firestoreStore(db) : memoryStore(),
    accounts: {
      async findByEmail(email) {
        try {
          const u = await auth.getUserByEmail(email);
          return { uid: u.uid, emailVerified: u.emailVerified, disabled: u.disabled };
        } catch (e) {
          if ((e as { code?: string })?.code === "auth/user-not-found") return null;
          throw e;
        }
      },
      async create(email, name) {
        const u = await auth.createUser(name ? { email, emailVerified: true, displayName: name } : { email, emailVerified: true });
        return { uid: u.uid, disabled: u.disabled };
      },
      markVerified: async (uid) => void (await auth.updateUser(uid, { emailVerified: true })),
      signInToken: (uid) => auth.createCustomToken(uid, { signInMethod: "email-code" }),
    },
    sendEmail: sendSignInCode,
    secret,
    reviewLogin,
  });
  return codes;
}

export const sendCode = (email: unknown, ip: string) => emailCodes().send(email, ip);
export const verifyCode = (email: unknown, code: unknown, name?: unknown) => emailCodes().verify(email, code, name);
export async function forgetEmail(email: string) {
  try {
    await emailCodes().forget(email);
  } catch {
    /* nothing kept, or sign-in not set up */
  }
}
