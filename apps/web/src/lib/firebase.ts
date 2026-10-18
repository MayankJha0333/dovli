// The Firebase client for the browser, when the project's web config is set (see .env.example).
// Without it Dovli runs in "this device only" mode: everything works, nothing leaves the browser.

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};
/** e.g. 127.0.0.1:9099 to use the local Auth emulator instead of the real project. */
const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseApp(): FirebaseApp | null {
  if (!firebaseConfigured || typeof window === "undefined") return null;
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

/** Firebase Auth, kept signed in across visits (IndexedDB, with localStorage as the fallback). */
export function firebaseAuth(): Auth | null {
  const a = firebaseApp();
  if (!a) return null;
  if (!auth) {
    auth = initializeAuth(a, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    auth.useDeviceLanguage();
    if (emulator) connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
  }
  return auth;
}
