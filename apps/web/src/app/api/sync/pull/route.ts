// POST { cursor, limit, workspaceId? } → { rows }: a workspace's pages changed after revision
// `cursor` (the person's own workspace when none is given). Needs at least viewer access.

import { cloudStore } from "@/lib/server/cloud";
import { signedInRoute } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = signedInRoute(async (user, body) => ({ rows: await cloudStore().pull(user.id, body) }));
