import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { CloudError, createCloud, type CloudStore, type DocTx } from "./cloudCore";
import { memoryCloudStore } from "./cloudMemory";
import { adminDb, firebaseOnServer, usingEmulators } from "./firebaseAdmin";

// The user records, pages and devices (see cloudCore.ts for what's kept), in Firestore through the
// Admin SDK. The Firestore rules keep browsers out entirely; everything goes through these routes.

export { CloudError } from "./cloudCore";

function firestoreStore(db: Firestore): CloudStore {
  return {
    transaction: (fn) =>
      db.runTransaction((t) => {
        const tx: DocTx = {
          get: async (path) => (await t.get(db.doc(path))).data(),
          set: (path, data, merge) => void (merge ? t.set(db.doc(path), data, { merge: true }) : t.set(db.doc(path), data)),
        };
        return fn(tx);
      }),
    async listByRev(collection, after, limit) {
      const snap = await db.collection(collection).where("rev", ">", after).orderBy("rev").limit(limit).get();
      return snap.docs.map((d) => d.data());
    },
    deleteTree: (path) => db.recursiveDelete(db.doc(path)),
  };
}

let cloud: ReturnType<typeof createCloud> | null = null;

export function cloudStore() {
  if (cloud) return cloud;
  const db = adminDb();
  if (!firebaseOnServer || (!db && !usingEmulators)) throw new CloudError("not_configured", "Cloud saving isn't set up on this server yet (Firebase service account).", 503);
  cloud = createCloud({ store: db ? firestoreStore(db) : memoryCloudStore() });
  return cloud;
}
