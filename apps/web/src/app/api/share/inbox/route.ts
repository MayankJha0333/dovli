// POST {} → { items }: pages other people shared with the signed-in person ("Shared with me").

import { signedInRoute } from "@/lib/server/api";
import { sharingStore } from "@/lib/server/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = signedInRoute(async (user) => ({ items: await sharingStore().inbox(user.id) }));
