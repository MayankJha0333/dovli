// POST { action, workspaceId?, pageId, … } → manage one page's sharing (owner or editor only):
//   settings                       → { people, link }
//   invite  { email, role }        → { status, … } and sends the invite email
//   role    { uid | email, role }  → change access; role null removes it
//   link    { enabled?, role?, reset? } → { id, role, enabled }

import { cloudStore } from "@/lib/server/cloud";
import { CloudError } from "@/lib/server/cloudCore";
import { signedInRoute } from "@/lib/server/api";
import { sendShareInvite } from "@/lib/server/mailer";
import { sharingStore, siteOrigin } from "@/lib/server/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = signedInRoute(async (user, body, req) => {
  const share = sharingStore();
  const ws = typeof body.workspaceId === "string" && body.workspaceId ? body.workspaceId : await cloudStore().ensurePersonal(user.id);
  switch (body.action) {
    case "settings":
      return share.settings(user.id, ws, body.pageId);
    case "invite": {
      const r = await share.invite(user.id, ws, body.pageId, body.email, body.role);
      if (r.status === "member") return { ...r, emailed: false };
      const url = `${siteOrigin(req)}/p/${encodeURIComponent(r.workspaceId)}/${encodeURIComponent(r.pageId)}`;
      try {
        await sendShareInvite(r.email, { inviter: r.inviter, title: r.title ?? "Untitled", role: body.role === "editor" ? "editor" : "viewer", url, hasAccount: r.status === "added" });
        return { ...r, emailed: true };
      } catch (e) {
        console.error("[dovli] Couldn't send a share invite email:", e instanceof Error ? e.message : e);
        return { ...r, emailed: false };
      }
    }
    case "role":
      await share.setRole(user.id, ws, body.pageId, { uid: body.uid, email: body.email }, body.role ?? null);
      return share.settings(user.id, ws, body.pageId);
    case "link":
      return share.setLink(user.id, ws, body.pageId, { enabled: body.enabled, role: body.role, reset: body.reset });
    default:
      throw new CloudError("bad_request", "That request didn't make sense.", 400);
  }
});
