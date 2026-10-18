// POST { cursor, limit } → { rows }: this person's pages changed after revision `cursor`.

import { cloudStore } from "@/lib/server/cloud";
import { signedInRoute } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = signedInRoute(async (user, body) => ({ rows: await cloudStore().pull(user.id, body.cursor, body.limit) }));
