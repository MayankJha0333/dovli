import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { CloudError, createCloud, type CloudStore, type DocTx } from "./cloudCore";
import { memoryCloudStore } from "./cloudMemory";
import { adminDb, firebaseOnServer, usingEmulators } from "./firebaseAdmin";

// The user records, devices, workspaces and their pages (see cloudCore.ts for what's kept), in
// Firestore through the Admin SDK. The Firestore rules keep browsers out entirely; everything goes through these routes.

export { CloudError } from "./cloudCore";

function firestoreStore(db: Firestore): CloudStore {
  return {
    transaction: (fn) =>
      db.runTransaction((t) => {
        const tx: DocTx = {
          get: async (path) => (await t.get(db.doc(path))).data(),
          set: (path, data, merge) => void (merge ? t.set(db.doc(path), data, { merge: true }) : t.set(db.doc(path), data)),
          delete: (path) => void t.delete(db.doc(path)),
        };
        return fn(tx);
      }),
    async listByRev(collection, after, limit) {
      const snap = await db.collection(collection).where("rev", ">", after).orderBy("rev").limit(limit).get();
      return snap.docs.map((d) => d.data());
    },
    async list(collection, limit) {
      return (await db.collection(collection).limit(limit).get()).docs.map((d) => d.data());
    },
    deleteTree: (path) => db.recursiveDelete(db.doc(path)),
  };
}

let cloud: ReturnType<typeof createCloud> | null = null;
let backing: CloudStore | null = null;

/** The one database behind records, pages and sharing: Firestore, or memory for local testing. */
export function backingStore(): CloudStore {
  if (backing) return backing;
  const db = adminDb();
  if (!firebaseOnServer || (!db && !usingEmulators)) throw new CloudError("not_configured", "Cloud saving isn't set up on this server yet (Firebase service account).", 503);
  backing = db ? firestoreStore(db) : memoryCloudStore();
  return backing;
}

export function cloudStore() {
  cloud ??= createCloud({ store: backingStore() });
  return cloud;
}
