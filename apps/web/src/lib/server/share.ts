import "server-only";
import { backingStore } from "./cloud";
import { CloudError } from "./cloudCore";
import { adminAuth } from "./firebaseAdmin";
import { createSharing, type Person } from "./shareCore";

// Page sharing (see shareCore.ts), with accounts from Firebase Authentication.

let sharing: ReturnType<typeof createSharing> | null = null;

const toPerson = (u: { uid: string; email?: string; displayName?: string; photoURL?: string }): Person => ({
  uid: u.uid,
  email: u.email ?? null,
  name: u.displayName ?? null,
  photoURL: u.photoURL ?? null,
});

export function sharingStore() {
  if (sharing) return sharing;
  const auth = adminAuth();
  if (!auth) throw new CloudError("not_configured", "Sharing isn't set up on this server yet (Firebase service account).", 503);
  sharing = createSharing({
    store: backingStore(),
    accounts: {
      async findByEmail(email) {
        try {
          return toPerson(await auth.getUserByEmail(email));
        } catch (e) {
          if ((e as { code?: string })?.code === "auth/user-not-found") return null;
          throw e;
        }
      },
      async get(uid) {
        try {
          return toPerson(await auth.getUser(uid));
        } catch {
          return null;
        }
      },
    },
  });
  return sharing;
}

/** This site's address, for links in emails (APP_URL wins; otherwise the address the request came to). */
export function siteOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}
