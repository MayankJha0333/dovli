// Deletes a signed-in person's account: their record, pages and devices in Firestore, their AI
// usage records, any sign-in codes kept for their email, and their Firebase sign-in.

import { NextResponse } from "next/server";
import { cloudStore } from "@/lib/server/cloud";
import { forgetEmail } from "@/lib/server/emailCode";
import { adminAuth, adminDb, userFromRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = adminAuth();
  const db = adminDb();
  if (!auth) return NextResponse.json({ error: "Accounts aren't set up on this server." }, { status: 501 });
  // checkRevoked: a token from before "sign out everywhere" or a disabled account isn't enough.
  const user = await userFromRequest(req, true);
  if (!user) return NextResponse.json({ error: "Please sign in again, then try once more." }, { status: 401 });

  if (db) {
    try {
      const usage = await db.collection("aiUsage").where("userId", "==", user.id).get();
      const batch = db.batch();
      usage.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {
      console.error("[dovli] Couldn't remove AI usage records while deleting an account:", e);
    }
  }
  if (user.email) await forgetEmail(user.email);
  try {
    await cloudStore().deleteUser(user.id);
  } catch (e) {
    console.error("[dovli] Couldn't remove the user's pages while deleting an account:", e);
    return NextResponse.json({ error: "Couldn't delete your saved pages. Please try again." }, { status: 500 });
  }

  try {
    await auth.deleteUser(user.id);
  } catch {
    return NextResponse.json({ error: "Couldn't delete the account. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
