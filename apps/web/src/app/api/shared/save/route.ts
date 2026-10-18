// POST { workspaceId, pageId } or { linkId }, plus { title, blocks, baseRev } → save an edit to a
// shared page. Needs a sign-in and edit access. Out of date → { ok: false, rev, page }.

import { MAX_PAGE_CHARS } from "@dovli/sync";
import { route } from "@/lib/server/api";
import { sharingStore } from "@/lib/server/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(
  async (user, body) =>
    sharingStore().save(user?.id ?? null, typeof body.linkId === "string" ? { linkId: body.linkId } : { workspaceId: String(body.workspaceId ?? ""), pageId: String(body.pageId ?? "") }, body),
  MAX_PAGE_CHARS + 20_000,
);
