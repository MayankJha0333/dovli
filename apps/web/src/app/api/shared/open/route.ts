// POST { workspaceId, pageId } or { linkId } → the shared page, its revision and your access.
// Works without signing in for links (view only then).

import { route } from "@/lib/server/api";
import { sharingStore } from "@/lib/server/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (user, body) =>
  sharingStore().open(user?.id ?? null, typeof body.linkId === "string" ? { linkId: body.linkId } : { workspaceId: String(body.workspaceId ?? ""), pageId: String(body.pageId ?? "") }),
);
