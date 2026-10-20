// What Dovli keeps in Firestore, and the rules for changing it. No Firebase inside, so it can be
// tested on its own (cloudCore.test.ts); lib/server/cloud.ts plugs in Firestore.
//
//   users/{uid}                         one per person: email, name, photo, how they sign in,
//                                       plan, status, dates, their personal workspace, devices
//   users/{uid}/devices/{deviceId}      every browser or phone they use (personal, never shared)
//   workspaces/{workspaceId}            a space of pages: name, kind (personal or team), owner,
//                                       members and their roles, counts, and the sync counter
//   workspaces/{workspaceId}/pages/{id} every page and board in it, with readable details
//                                       (title, kind, folder, trash, dates, who made / changed it)
//                                       and the full content in `data`
//
// Everyone has a personal workspace ("personal-{uid}"), made on their first visit. Pages saved
// before workspaces existed (users/{uid}/pages) move into it then, keeping their change numbers.
//
// Roles: owner (everything), editor (read and change pages), viewer (read only). Every read and
// save checks the role, on the server, inside the same transaction as the save.
//
// Sync: each workspace has a counter (syncRev). Every saved change gets the next number, so a
// device asks "what changed after N?" and gets exactly that. A save based on an out-of-date copy
// is refused with the newer copy, which the device merges.

import { MAX_PAGE_CHARS, type PageRow, type PushResult } from "@dovli/sync";
import type { Page } from "@dovli/core";

export type Doc = Record<string, any>;

export interface DocTx {
  get(path: string): Promise<Doc | undefined>;
  /** Write a document; with merge, only the given fields change. */
  set(path: string, data: Doc, merge?: boolean): void;
  delete(path: string): void;
}

export interface CloudStore {
  /** All-or-nothing: reads see one moment, writes land together (or the whole thing retries). */
  transaction<T>(fn: (tx: DocTx) => Promise<T>): Promise<T>;
  /** Documents in a collection with `rev` above `after`, lowest first, at most `limit`. */
  listByRev(collection: string, after: number, limit: number): Promise<Doc[]>;
  /** Up to `limit` documents in a collection, in no particular order. */
  list(collection: string, limit: number): Promise<Doc[]>;
  /** Delete a document and everything under it. */
  deleteTree(path: string): Promise<void>;
}

export class CloudError extends Error {
  constructor(
    public code: "bad_request" | "not_configured" | "forbidden" | "not_found" | "not_synced" | "limit" | "conflict",
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type Role = "owner" | "editor" | "viewer";

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

const ID = /^[A-Za-z0-9_-]{1,128}$/;
/** Sharing settings kept on a page record; a save from the owner's devices never drops them. */
export const SHARE_FIELDS = ["shared", "sharedIds", "invited", "linkId"] as const;
const keepSharing = (cur: Doc | undefined) => Object.fromEntries(SHARE_FIELDS.filter((k) => cur?.[k] !== undefined).map((k) => [k, cur![k]]));
const COUNTERS = ["pageCount", "boardCount", "trashCount"] as const;
/** Fields that lived on the user record before workspaces, moved to the personal workspace. */
const OLD_USER_FIELDS = ["syncRev", ...COUNTERS];

export const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);
export const personalWorkspaceId = (uid: string) => `personal-${uid}`;
const userPath = (uid: string) => `users/${uid}`;
const devicePath = (uid: string, id: string) => `users/${uid}/devices/${id}`;
const oldPagesPath = (uid: string) => `users/${uid}/pages`;
const wsPath = (id: string) => `workspaces/${id}`;
const wsPagesPath = (id: string) => `workspaces/${id}/pages`;
const wsPagePath = (id: string, pageId: string) => `workspaces/${id}/pages/${pageId}`;

/** Leave out undefined values (Firestore refuses them). */
function defined(o: Doc): Doc {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
const toDate = (ms: unknown) => (typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? new Date(ms) : null);

/** Which counter a page adds to: a live page or board, one in the trash, or none (deleted for good). */
function bucket(doc: Doc | undefined): (typeof COUNTERS)[number] | null {
  if (!doc || doc.purged) return null;
  if (doc.inTrash) return "trashCount";
  return doc.kind === "board" ? "boardCount" : "pageCount";
}

const canRead = (role: Role | undefined) => role === "owner" || role === "editor" || role === "viewer";
const canWrite = (role: Role | undefined) => role === "owner" || role === "editor";

function spaceName(user: Doc | undefined, uid: string) {
  const name = (typeof user?.name === "string" && user.name.trim()) || (typeof user?.email === "string" && user.email.split("@")[0]) || "";
  const first = name.split(/\s+/)[0];
  return first ? `${first}'s space` : uid ? "My space" : "Space";
}

export function createCloud(deps: { store: CloudStore; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  const { store } = deps;
  /** Personal workspaces known to be ready on this server, so the check runs once per person. */
  const ready = new Set<string>();

  function checkUid(uid: string) {
    if (!ID.test(uid)) throw new CloudError("bad_request", "That account id doesn't look right.", 400);
  }

  /**
   * Make sure the person's personal workspace exists, and that pages saved before workspaces
   * have moved into it. Safe to run twice at once: each page is copied only if it isn't there yet.
   */
  async function ensurePersonal(uid: string): Promise<string> {
    checkUid(uid);
    const id = personalWorkspaceId(uid);
    if (ready.has(uid)) return id;
    const t = now();
    const needsMove = await store.transaction(async (tx) => {
      const [user, ws] = await Promise.all([tx.get(userPath(uid)), tx.get(wsPath(id))]);
      if (ws) return !!ws.movingOldPages;
      // Start the counter where the old one was, so devices keep their place and don't re-download.
      const hadOld = typeof user?.syncRev === "number" && user.syncRev > 0;
      tx.set(wsPath(id), {
        id,
        name: spaceName(user, uid),
        kind: "personal",
        ownerId: uid,
        memberIds: [uid],
        roles: { [uid]: "owner" },
        createdAt: t,
        updatedAt: t,
        syncRev: hadOld ? user!.syncRev : 0,
        pageCount: hadOld ? (user!.pageCount ?? 0) : 0,
        boardCount: hadOld ? (user!.boardCount ?? 0) : 0,
        trashCount: hadOld ? (user!.trashCount ?? 0) : 0,
        movingOldPages: hadOld,
      });
      tx.set(userPath(uid), { uid, personalWorkspaceId: id }, true);
      return hadOld;
    });
    if (needsMove) await moveOldPages(uid, id);
    ready.add(uid);
    return id;
  }

  /** users/{uid}/pages → workspaces/personal-{uid}/pages, same change numbers; then tidy up. */
  async function moveOldPages(uid: string, wsId: string) {
    let after = -1;
    for (;;) {
      const docs = await store.listByRev(oldPagesPath(uid), after, 200);
      if (!docs.length) break;
      for (const d of docs) {
        await store.transaction(async (tx) => {
          // A newer save may already be in the new place: never overwrite it with the old copy.
          if (!(await tx.get(wsPagePath(wsId, d.id)))) tx.set(wsPagePath(wsId, d.id), { ...d, workspaceId: wsId, createdBy: uid, updatedBy: uid });
          tx.delete(`${oldPagesPath(uid)}/${d.id}`);
        });
      }
      after = docs[docs.length - 1].rev;
      if (docs.length < 200) break;
    }
    await store.transaction(async (tx) => {
      const user = await tx.get(userPath(uid));
      if (user) tx.set(userPath(uid), Object.fromEntries(Object.entries(user).filter(([k]) => !OLD_USER_FIELDS.includes(k))));
      tx.set(wsPath(wsId), { movingOldPages: false, updatedAt: now() }, true);
    });
  }

  /** The person's role in a workspace (inside a transaction), or an error if they have none. */
  function roleIn(ws: Doc | undefined, uid: string, need: "read" | "write"): Role {
    if (!ws) throw new CloudError("not_found", "That workspace doesn't exist.", 404);
    const role = ws.roles?.[uid] as Role | undefined;
    if (!canRead(role)) throw new CloudError("forbidden", "You don't have access to this workspace.", 403);
    if (need === "write" && !canWrite(role)) throw new CloudError("forbidden", "You can view this workspace but not change it.", 403);
    return role!;
  }

  /** Which workspace a request is about: the one asked for, or the person's own. */
  async function workspaceFor(uid: string, raw: unknown): Promise<string> {
    if (raw === undefined || raw === null || raw === "" || raw === personalWorkspaceId(uid)) return ensurePersonal(uid);
    if (typeof raw !== "string" || !ID.test(raw)) throw new CloudError("bad_request", "That workspace id doesn't look right.", 400);
    return raw;
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
          deviceCount: cur?.deviceCount ?? 0,
        }),
        true,
      );
    });
    await ensurePersonal(p.uid);
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
        ownerId: uid,
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

  /** Pages changed after revision `cursor` in a workspace, oldest first. Kept to a few MB per reply. */
  async function pull(uid: string, body: Doc): Promise<PageRow[]> {
    checkUid(uid);
    const wsId = await workspaceFor(uid, body.workspaceId);
    await store.transaction(async (tx) => void roleIn(await tx.get(wsPath(wsId)), uid, "read"));
    const cursor = typeof body.cursor === "number" && body.cursor >= 0 ? Math.floor(body.cursor) : 0;
    const limit = typeof body.limit === "number" ? Math.min(500, Math.max(1, Math.floor(body.limit))) : 500;
    const docs = await store.listByRev(wsPagesPath(wsId), cursor, limit);
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

  /** Save one page if it was based on the latest copy; otherwise hand back that copy. */
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
    const wsId = await workspaceFor(uid, body.workspaceId);
    const t = now();
    return store.transaction(async (tx): Promise<PushResult> => {
      const [ws, cur] = await Promise.all([tx.get(wsPath(wsId)), tx.get(wsPagePath(wsId, id))]);
      roleIn(ws, uid, "write");
      if (cur && cur.rev !== baseRev) {
        return { ok: false, rev: cur.rev, purged: !!cur.purged, data: cur.purged || typeof cur.data !== "string" ? null : (JSON.parse(cur.data) as Page) };
      }
      const rev = (ws!.syncRev ?? 0) + 1;
      const who = { workspaceId: wsId, createdBy: cur?.createdBy ?? uid, updatedBy: uid };
      const next: Doc = page
        ? pageRecord(page, json!, rev, who, t)
        : // Deleted for good: keep a small marker so other devices learn about it.
          { id, rev, purged: true, ...who, kind: cur?.kind ?? null, title: cur?.title ?? "", inTrash: false, size: 0, savedAt: t, data: null, deletedAt: t };
      tx.set(wsPagePath(wsId, id), page ? { ...next, ...keepSharing(cur) } : next);
      const counts: Doc = {};
      const was = bucket(cur);
      const is = bucket(next);
      if (was !== is) {
        if (was) counts[was] = Math.max(0, (ws![was] ?? 0) - 1);
        if (is) counts[is] = (ws![is] ?? 0) + 1;
      }
      tx.set(wsPath(wsId), { syncRev: rev, updatedAt: t, ...counts }, true);
      return { ok: true, rev };
    });
  }

  /** The newest revision in the person's workspace: where a client starts following changes from. */
  async function latest(uid: string, workspaceId?: unknown): Promise<number> {
    checkUid(uid);
    const wsId = await workspaceFor(uid, workspaceId);
    return store.transaction(async (tx) => {
      const ws = await tx.get(wsPath(wsId));
      roleIn(ws, uid, "read");
      return (ws?.syncRev as number) ?? 0;
    });
  }

  /** Everything kept for a person: their record and devices, and their personal workspace. */
  async function deleteUser(uid: string) {
    checkUid(uid);
    ready.delete(uid);
    await store.deleteTree(wsPath(personalWorkspaceId(uid)));
    await store.deleteTree(userPath(uid));
  }

  return { upsertUser, ensurePersonal, checkIn, pull, push, latest, deleteUser };
}

/** The stored record of a page: readable details, plus the full page as JSON text in `data`. */
export function pageRecord(page: Page, json: string, rev: number, who: { workspaceId: string; createdBy: string; updatedBy: string }, savedAt: Date): Doc {
  return {
    id: page.id,
    rev,
    purged: false,
    ...who,
    kind: page.kind,
    title: text(page.title, 200) ?? "",
    mark: text(page.mark, 16) ?? "",
    parentId: text(page.parentId, 128),
    favorite: !!page.favorite,
    inTrash: !!page.deletedAt,
    deletedAt: toDate(page.deletedAt),
    createdAt: toDate(page.createdAt),
    updatedAt: toDate(page.updatedAt),
    size: json.length,
    savedAt,
    data: json,
  };
}

function parseDevice(raw: Doc) {
  const deviceId = raw?.deviceId;
  if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(deviceId)) throw new CloudError("bad_request", "That device id doesn't look right.", 400);
  const platform: "web" | "ios" | "android" = raw.platform === "ios" || raw.platform === "android" ? raw.platform : "web";
  return {
    deviceId,
    platform,
    name: text(raw.name, 80)?.trim() || (platform === "web" ? "Web browser" : "Phone"),
    appVersion: text(raw.appVersion, 32) ?? "",
    installed: raw.installed === true,
  };
}
