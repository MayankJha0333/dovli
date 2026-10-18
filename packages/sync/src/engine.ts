import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { mergePage, type Page } from "@dovli/core";
import type { PageRow, SyncHost, SyncStatus } from "./types";

// Keeps this device and the cloud in step.
//
// - Every edit on this device is written locally first and added to a "pending" list.
// - push(): sends each pending page with the cloud revision it was based on. If someone else
//   changed it in the meantime, the cloud says no, we merge the two versions (mergePage) and try again.
// - pull(): fetches every page changed in the cloud since the last pull. Pages not edited here are
//   replaced; pages edited here too are merged.
// - It runs on start, when the device comes back online, when the cloud reports a change (realtime),
//   a moment after each local edit, and every 30 seconds as a safety net.

const PULL_PAGE = 500;
const SAFETY_INTERVAL = 30_000;
const PUSH_DELAY = 1_200;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface SyncEngineOptions {
  supabase: SupabaseClient;
  host: SyncHost;
  /** Is the network up? Defaults to navigator.onLine where it exists. */
  isOnline?: () => boolean;
  /** Subscribe to "came back online"; returns an unsubscribe function. */
  onOnline?: (cb: () => void) => () => void;
  bucket?: string;
}

export class SyncEngine {
  private supabase: SupabaseClient;
  private host: SyncHost;
  private isOnline: () => boolean;
  private bucket: string;
  private userId: string | null = null;
  private running = false;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private channel: RealtimeChannel | null = null;
  private offOnline: (() => void) | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  status: SyncStatus = { state: "signed-out", pending: 0, lastSyncedAt: null };

  constructor(opts: SyncEngineOptions) {
    this.supabase = opts.supabase;
    this.host = opts.host;
    this.bucket = opts.bucket ?? "files";
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
    this.channel = this.supabase
      .channel(`pages:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pages", filter: `user_id=eq.${userId}` }, () => this.syncSoon(300))
      .subscribe();
    this.interval = setInterval(() => this.syncSoon(0), SAFETY_INTERVAL);
    this.syncSoon(0);
  }

  stop() {
    this.userId = null;
    clearTimeout(this.timer);
    clearInterval(this.interval);
    if (this.channel) void this.supabase.removeChannel(this.channel);
    this.channel = null;
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
    try {
      let rounds = 0;
      do {
        this.again = false;
        await this.pull();
        await this.push();
        await this.uploadFiles();
      } while (this.again && ++rounds < 5);
      const pending = (await this.host.pending()).length;
      this.setStatus({ state: pending ? "syncing" : "synced", pending, lastSyncedAt: Date.now() });
      if (pending) this.syncSoon(PUSH_DELAY);
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
      const { data, error } = await this.supabase
        .from("pages")
        .select("id,data,rev,purged")
        .gt("rev", cursor)
        .order("rev", { ascending: true })
        .limit(PULL_PAGE);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as PageRow[];
      if (!rows.length) break;
      const pending = new Map((await this.host.pending()).map((p) => [p.id, p]));
      const apply: Page[] = [];
      const removed: string[] = [];
      for (const row of rows) {
        if (row.purged || !row.data) {
          removed.push(row.id);
          await this.host.removeSynced(row.id);
          await this.host.clearPending(row.id, null);
          continue;
        }
        const remote = { ...row.data, id: row.id };
        const local = this.host.getPage(row.id);
        if (pending.has(row.id) && local) {
          const synced = await this.host.getSynced(row.id);
          apply.push(mergePage(synced?.page ?? null, local, remote));
        } else {
          apply.push(remote);
        }
        await this.host.setSynced({ id: row.id, rev: row.rev, page: remote });
      }
      this.host.applyFromCloud(apply, removed);
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
      const { data, error } = await this.supabase.rpc("push_page", {
        p_id: change.id,
        p_data: change.purge ? null : local,
        p_base_rev: synced?.rev ?? null,
        p_purged: !!change.purge,
      });
      if (error) throw new Error(error.message);
      const res = data as { ok: boolean; rev: number; data?: Page | null; purged?: boolean };
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
      const merged = local ? mergePage(synced?.page ?? null, local, remote) : remote;
      await this.host.setSynced({ id: change.id, rev: res.rev, page: remote });
      if (!same(merged, local)) this.host.applyFromCloud([merged], []);
      this.again = true;
    }
  }

  private async uploadFiles() {
    if (!this.userId) return;
    for (const f of await this.host.pendingFiles()) {
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .upload(`${this.userId}/${f.id}`, f.blob, { upsert: true, contentType: f.type || "application/octet-stream" });
      if (error && !/exists/i.test(error.message)) throw new Error(error.message);
      await this.host.markFileUploaded(f.id);
    }
  }

  /** A short-lived link to a file in the cloud, for devices that do not have it yet. */
  async fileUrl(id: string): Promise<string | null> {
    if (!this.userId) return null;
    const { data } = await this.supabase.storage.from(this.bucket).createSignedUrl(`${this.userId}/${id}`, 60 * 60);
    return data?.signedUrl ?? null;
  }

  async downloadFile(id: string): Promise<Blob | null> {
    if (!this.userId) return null;
    const { data } = await this.supabase.storage.from(this.bucket).download(`${this.userId}/${id}`);
    return data ?? null;
  }
}
