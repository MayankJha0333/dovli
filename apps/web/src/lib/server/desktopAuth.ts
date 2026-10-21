import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { DESKTOP_CODES, createDesktopAuth, memoryDesktopCodes, type DesktopCode, type DesktopCodeStore } from "./desktopAuthCore";
import { CodeError } from "./emailCodeCore";
import { adminAuth, adminDb, usingEmulators } from "./firebaseAdmin";

// The desktop app's sign-in codes (see desktopAuthCore.ts), kept in Firestore.

function firestoreCodes(db: Firestore): DesktopCodeStore {
  const doc = (id: string) => db.collection(DESKTOP_CODES).doc(id);
  return {
    put: async (id, code) => void (await doc(id).set(code)),
    take: (id) =>
      db.runTransaction(async (t) => {
        const snap = await t.get(doc(id));
        if (!snap.exists) return undefined;
        t.delete(doc(id));
        const d = snap.data()!;
        return { ...d, expiresAt: d.expiresAt.toDate() } as DesktopCode;
      }),
  };
}

let desktop: ReturnType<typeof createDesktopAuth> | null = null;

export function desktopAuth() {
  const auth = adminAuth();
  const db = adminDb();
  if (!auth || (!db && !usingEmulators)) throw new CodeError("not_configured", "Sign-in isn't set up on this server yet.", 503);
  desktop ??= createDesktopAuth({
    // Only with the Auth emulator and no Firestore emulator: kept in this server's memory.
    store: db ? firestoreCodes(db) : memoryDesktopCodes(),
    mint: (uid, signInMethod) => auth.createCustomToken(uid, signInMethod ? { signInMethod } : undefined),
  });
  return desktop;
}
