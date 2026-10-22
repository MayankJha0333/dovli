// Dovli's Google Play listing. A plain module (no "use client"), so server pages such as the
// structured data in lib/seo.ts can read the address too.
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.dovli";

// Until this moment the listing isn't public (the app is in testing), so the site counts down to it
// and offers the APK instead. Move it if the Play launch slips: past it, every badge links to Play.
export const PLAY_LAUNCH_AT = Date.parse("2026-11-07T00:00:00+05:30");

// The APK that .github/workflows/android-apk.yml puts on the repo's "android" release, under a
// name that never changes. Shared as dovli.in/apk (app/apk/route.ts), which redirects here.
export const APK_URL = "https://github.com/MayankJha0333/dovli/releases/download/android/Dovli.apk";
export const APK_PATH = "/apk";
