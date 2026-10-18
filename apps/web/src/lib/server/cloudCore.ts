// What Dovli keeps in Firestore, and the rules for changing it. No Firebase inside, so it can be
// tested on its own (cloudCore.test.ts); lib/server/cloud.ts plugs in Firestore.
//
//   users/{uid}                    one per person: email, name, photo, how they sign in, plan,
//                                  when they joined / last signed in / were last seen, and counts
//   users/{uid}/pages/{pageId}     every page and board they made, with readable details (title,
//                                  kind, folder, trash, dates, size) and the full content in `data`
//   users/{uid}/devices/{deviceId} every browser or phone they use Dovli on: platform, name,
//                                  app version, installed or not, first and last seen
//
// Pages sync with revisions: each person has a counter (users/{uid}.syncRev). Every saved change
// gets the next number, so a device asks "what changed after revision N?" and gets exactly that.
// A page saved from an out-of-date copy is refused with the newer copy, which the device merges.

import { MAX_PAGE_CHARS, type PageRow, type PushResult } from "@dovli/sync";
import type { Page } from "@dovli/core";

export type Doc = Record<string, any>;

export interface DocTx {
  get(path: string): Promise<Doc | undefined>;
  /** Write a document; with merge, only the given fields change. */
  set(path: string, data: Doc, merge?: boolean): void;
}

export interface CloudStore {
  /** All-or-nothing: reads see one moment, writes land together (or the whole thing retries). */
  transaction<T>(fn: (tx: DocTx) => Promise<T>): Promise<T>;
  /** Documents in a collection with `rev` above `after`, lowest first, at most `limit`. */
  listByRev(collection: string, after: number, limit: number): Promise<Doc[]>;
  /** Delete a document and everything under it. */
  deleteTree(path: string): Promise<void>;
}

export class CloudError extends Error {
  constructor(
    public code: "bad_request" | "not_configured",
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface Profile {
  uid: string;
  email?: string | null;
  name?: string | null;
  photoURL?: string | null;
  /** How they sign in: "google", "email-code". Added to what's known, never removed here. */
  signInMethods?: string[];
  /** When the account was made (from Firebase Authentication), if known. */
  createdAt?: Date | null;
  /** True when this call comes from a fresh sign-in (not just opening the app). */
  signedIn?: boolean;
}

export interface Device {
  deviceId: string;
  platform: "web" | "ios" | "android";
  name: string;
  appVersion: string;
  /** Installed as an app (home-screen web app, or the phone app). */
  installed: boolean;
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const userPath = (uid: string) => `users/${uid}`;
const pagePath = (uid: string, id: string) => `users/${uid}/pages/${id}`;
const devicePath = (uid: string, id: string) => `users/${uid}/devices/${id}`;

/** Leave out undefined values (Firestore refuses them) and cut text to a sensible length. */
function defined(o: Doc): Doc {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
const toDate = (ms: unknown) => (typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? new Date(ms) : null);

/** Which counter a page adds to: a live page or board, one in the trash, or none (deleted for good). */
function bucket(doc: Doc | undefined): "pageCount" | "boardCount" | "trashCount" | null {
  if (!doc || doc.purged) return null;
  if (doc.inTrash) return "trashCount";
  return doc.kind === "board" ? "boardCount" : "pageCount";
}

export function createCloud(deps: { store: CloudStore; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  const { store } = deps;

  function checkUid(uid: string) {
    if (!ID.test(uid)) throw new CloudError("bad_request", "That account id doesn't look right.", 400);
  }

  /** Create or refresh the person's record. Safe to call on every sign-in and app start. */
  async function upsertUser(p: Profile) {
    checkUid(p.uid);
    const t = now();
    await store.transaction(async (tx) => {
      const cur = await tx.get(userPath(p.uid));
      const methods = [...new Set([...((cur?.signInMethods as string[]) ?? []), ...(p.signInMethods ?? []).filter((m) => /^[a-z.-]{1,32}$/.test(m))])];
      tx.set(
        userPath(p.uid),
        defined({
          uid: p.uid,
          email: p.email === undefined ? undefined : text(p.email, 254),
          name: p.name === undefined ? undefined : text(p.name, 120),
          photoURL: p.photoURL === undefined ? undefined : text(p.photoURL, 1000),
          signInMethods: methods,
          createdAt: cur?.createdAt ?? p.createdAt ?? t,
          lastSignInAt: p.signedIn ? t : cur?.lastSignInAt,
          lastSeenAt: t,
          updatedAt: t,
          // Set once, so an admin can change them later in the console.
          plan: cur?.plan ?? "free",
          status: cur?.status ?? "active",
          syncRev: cur?.syncRev ?? 0,
          pageCount: cur?.pageCount ?? 0,
          boardCount: cur?.boardCount ?? 0,
          trashCount: cur?.trashCount ?? 0,
          deviceCount: cur?.deviceCount ?? 0,
        }),
        true,
      );
    });
  }

  /** A browser or phone opening Dovli: remember it, and when it was last seen. */
  async function checkIn(uid: string, raw: Doc) {
    checkUid(uid);
    const d = parseDevice(raw);
    const t = now();
    await store.transaction(async (tx) => {
      const [user, cur] = await Promise.all([tx.get(userPath(uid)), tx.get(devicePath(uid, d.deviceId))]);
      tx.set(devicePath(uid, d.deviceId), {
        deviceId: d.deviceId,
        platform: d.platform,
        name: d.name,
        appVersion: d.appVersion,
        installed: d.installed,
        firstSeenAt: cur?.firstSeenAt ?? t,
        lastSeenAt: t,
      });
      tx.set(userPath(uid), { uid, lastSeenAt: t, deviceCount: (user?.deviceCount ?? 0) + (cur ? 0 : 1) }, true);
    });
  }

  /** Pages changed after revision `cursor`, oldest first. Kept to a few MB per reply. */
  async function pull(uid: string, rawCursor: unknown, rawLimit: unknown): Promise<PageRow[]> {
    checkUid(uid);
    const cursor = typeof rawCursor === "number" && rawCursor >= 0 ? Math.floor(rawCursor) : 0;
    const limit = typeof rawLimit === "number" ? Math.min(500, Math.max(1, Math.floor(rawLimit))) : 500;
    const docs = await store.listByRev(`users/${uid}/pages`, cursor, limit);
    const rows: PageRow[] = [];
    let size = 0;
    for (const d of docs) {
      const json = typeof d.data === "string" ? d.data : null;
      if (rows.length && size + (json?.length ?? 0) > 6_000_000) break; // the rest comes next time
      size += json?.length ?? 0;
      rows.push({ id: d.id, rev: d.rev, purged: !!d.purged, data: d.purged || !json ? null : (JSON.parse(json) as Page) });
    }
    return rows;
  }

  /** Save one page if it was based on the cloud's latest copy; otherwise hand back that copy. */
  async function push(uid: string, body: Doc): Promise<PushResult> {
    checkUid(uid);
    const id = body.id;
    if (typeof id !== "string" || !ID.test(id)) throw new CloudError("bad_request", "That page id doesn't look right.", 400);
    const purged = body.purged === true;
    const baseRev = typeof body.baseRev === "number" ? body.baseRev : null;
    let page: Page | null = null;
    let json: string | null = null;
    if (!purged) {
      const p = body.data;
      if (!p || typeof p !== "object" || Array.isArray(p) || (p.kind !== "doc" && p.kind !== "board")) throw new CloudError("bad_request", "That page didn't make sense.", 400);
      page = { ...(p as Page), id };
      json = JSON.stringify(page);
      if (json.length > MAX_PAGE_CHARS) return { ok: false, rev: 0, tooBig: true };
    }
    const t = now();
    return store.transaction(async (tx): Promise<PushResult> => {
      const [user, cur] = await Promise.all([tx.get(userPath(uid)), tx.get(pagePath(uid, id))]);
      if (cur && cur.rev !== baseRev) {
        return { ok: false, rev: cur.rev, purged: !!cur.purged, data: cur.purged || typeof cur.data !== "string" ? null : (JSON.parse(cur.data) as Page) };
      }
      const rev = (user?.syncRev ?? 0) + 1;
      const next: Doc = page
        ? {
            id,
            rev,
            purged: false,
            kind: page.kind,
            title: text(page.title, 200) ?? "",
            mark: text(page.mark, 16) ?? "",
            parentId: text(page.parentId, 128),
            favorite: !!page.favorite,
            inTrash: !!page.deletedAt,
            deletedAt: toDate(page.deletedAt),
            createdAt: toDate(page.createdAt),
            updatedAt: toDate(page.updatedAt),
            size: json!.length,
            savedAt: t,
            data: json,
          }
        : // Deleted for good: keep a small marker so other devices learn about it.
          { id, rev, purged: true, kind: cur?.kind ?? null, title: cur?.title ?? "", inTrash: false, size: 0, savedAt: t, data: null, deletedAt: t };
      tx.set(pagePath(uid, id), next);
      const counts: Doc = {};
      const was = bucket(cur);
      const is = bucket(next);
      if (was !== is) {
        if (was) counts[was] = Math.max(0, (user?.[was] ?? 0) - 1);
        if (is) counts[is] = (user?.[is] ?? 0) + 1;
      }
      tx.set(userPath(uid), { uid, syncRev: rev, lastSeenAt: t, updatedAt: t, ...counts }, true);
      return { ok: true, rev };
    });
  }

  /** Everything kept for a person: their record, pages and devices. */
  const deleteUser = (uid: string) => (checkUid(uid), store.deleteTree(userPath(uid)));

  return { upsertUser, checkIn, pull, push, deleteUser };
}

function parseDevice(raw: Doc): Device {
  const deviceId = raw?.deviceId;
  if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(deviceId)) throw new CloudError("bad_request", "That device id doesn't look right.", 400);
  const platform = raw.platform === "ios" || raw.platform === "android" ? raw.platform : "web";
  return {
    deviceId,
    platform,
    name: text(raw.name, 80)?.trim() || (platform === "web" ? "Web browser" : "Phone"),
    appVersion: text(raw.appVersion, 32) ?? "",
    installed: raw.installed === true,
  };
}
