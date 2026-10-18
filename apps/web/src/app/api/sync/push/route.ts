// POST { id, data, baseRev, purged, workspaceId? } → { ok, rev, data?, purged?, tooBig? }: save one
// page in a workspace (the person's own when none is given). Needs owner or editor access.

import { MAX_PAGE_CHARS } from "@dovli/sync";
import { cloudStore } from "@/lib/server/cloud";
import { signedInRoute } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = signedInRoute((user, body) => cloudStore().push(user.id, body), MAX_PAGE_CHARS + 20_000);

export async function POST(req: Request) {
  // A page that's clearly over the limit gets a calm "too big" rather than an error.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PAGE_CHARS + 20_000) return Response.json({ ok: false, rev: 0, tooBig: true });
  return handler(req);
}
