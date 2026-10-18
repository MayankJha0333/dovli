// Firebase on the phone, when EXPO_PUBLIC_FIREBASE_* are set (see .env.example).
// Without them the phone app keeps everything on the phone.

import { getApps, initializeApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import { connectAuthEmulator, initializeAuth, type Auth, type Persistence } from "firebase/auth";
import { asyncStorage } from "./kv";

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const emulator = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

/** The web app's address: the phone asks it to email and check sign-in codes. */
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId && apiUrl);

// On a phone, Firebase keeps the sign-in in the app's own storage. That helper only exists in
// Firebase's React Native build, which Metro picks; its types aren't in the shared definitions.
const getReactNativePersistence = (FirebaseAuth as unknown as { getReactNativePersistence: (s: unknown) => Persistence }).getReactNativePersistence;

let auth: Auth | null = null;
export function firebaseAuth(): Auth | null {
  if (!firebaseConfigured) return null;
  if (!auth) {
    const app = getApps()[0] ?? initializeApp(config);
    auth = initializeAuth(app, getReactNativePersistence ? { persistence: getReactNativePersistence(asyncStorage) } : {});
    if (emulator) connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
  }
  return auth;
}
