// Sharing one page (see lib/server/shareCore.ts): invite people by email as a viewer or editor,
// and an invitation link. Everything goes through Dovli's server (/api/share).

import { useSyncExternalStore } from "react";
import { auth } from "./auth";
import { authGateOn } from "./authGate";
import { siteOrigin } from "./desktop";
import { waitForPage } from "./sync";

export type ShareRole = "viewer" | "editor";
export interface SharePerson {
  uid: string | null;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  role: "owner" | ShareRole;
  /** Invited, but has no account yet. */
  pending: boolean;
}
export interface ShareLink {
  id: string;
  role: ShareRole;
  enabled: boolean;
}
export interface ShareSettings {
  workspaceId: string;
  pageId: string;
  people: SharePerson[];
  link: ShareLink | null;
}
export interface SharedItem {
  workspaceId: string;
  pageId: string;
  title: string;
  mark: string;
  kind: string;
  role: ShareRole;
  sharedByName: string;
}

/** Sharing needs accounts (Firebase). Without them, the Share window only exports. */
export const sharingOn = authGateOn;

export class ShareError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body: Record<string, unknown>, signedIn = true): Promise<T> {
  const token = await auth.accessToken();
  if (signedIn && !token) throw new ShareError("Please sign in again.", "signed_out");
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ShareError("Couldn't reach Dovli. Check your connection and try again.", "network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ShareError(data.error ?? "Something went wrong. Please try again.", data.code ?? "server");
  return data as T;
}

/** Ask the server, first making sure the page has reached the account (a new page may not have yet). */
async function manage<T>(pageId: string, body: Record<string, unknown>): Promise<T> {
  await waitForPage(pageId);
  try {
    return await call<T>("/api/share", { pageId, ...body });
  } catch (e) {
    if (!(e instanceof ShareError) || e.code !== "not_synced") throw e;
    await waitForPage(pageId, 15_000);
    return call<T>("/api/share", { pageId, ...body });
  }
}

export const share = {
  settings: (pageId: string) => manage<ShareSettings>(pageId, { action: "settings" }),
  invite: (pageId: string, email: string, role: ShareRole) =>
    manage<{ status: "added" | "invited" | "member"; email: string; name: string | null; emailed: boolean; again?: boolean }>(pageId, { action: "invite", email, role }),
  setRole: (pageId: string, who: { uid?: string | null; email?: string | null }, role: ShareRole | null) =>
    manage<ShareSettings>(pageId, { action: "role", uid: who.uid ?? undefined, email: who.uid ? undefined : (who.email ?? undefined), role }),
  setLink: (pageId: string, opts: { enabled?: boolean; role?: ShareRole; reset?: boolean }) => manage<ShareLink>(pageId, { action: "link", ...opts }),

  /** "Shared with me". */
  inbox: () => call<{ items: SharedItem[] }>("/api/share/inbox", {}).then((r) => r.items),

  /** Open a page shared with you (by invite) or through a link. Links work without signing in. */
  open: (target: { workspaceId: string; pageId: string } | { linkId: string }) =>
    call<{ workspaceId: string; pageId: string; role: "owner" | ShareRole; signInToEdit: boolean; rev: number; page: import("@dovli/core").Page; ownerName: string }>("/api/shared/open", target, false),
  save: (target: { workspaceId: string; pageId: string } | { linkId: string }, change: { title: string; blocks: unknown[]; baseRev: number }) =>
    call<{ ok: true; rev: number } | { ok: false; rev: number; page: import("@dovli/core").Page }>("/api/shared/save", { ...target, ...change }, false),
};

export const linkUrl = (id: string) => `${siteOrigin()}/s/${id}`;
export const invitedUrl = (workspaceId: string, pageId: string) => `${siteOrigin()}/p/${encodeURIComponent(workspaceId)}/${encodeURIComponent(pageId)}`;

/* ---------- "Shared with me", for the sidebar ---------- */

let items: SharedItem[] = [];
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

/** Fetch the list again (on start, when the window comes back into view). */
export function refreshShared() {
  if (!sharingOn || auth.get().status !== "signed-in") return Promise.resolve();
  loading ??= share
    .inbox()
    .then((list) => {
      items = list;
      listeners.forEach((l) => l());
    })
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function useSharedWithMe(): SharedItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
    () => items,
  );
}
