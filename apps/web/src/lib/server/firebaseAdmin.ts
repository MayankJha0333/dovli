import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App, type Credential } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Server-side Firebase (Admin SDK). It can mint sign-in tokens, read and write Firestore without
// security rules, and delete accounts, so it must never be imported from browser code.
//
// Credentials, in order:
//   FIREBASE_SERVICE_ACCOUNT        the service-account JSON, as is or base64-encoded (best for Vercel)
//   GOOGLE_APPLICATION_CREDENTIALS  a path to that JSON file (or Google Cloud's built-in identity)
// With FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST set, the local emulators are used instead.

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
export const usingEmulators = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

function credential(): Credential | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    return cert(JSON.parse(json));
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  return undefined;
}

/** True when the server can talk to Firebase (real project with credentials, or the emulators). */
export const firebaseOnServer = Boolean(projectId && (usingEmulators || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS));

let app: App | null = null;
function adminApp(): App | null {
  if (!firebaseOnServer) return null;
  if (!app) {
    // The emulators need no credential; leave the option out entirely (undefined is rejected).
    const cred = usingEmulators ? undefined : credential();
    app = getApps()[0] ?? initializeApp(cred ? { projectId, credential: cred } : { projectId });
  }
  return app;
}

export function adminAuth(): Auth | null {
  const a = adminApp();
  return a ? getAuth(a) : null;
}

/**
 * Firestore, when there is one: a real project, or the emulators with the Firestore emulator
 * running too. With only the Auth emulator there is none (callers fall back or skip).
 */
export const firestoreOnServer = firebaseOnServer && (!usingEmulators || Boolean(process.env.FIRESTORE_EMULATOR_HOST));

export function adminDb(): Firestore | null {
  const a = firestoreOnServer ? adminApp() : null;
  return a ? getFirestore(a) : null;
}

/**
 * The signed-in person behind a request's "Authorization: Bearer <Firebase ID token>", or null.
 * `checkRevoked` also refuses tokens of signed-out-everywhere or disabled accounts (one extra lookup).
 */
export async function userFromRequest(req: Request, checkRevoked = false): Promise<RequestUser | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = adminAuth();
  if (!token || !auth) return null;
  try {
    const t = await auth.verifyIdToken(token, checkRevoked);
    return {
      id: t.uid,
      email: t.email,
      emailVerified: t.email_verified === true,
      name: t.name as string | undefined,
      picture: t.picture,
      signInMethod: signInMethodOf(t.firebase?.sign_in_provider, t.signInMethod),
    };
  } catch {
    return null;
  }
}

export interface RequestUser {
  id: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  /** "google" or "email-code", from how this token was made. */
  signInMethod?: string;
}

/**
 * Firebase's provider names, in Dovli's words. Email-code sign-ins use a custom token, and so does
 * the desktop app (its claim says how the browser signed in).
 */
export function signInMethodOf(provider?: string, claim?: unknown): string | undefined {
  if (provider === "google.com") return "google";
  if (provider === "custom") return claim === "email-code" || claim === "google" ? claim : "custom";
  return provider;
}
