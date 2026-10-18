// Sharing one page, the way Craft does it: invite people by email as a viewer or an editor, or
// turn on a link that anyone can open (view without an account; editing needs one). No Firebase
// inside, so it can be tested on its own (shareCore.test.ts).
//
// Kept on the page record (workspaces/{ws}/pages/{id}):
//   shared     { uid: "viewer" | "editor" }   people with an account
//   sharedIds  [uid, …]                       the same people, as a list
//   invited    { emailKey: { email, role } }  invited emails that have no account yet
//   linkId     the page's link, if it has one
// Elsewhere:
//   shareLinks/{linkId}                 { workspaceId, pageId, role, enabled }
//   users/{uid}/shared/{ws~page}        the person's "Shared with me" list
//   pendingInvites/{emailKey}           invites waiting for that email to sign up
//
// Workspace owners and editors manage sharing. Invited editors can change the page; viewers
// can read it. The role is checked on the server for every open and save.

import { randomBytes } from "node:crypto";
import type { Page } from "@dovli/core";
import { MAX_PAGE_CHARS } from "@dovli/sync";
import { CloudError, SHARE_FIELDS, isId, pageRecord, type CloudStore, type Doc, type DocTx, type Role } from "./cloudCore";
import { emailKey, normalizeEmail } from "./emailCodeCore";

export type ShareRole = "viewer" | "editor";
export interface Person {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
}
export interface ShareDeps {
  store: CloudStore;
  accounts: { findByEmail(email: string): Promise<Person | null>; get(uid: string): Promise<Person | null> };
  now?: () => Date;
  makeLinkId?: () => string;
}
/** Which page: by workspace and page id (invited people), or by link. */
export type Target = { workspaceId: string; pageId: string } | { linkId: string };

const MAX_PEOPLE = 50;
const RANK: Record<string, number> = { viewer: 1, editor: 2, owner: 3 };
const best = (...roles: (string | null | undefined)[]) => roles.reduce<string | null>((a, r) => (r && (!a || RANK[r] > RANK[a]) ? r : a), null) as Role | null;

const wsPath = (ws: string) => `workspaces/${ws}`;
const pagePath = (ws: string, id: string) => `workspaces/${ws}/pages/${id}`;
const linkPath = (id: string) => `shareLinks/${id}`;
const inboxKey = (ws: string, id: string) => `${ws}~${id}`;
const inboxPath = (uid: string, ws: string, id: string) => `users/${uid}/shared/${inboxKey(ws, id)}`;
const pendingPath = (ek: string) => `pendingInvites/${ek}`;

function role(raw: unknown): ShareRole {
  if (raw === "viewer" || raw === "editor") return raw;
  throw new CloudError("bad_request", "Choose “Can view” or “Can edit”.", 400);
}
function ids(workspaceId: unknown, pageId: unknown) {
  if (!isId(workspaceId) || !isId(pageId)) throw new CloudError("bad_request", "That page address doesn't look right.", 400);
  return { ws: workspaceId, id: pageId };
}
const missing = () => new CloudError("not_found", "This page isn't available. It may have been unshared or deleted.", 404);

export function createSharing(deps: ShareDeps) {
  const now = deps.now ?? (() => new Date());
  const makeLinkId = deps.makeLinkId ?? (() => randomBytes(16).toString("base64url"));
  const { store } = deps;

  /** Read a page for managing its sharing: it must exist, and you must own or edit its workspace. */
  async function manageable(tx: DocTx, uid: string, ws: string, id: string) {
    const [space, page] = await Promise.all([tx.get(wsPath(ws)), tx.get(pagePath(ws, id))]);
    if (!space) throw new CloudError("not_found", "That workspace doesn't exist.", 404);
    const r = space.roles?.[uid];
    if (r !== "owner" && r !== "editor") throw new CloudError("forbidden", "Only the page's owner or editors can share it.", 403);
    if (!page || page.purged) throw new CloudError("not_synced", "This page is still being saved to your account. Try again in a moment.", 409);
    return { space, page };
  }

  /** Who can open this page and how: owner, editor or viewer (or nothing). */
  function roleFor(uid: string | null, space: Doc | undefined, page: Doc | undefined, link: Doc | undefined): Role | null {
    if (!page || page.purged || page.inTrash) return null;
    const fromSpace = uid ? (space?.roles?.[uid] as Role | undefined) : undefined;
    const fromInvite = uid ? (page.shared?.[uid] as Role | undefined) : undefined;
    // A link gives view access to anyone, and edit access to anyone signed in.
    const fromLink = link?.enabled ? (link.role === "editor" && uid ? "editor" : "viewer") : undefined;
    return best(fromSpace, fromInvite, fromLink);
  }

  async function resolve(tx: DocTx, uid: string | null, target: Target) {
    let ws: string, id: string, link: Doc | undefined;
    const linkId = "linkId" in target ? target.linkId : null;
    if ("linkId" in target) {
      if (typeof target.linkId !== "string" || !/^[A-Za-z0-9_-]{10,64}$/.test(target.linkId)) throw missing();
      link = await tx.get(linkPath(target.linkId));
      if (!link?.enabled) throw missing();
      ({ ws, id } = { ws: link.workspaceId, id: link.pageId });
    } else ({ ws, id } = ids(target.workspaceId, target.pageId));
    const [space, page] = await Promise.all([tx.get(wsPath(ws)), tx.get(pagePath(ws, id))]);
    if (link && page?.linkId !== linkId) throw missing(); // the link was reset
    const r = roleFor(uid, space, page, link);
    if (!r) throw missing();
    return { ws, id, space: space!, page: page!, role: r, link };
  }

  /** The page's sharing settings, for the Share window. */
  async function settings(uid: string, workspaceId: unknown, pageId: unknown) {
    const { ws, id } = ids(workspaceId, pageId);
    const { space, page } = await store.transaction((tx) => manageable(tx, uid, ws, id));
    const link = page.linkId ? await store.transaction((tx) => tx.get(linkPath(page.linkId))) : undefined;
    const people = await Promise.all(
      Object.entries((page.shared ?? {}) as Record<string, ShareRole>).map(async ([pid, r]) => ({ ...(await person(pid)), role: r as Role, pending: false })),
    );
    const owner = { ...(await person(space.ownerId)), role: "owner" as Role, pending: false };
    const pending = Object.values((page.invited ?? {}) as Record<string, { email: string; role: ShareRole }>).map((v) => ({ uid: null, email: v.email, name: null, photoURL: null, role: v.role as Role, pending: true }));
    return {
      workspaceId: ws,
      pageId: id,
      people: [owner, ...people.sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")), ...pending],
      link: link ? { id: link.linkId as string, role: link.role as ShareRole, enabled: !!link.enabled } : null,
    };
  }

  async function person(pid: string): Promise<Person> {
    return (await deps.accounts.get(pid)) ?? { uid: pid, email: null, name: null, photoURL: null };
  }

  /**
   * Invite someone by email. With an account, they get access right away; otherwise it waits
   * until that email signs up. Returns what to put in the invite email.
   */
  async function invite(uid: string, workspaceId: unknown, pageId: unknown, rawEmail: unknown, rawRole: unknown) {
    const { ws, id } = ids(workspaceId, pageId);
    const email = normalizeEmail(rawEmail);
    const r = role(rawRole);
    const [me, them] = await Promise.all([person(uid), deps.accounts.findByEmail(email)]);
    if (them?.uid === uid || me.email === email) throw new CloudError("bad_request", "That's you. You already have access.", 400);
    const t = now();
    const ek = emailKey(email);
    const result = await store.transaction(async (tx) => {
      const pend = them ? undefined : await tx.get(pendingPath(ek));
      const { space, page } = await manageable(tx, uid, ws, id);
      if (them && space.roles?.[them.uid]) return { status: "member" as const }; // already in the workspace
      const count = Object.keys(page.shared ?? {}).length + Object.keys(page.invited ?? {}).length;
      const already = them ? page.shared?.[them.uid] : page.invited?.[ek];
      if (!already && count >= MAX_PEOPLE) throw new CloudError("limit", `A page can be shared with up to ${MAX_PEOPLE} people.`, 400);
      const title = page.title || "Untitled";
      if (them) {
        const shared = { ...(page.shared ?? {}), [them.uid]: r };
        tx.set(pagePath(ws, id), { shared, sharedIds: Object.keys(shared) }, true);
        tx.set(inboxPath(them.uid, ws, id), { workspaceId: ws, pageId: id, role: r, title, sharedBy: uid, sharedByName: me.name ?? me.email ?? "Someone", sharedAt: t });
      } else {
        tx.set(pagePath(ws, id), { invited: { ...(page.invited ?? {}), [ek]: { email, role: r, invitedBy: uid, invitedAt: t } } }, true);
        tx.set(pendingPath(ek), { email, items: { ...(pend?.items ?? {}), [inboxKey(ws, id)]: { workspaceId: ws, pageId: id, role: r, title, sharedBy: uid, sharedByName: me.name ?? me.email ?? "Someone", sharedAt: t } } });
      }
      return { status: them ? ("added" as const) : ("invited" as const), title, again: !!already };
    });
    return { ...result, email, name: them?.name ?? null, inviter: me.name ?? me.email ?? "Someone", workspaceId: ws, pageId: id };
  }

  /** Change someone's access, or remove it (role null). Works for people and pending invites. */
  async function setRole(uid: string, workspaceId: unknown, pageId: unknown, who: { uid?: unknown; email?: unknown }, rawRole: unknown) {
    const { ws, id } = ids(workspaceId, pageId);
    const r = rawRole === null ? null : role(rawRole);
    await store.transaction(async (tx) => {
      if (isId(who.uid)) {
        const target = who.uid;
        const entry = await tx.get(inboxPath(target, ws, id));
        const { page } = await manageable(tx, uid, ws, id);
        if (!page.shared?.[target]) throw new CloudError("not_found", "That person doesn't have access.", 404);
        const shared = { ...page.shared };
        if (r) shared[target] = r;
        else delete shared[target];
        tx.set(pagePath(ws, id), { shared, sharedIds: Object.keys(shared) }, true);
        if (r && entry) tx.set(inboxPath(target, ws, id), { role: r }, true);
        if (!r) tx.delete(inboxPath(target, ws, id));
        return;
      }
      const email = normalizeEmail(who.email);
      const ek = emailKey(email);
      const pend = await tx.get(pendingPath(ek));
      const { page } = await manageable(tx, uid, ws, id);
      if (!page.invited?.[ek]) throw new CloudError("not_found", "That invite isn't there any more.", 404);
      const invited = { ...page.invited };
      const items = { ...(pend?.items ?? {}) };
      if (r) {
        invited[ek] = { ...invited[ek], role: r };
        if (items[inboxKey(ws, id)]) items[inboxKey(ws, id)] = { ...items[inboxKey(ws, id)], role: r };
      } else {
        delete invited[ek];
        delete items[inboxKey(ws, id)];
      }
      tx.set(pagePath(ws, id), { invited }, true);
      if (Object.keys(items).length) tx.set(pendingPath(ek), { email, items });
      else tx.delete(pendingPath(ek));
    });
  }

  /** Turn the link on or off, change what it allows, or replace it with a new one. */
  async function setLink(uid: string, workspaceId: unknown, pageId: unknown, opts: { enabled?: unknown; role?: unknown; reset?: unknown }) {
    const { ws, id } = ids(workspaceId, pageId);
    const t = now();
    return store.transaction(async (tx) => {
      const { page } = await manageable(tx, uid, ws, id);
      const cur = page.linkId ? await tx.get(linkPath(page.linkId)) : undefined;
      const next = {
        role: opts.role === undefined ? ((cur?.role as ShareRole) ?? "viewer") : role(opts.role),
        enabled: opts.enabled === undefined ? (cur?.enabled ?? true) : opts.enabled === true,
      };
      let linkId = cur?.linkId as string | undefined;
      if (!linkId || opts.reset === true) {
        if (linkId) tx.delete(linkPath(linkId));
        linkId = makeLinkId();
        tx.set(linkPath(linkId), { linkId, workspaceId: ws, pageId: id, ...next, createdBy: uid, createdAt: t, updatedAt: t });
        tx.set(pagePath(ws, id), { linkId }, true);
      } else tx.set(linkPath(linkId), { ...next, updatedAt: t }, true);
      return { id: linkId, ...next };
    });
  }

  /** A person just signed in: invites that waited for their email become access. */
  async function claim(uid: string, rawEmail: string | null | undefined): Promise<number> {
    if (!rawEmail) return 0;
    const email = normalizeEmail(rawEmail);
    const ek = emailKey(email);
    return store.transaction(async (tx) => {
      const pend = await tx.get(pendingPath(ek));
      const items = Object.values((pend?.items ?? {}) as Record<string, Doc>);
      if (!pend) return 0;
      const pages = await Promise.all(items.map((it) => tx.get(pagePath(it.workspaceId, it.pageId))));
      let n = 0;
      items.forEach((it, i) => {
        const page = pages[i];
        const inv = page?.invited?.[ek];
        if (!page || page.purged || !inv) return;
        const invited = { ...page.invited };
        delete invited[ek];
        const shared = { ...(page.shared ?? {}), [uid]: inv.role };
        tx.set(pagePath(it.workspaceId, it.pageId), { invited, shared, sharedIds: Object.keys(shared) }, true);
        tx.set(inboxPath(uid, it.workspaceId, it.pageId), { ...it, role: inv.role });
        n++;
      });
      tx.delete(pendingPath(ek));
      return n;
    });
  }

  /** "Shared with me": pages others shared with this person, with current titles. Gone ones are tidied away. */
  async function inbox(uid: string) {
    const entries = await store.list(`users/${uid}/shared`, 200);
    const out: { workspaceId: string; pageId: string; title: string; mark: string; kind: string; role: ShareRole; sharedByName: string; sharedAt: unknown }[] = [];
    for (const e of entries) {
      const page = await store.transaction((tx) => tx.get(pagePath(e.workspaceId, e.pageId)));
      const r = page?.shared?.[uid] as ShareRole | undefined;
      if (!page || page.purged || !r) {
        await store.transaction(async (tx) => tx.delete(inboxPath(uid, e.workspaceId, e.pageId)));
        continue;
      }
      if (page.inTrash) continue;
      out.push({ workspaceId: e.workspaceId, pageId: e.pageId, title: page.title || "Untitled", mark: page.mark ?? "", kind: page.kind, role: r, sharedByName: e.sharedByName ?? "Someone", sharedAt: e.sharedAt });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  }

  /** Open a shared page (by invite or link). `uid` is null for someone not signed in. */
  async function open(uid: string | null, target: Target) {
    const { ws, id, page, space, role: r, link } = await store.transaction((tx) => resolve(tx, uid, target));
    const owner = await person(space.ownerId);
    return {
      workspaceId: ws,
      pageId: id,
      role: r,
      /** A signed-out visitor on an edit link: signing in would let them edit. */
      signInToEdit: !uid && link?.role === "editor",
      rev: page.rev as number,
      page: JSON.parse(page.data) as Page,
      ownerName: owner.name ?? owner.email ?? "Someone",
    };
  }

  /** Save an edit to a shared page: its title and content. Refused for viewers, and when out of date. */
  async function save(uid: string | null, target: Target, body: Doc) {
    if (!uid) throw new CloudError("forbidden", "Sign in to edit this page.", 401);
    const baseRev = typeof body.baseRev === "number" ? body.baseRev : -1;
    if (body.blocks !== undefined && !Array.isArray(body.blocks)) throw new CloudError("bad_request", "That change didn't make sense.", 400);
    const t = now();
    return store.transaction(async (tx) => {
      const { ws, id, space, page: cur, role: r } = await resolve(tx, uid, target);
      if (r !== "owner" && r !== "editor") throw new CloudError("forbidden", "You can view this page but not change it.", 403);
      const current = JSON.parse(cur.data) as Page;
      if (cur.rev !== baseRev) return { ok: false as const, rev: cur.rev as number, page: current };
      if (current.kind !== "doc") throw new CloudError("bad_request", "Only pages can be edited here, not whiteboards.", 400);
      const next: Page = {
        ...current,
        title: typeof body.title === "string" ? body.title.slice(0, 500) : current.title,
        blocks: Array.isArray(body.blocks) ? body.blocks : current.blocks,
        updatedAt: t.getTime(),
      };
      const json = JSON.stringify(next);
      if (json.length > MAX_PAGE_CHARS) throw new CloudError("limit", "This page is too big to save from here (over 900 KB).", 413);
      const rev = (space.syncRev ?? 0) + 1;
      const record = pageRecord(next, json, rev, { workspaceId: ws, createdBy: cur.createdBy ?? space.ownerId, updatedBy: uid }, t);
      // Keep the sharing settings (Firestore refuses undefined, so only those that are set).
      const sharing = Object.fromEntries(SHARE_FIELDS.filter((k) => cur[k] !== undefined).map((k) => [k, cur[k]]));
      tx.set(pagePath(ws, id), { ...record, ...sharing });
      tx.set(wsPath(ws), { syncRev: rev, updatedAt: t }, true);
      return { ok: true as const, rev };
    });
  }

  return { settings, invite, setRole, setLink, claim, inbox, open, save };
}
