import { APK_URL } from "@/features/landing/playStore";

// dovli.in/apk: a short address for the Android APK, for sharing and for the landing page's QR code.
// Temporary, so it can point at the Play listing later without browsers remembering the APK.
export function GET() {
  return Response.redirect(APK_URL, 302);
}
