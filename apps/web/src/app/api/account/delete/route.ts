// Deletes a signed-in person's account: their record, pages and devices in Firestore, their AI
// usage records and AI settings (with any key they connected), their AI app connections, links to
// their pages and invites they sent that are still waiting, any sign-in codes kept for their
// email, and their Firebase sign-in.

import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { clearChoice } from "@/lib/server/aiKeys";
import { cloudStore } from "@/lib/server/cloud";
import { personalWorkspaceId } from "@/lib/server/cloudCore";
import { forgetEmail } from "@/lib/server/emailCode";
import { mcpServer } from "@/lib/server/mcp";
import { adminAuth, adminDb, userFromRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

/**
 * Sharing kept outside the workspace, which would otherwise outlive it: the pages' public links,
 * and invites still waiting for someone to sign up (they hold that person's email and the page title).
 */
async function forgetSharing(db: Firestore, uid: string) {
  const ws = personalWorkspaceId(uid);
  const [links, pages] = await Promise.all([
    db.collection("shareLinks").where("workspaceId", "==", ws).get(),
    db.collection(`workspaces/${ws}/pages`).select("invited").get(),
  ]);
  const writer = db.bulkWriter();
  links.docs.forEach((d) => void writer.delete(d.ref));
  await writer.close();

  const invitedKeys = new Set(pages.docs.flatMap((d) => Object.keys((d.get("invited") as Record<string, unknown> | undefined) ?? {})));
  for (const ek of invitedKeys) {
    const ref = db.collection("pendingInvites").doc(ek);
    // One waiting invite can list pages from several people: keep theirs.
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const items = { ...((snap.get("items") as Record<string, { workspaceId?: string }> | undefined) ?? {}) };
      for (const key of Object.keys(items)) if (items[key]?.workspaceId === ws) delete items[key];
      if (Object.keys(items).length) tx.update(ref, { items });
      else tx.delete(ref);
    });
  }
}

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
  if (db) {
    try {
      await clearChoice(user.id);
    } catch (e) {
      console.error("[dovli] Couldn't remove AI settings while deleting an account:", e);
    }
    try {
      await forgetSharing(db, user.id);
    } catch (e) {
      console.error("[dovli] Couldn't remove share links and invites while deleting an account:", e);
    }
  }
  if (user.email) await forgetEmail(user.email);
  // AI app connections: their secret addresses stop working at once.
  try {
    await mcpServer().removeAll(user.id);
  } catch (e) {
    console.error("[dovli] Couldn't remove AI app connections while deleting an account:", e);
  }
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
