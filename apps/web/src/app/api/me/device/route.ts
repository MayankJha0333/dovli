// POST { deviceId, platform, name, appVersion, installed } → { ok }: the app opened on a device.
// Also refreshes the person's record (name, photo, last seen), so it stays current.

import { cloudStore } from "@/lib/server/cloud";
import { signedInRoute } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = signedInRoute(async (user, body) => {
  const cloud = cloudStore();
  await cloud.upsertUser({ uid: user.id, email: user.email ?? undefined, name: user.name, photoURL: user.picture, signInMethods: user.signInMethod ? [user.signInMethod] : [] });
  await cloud.checkIn(user.id, body);
  return { ok: true };
});
