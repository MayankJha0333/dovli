import type { SupabaseClient } from "@supabase/supabase-js";
import { mergePage, type Page } from "@dovli/core";
import { supabaseTransport } from "./supabase";
import { MAX_PAGE_CHARS, type SyncHost, type SyncStatus, type SyncTransport } from "./types";

// Keeps this device and the cloud in step.
//
// - Every edit on this device is written locally first and added to a "pending" list.
// - push(): sends each pending page with the cloud revision it was based on. If someone else
//   changed it in the meantime, the cloud says no, we merge the two versions (mergePage) and try again.
// - pull(): fetches every page changed in the cloud since the last pull. Pages not edited here are
//   replaced; pages edited here too are merged.
// - It runs on start, when the device comes back online, when the cloud reports a change (if the
//   transport can tell), a moment after each local edit, and every 30 seconds as a safety net.
// - Where pages go is the transport's business: Dovli's server (Firestore) or Supabase.

const PULL_PAGE = 500;
const SAFETY_INTERVAL = 30_000;
const PUSH_DELAY = 1_200;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface SyncEngineOptions {
  /** Where pages go. (Or pass `supabase` for the older Supabase setup.) */
  transport?: SyncTransport;
  supabase?: SupabaseClient;
  host: SyncHost;
  /** Is the network up? Defaults to navigator.onLine where it exists. */
  isOnline?: () => boolean;
  /** Subscribe to "came back online"; returns an unsubscribe function. */
  onOnline?: (cb: () => void) => () => void;
  bucket?: string;
}

export class SyncEngine {
  private transport: SyncTransport;
  private host: SyncHost;
  private isOnline: () => boolean;
  /** Pages over the size limit, found in the last round: kept here, not sent. */
  private tooBig = new Set<string>();
  private userId: string | null = null;
  private running = false;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private unwatch: (() => void) | null = null;
  private offOnline: (() => void) | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  status: SyncStatus = { state: "signed-out", pending: 0, lastSyncedAt: null };

  constructor(opts: SyncEngineOptions) {
    const transport = opts.transport ?? (opts.supabase ? supabaseTransport(opts.supabase, opts.bucket) : null);
    if (!transport) throw new Error("SyncEngine needs a transport");
    this.transport = transport;
    this.host = opts.host;
    this.isOnline = opts.isOnline ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
    this.offOnline = opts.onOnline?.(() => this.syncSoon(0)) ?? null;
  }

  subscribe(cb: (s: SyncStatus) => void) {
    this.listeners.add(cb);
    cb(this.status);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((l) => l(this.status));
  }

  /** Start syncing for a signed-in user. Call stop() when they sign out. */
  start(userId: string) {
    if (this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.unwatch = this.transport.watch?.(userId, () => this.syncSoon(300)) ?? null;
    this.interval = setInterval(() => this.syncSoon(0), SAFETY_INTERVAL);
    this.syncSoon(0);
  }

  stop() {
    this.userId = null;
    clearTimeout(this.timer);
    clearInterval(this.interval);
    this.unwatch?.();
    this.unwatch = null;
    this.setStatus({ state: "signed-out", error: undefined });
  }

  dispose() {
    this.stop();
    this.offOnline?.();
  }

  /** Something changed on this device; push it shortly. */
  notifyLocalChange() {
    void this.host.pending().then((p) => this.setStatus({ pending: p.length }));
    this.syncSoon(PUSH_DELAY);
  }

  syncSoon(delay = PUSH_DELAY) {
    if (!this.userId) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), delay);
  }

  async syncNow(): Promise<void> {
    if (!this.userId) return;
    if (!this.isOnline()) {
      const pending = (await this.host.pending()).length;
      this.setStatus({ state: "offline", pending });
      return;
    }
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    this.setStatus({ state: "syncing", error: undefined });
    this.tooBig.clear();
    try {
      let rounds = 0;
      do {
        this.again = false;
        await this.pull();
        await this.push();
        await this.uploadFiles();
      } while (this.again && ++rounds < 5);
      const pending = (await this.host.pending()).length;
      const waiting = pending - this.tooBig.size;
      if (this.tooBig.size) {
        const n = this.tooBig.size;
        this.setStatus({
          state: "error",
          pending,
          lastSyncedAt: Date.now(),
          error: `${n} ${n === 1 ? "page is" : "pages are"} too big to back up (over 900 KB). ${n === 1 ? "It's" : "They're"} still saved on this device.`,
        });
      } else this.setStatus({ state: pending ? "syncing" : "synced", pending, lastSyncedAt: Date.now() });
      if (waiting > 0) this.syncSoon(PUSH_DELAY);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const offline = !this.isOnline() || /fetch|network|Failed to fetch|NetworkError/i.test(message);
      this.setStatus({ state: offline ? "offline" : "error", error: offline ? undefined : message });
      this.syncSoon(10_000);
    } finally {
      this.running = false;
    }
  }

  private async pull() {
    let cursor = await this.host.getCursor();
    for (;;) {
      const rows = await this.transport.pull(cursor, PULL_PAGE);
      if (!rows.length) break;
      const pending = new Set((await this.host.pending()).map((p) => p.id));
      const synced = new Map(await Promise.all(rows.map(async (r) => [r.id, (await this.host.getSynced(r.id))?.page ?? null] as const)));
      // Nothing waits from here until the pages are applied, so every merge uses this device's very
      // latest copy, including typing done while the cloud was answering.
      const apply: Page[] = [];
      const removed: string[] = [];
      for (const row of rows) {
        if (row.purged || !row.data) {
          removed.push(row.id);
          continue;
        }
        const remote = { ...row.data, id: row.id };
        const local = this.host.getPage(row.id);
        const base = synced.get(row.id) ?? null;
        // Changed here since the last sync: merge. That's known from the outbox, or from the page
        // itself when its outbox note is still being written.
        const changedHere = local && (pending.has(row.id) || (base && !same(local, base)));
        apply.push(changedHere ? mergePage(base, local, remote) : remote);
      }
      this.host.applyFromCloud(apply, removed);
      for (const row of rows) {
        if (row.purged || !row.data) {
          await this.host.removeSynced(row.id);
          await this.host.clearPending(row.id, null);
        } else await this.host.setSynced({ id: row.id, rev: row.rev, page: { ...row.data, id: row.id } });
      }
      cursor = rows[rows.length - 1].rev;
      await this.host.setCursor(cursor);
      if (rows.length < PULL_PAGE) break;
    }
  }

  private async push() {
    const pending = await this.host.pending();
    this.setStatus({ pending: pending.length });
    for (const change of pending) {
      const local = this.host.getPage(change.id);
      const synced = await this.host.getSynced(change.id);
      if (!local && !change.purge) {
        await this.host.clearPending(change.id, null);
        continue;
      }
      if (!change.purge && local && JSON.stringify(local).length > MAX_PAGE_CHARS) {
        this.tooBig.add(change.id);
        continue;
      }
      const res = await this.transport.push({ id: change.id, data: change.purge ? null : (local ?? null), baseRev: synced?.rev ?? null, purged: !!change.purge });
      if (res.tooBig) {
        this.tooBig.add(change.id);
        continue;
      }
      if (res.ok) {
        if (change.purge || !local) await this.host.removeSynced(change.id);
        else await this.host.setSynced({ id: change.id, rev: res.rev, page: local });
        await this.host.clearPending(change.id, change.purge ? null : (local ?? null));
        continue;
      }
      // Someone else changed it first. Merge and leave it pending; the loop pushes the merge next.
      if (res.purged || !res.data) {
        this.host.applyFromCloud([], [change.id]);
        await this.host.removeSynced(change.id);
        await this.host.clearPending(change.id, null);
        continue;
      }
      const remote = { ...res.data, id: change.id };
      // This device's copy as it is now: typing may have gone on while the request was out.
      const current = this.host.getPage(change.id) ?? local;
      const merged = current ? mergePage(synced?.page ?? null, current, remote) : remote;
      if (!same(merged, current)) this.host.applyFromCloud([merged], []);
      await this.host.setSynced({ id: change.id, rev: res.rev, page: remote });
      this.again = true;
    }
  }

  private async uploadFiles() {
    if (!this.userId || !this.transport.uploadFile) return;
    for (const f of await this.host.pendingFiles()) {
      await this.transport.uploadFile(this.userId, f);
      await this.host.markFileUploaded(f.id);
    }
  }

  /** Whether files (pictures, attachments) travel with the pages. */
  get syncsFiles() {
    return Boolean(this.transport.uploadFile);
  }

  /** A short-lived link to a file in the cloud, for devices that do not have it yet. */
  async fileUrl(id: string): Promise<string | null> {
    if (!this.userId || !this.transport.fileUrl) return null;
    return this.transport.fileUrl(this.userId, id);
  }

  async downloadFile(id: string): Promise<Blob | null> {
    if (!this.userId || !this.transport.downloadFile) return null;
    return this.transport.downloadFile(this.userId, id);
  }
}
