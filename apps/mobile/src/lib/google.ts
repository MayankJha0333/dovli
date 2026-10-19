// "Continue with Google" on the phone. The system's own Google sign-in sheet gives us a Google ID
// token; Firebase turns it into the same Dovli account as on the web (one account per email).
//
// Needs two values from Firebase / Google Cloud in apps/mobile/.env:
//   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID  the "Web client" Firebase made for Google sign-in
//   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID  the iOS client for the app.dovli bundle
// app.config.ts uses the iOS one to register the URL scheme Google returns to.

import { Platform, TurboModuleRegistry } from "react-native";

type GoogleSigninLib = typeof import("@react-native-google-signin/google-signin");

// Expo Go, and app builds made before Google sign-in was added, don't have its native module, and
// importing the library there crashes the whole app. Load it only when the module is in the build.
const lib: GoogleSigninLib | null =
  Platform.OS !== "web" && TurboModuleRegistry.get("RNGoogleSignin") ? (require("@react-native-google-signin/google-signin") as GoogleSigninLib) : null;

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export const googleConfigured = Boolean(lib && webClientId && (Platform.OS !== "ios" || iosClientId));

let configured = false;
function setup() {
  if (configured) return;
  configured = true;
  lib!.GoogleSignin.configure({ webClientId, iosClientId, scopes: ["email", "profile"] });
}

export class GoogleError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

/** Opens Google's sign-in sheet. Returns the ID token and email, or null if the person closed it. */
export async function googleIdToken(): Promise<{ idToken: string; email: string | null; name: string | null } | null> {
  if (!googleConfigured || !lib) throw new GoogleError("Google sign-in isn't set up in this build of the app yet.", "not-configured");
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = lib;
  setup();
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Always show the account picker, so someone with two Google accounts can choose.
    await GoogleSignin.signOut().catch(() => {});
    const r = await GoogleSignin.signIn();
    if (!isSuccessResponse(r)) return null;
    if (!r.data.idToken) throw new GoogleError("Google didn't send a sign-in token. Please try again.", "no-token");
    return { idToken: r.data.idToken, email: r.data.user.email ?? null, name: r.data.user.name ?? null };
  } catch (e) {
    if (e instanceof GoogleError) throw e;
    // The real reason, for whoever is building the app (Metro's terminal / the debugger).
    console.warn("[dovli] Google sign-in failed:", (e as { code?: string })?.code, (e as Error)?.message ?? e);
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (e.code === statusCodes.IN_PROGRESS) throw new GoogleError("Google sign-in is already open.", "busy");
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new GoogleError("Google Play services aren't available on this phone. Use your email instead.", "no-play");
    }
    throw new GoogleError(
      __DEV__ ? `Couldn't sign in with Google: ${(e as Error)?.message ?? "unknown error"}` : "Couldn't sign in with Google. Please try again, or use your email.",
      "google",
    );
  }
}

/** Forget the Google session on this phone too, so the next sign-in shows the account picker. */
export async function googleSignOut() {
  if (!lib || !googleConfigured || !configured) return;
  await lib.GoogleSignin.signOut().catch(() => {});
}
