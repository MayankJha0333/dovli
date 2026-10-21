import { describe, expect, it } from "vitest";
import type { Page } from "@dovli/core";
import { SyncEngine } from "./engine";
import { MAX_PAGE_CHARS, type PendingChange, type PushResult, type SyncHost, type SyncTransport, type SyncedCopy } from "./types";

// A fake cloud that behaves like the Supabase table + push_page function in supabase/migrations.
class FakeCloud {
  rows = new Map<string, { id: string; data: Page | null; rev: number; purged: boolean }>();
  seq = 0;
  online = true;
  /** Runs as a push arrives, before the cloud looks at it (another device getting there first). */
  beforePush: (() => void) | null = null;
  /** Runs while a push is on its way back, as if the person kept typing during the request. */
  duringPush: (() => void) | null = null;
  client(): any {
    const cloud = this;
    const query = () => {
      let gt = 0;
      const q: any = {
        select: () => q,
        gt: (_c: string, v: number) => ((gt = v), q),
        order: () => q,
        limit: async (n: number) => {
          if (!cloud.online) throw new Error("Failed to fetch");
          const data = [...cloud.rows.values()].filter((r) => r.rev > gt).sort((a, b) => a.rev - b.rev).slice(0, n);
          return { data: structuredClone(data), error: null };
        },
      };
      return q;
    };
    return {
      from: () => query(),
      rpc: async (_name: string, a: any) => {
        if (!cloud.online) throw new Error("Failed to fetch");
        const cur = cloud.rows.get(a.p_id);
        if (cur && a.p_base_rev !== cur.rev) return { data: { ok: false, rev: cur.rev, data: structuredClone(cur.data), purged: cur.purged }, error: null };
        const rev = ++cloud.seq;
        cloud.rows.set(a.p_id, { id: a.p_id, data: structuredClone(a.p_data), rev, purged: a.p_purged });
        return { data: { ok: true, rev }, error: null };
      },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: async () => {},
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    };
  }
}

/** The same cloud behind the plain transport interface (what Dovli's server offers). */
function transportFor(cloud: FakeCloud): SyncTransport {
  return {
    async pull(cursor, limit) {
      if (!cloud.online) throw new Error("Failed to fetch");
      return structuredClone([...cloud.rows.values()].filter((r) => r.rev > cursor).sort((a, b) => a.rev - b.rev).slice(0, limit));
    },
    async push(c) {
      if (!cloud.online) throw new Error("Failed to fetch");
      const before = cloud.beforePush;
      cloud.beforePush = null;
      before?.();
      const cur = cloud.rows.get(c.id);
      let answer: PushResult;
      if (cur && c.baseRev !== cur.rev) answer = { ok: false, rev: cur.rev, data: structuredClone(cur.data), purged: cur.purged };
      else {
        const rev = ++cloud.seq;
        cloud.rows.set(c.id, { id: c.id, data: structuredClone(c.data), rev, purged: c.purged });
        answer = { ok: true, rev };
      }
      const during = cloud.duringPush;
      cloud.duringPush = null;
      during?.();
      return answer;
    },
  };
}

class FakeDevice implements SyncHost {
  pages: Record<string, Page> = {};
  pend = new Map<string, PendingChange>();
  synced = new Map<string, SyncedCopy>();
  cursor = 0;
  engine: SyncEngine;
  constructor(cloud: FakeCloud, via: "supabase" | "transport" = "supabase") {
    this.engine =
      via === "supabase"
        ? new SyncEngine({ supabase: cloud.client(), host: this, isOnline: () => cloud.online })
        : new SyncEngine({ transport: transportFor(cloud), host: this, isOnline: () => cloud.online });
  }
  edit(id: string, patch: Partial<Page>) {
    const cur = this.pages[id];
    this.pages[id] = { ...(cur ?? base(id)), ...patch, updatedAt: (cur?.updatedAt ?? 0) + 1 };
    this.pend.set(id, { id });
  }
  getPage = (id: string) => this.pages[id];
  applyFromCloud(pages: Page[], removed: string[]) {
    for (const p of pages) this.pages[p.id] = structuredClone(p);
    for (const id of removed) delete this.pages[id];
  }
  pending = async () => [...this.pend.values()];
  clearPending = async (id: string, pushed: Page | null) => {
    if (!pushed || JSON.stringify(this.pages[id]) === JSON.stringify(pushed)) this.pend.delete(id);
  };
  getSynced = async (id: string) => this.synced.get(id);
  setSynced = async (c: SyncedCopy) => void this.synced.set(c.id, structuredClone(c));
  removeSynced = async (id: string) => void this.synced.delete(id);
  getCursor = async () => this.cursor;
  setCursor = async (n: number) => void (this.cursor = n);
  pendingFiles = async () => [];
  markFileUploaded = async () => {};
  async sync() {
    (this.engine as any).userId = "u1";
    await this.engine.syncNow();
  }
}

const para = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }], children: [] });
const base = (id: string): Page => ({ id, parentId: null, kind: "doc", title: "", mark: "¶", blocks: [], createdAt: 1, updatedAt: 0, order: 0 });

describe("SyncEngine", () => {
  it("sends a page from one device to another", async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice(cloud);
    const b = new FakeDevice(cloud);
    a.edit("p1", { title: "Shopping", blocks: [para("1", "milk")] });
    await a.sync();
    await b.sync();
    expect(b.pages.p1.title).toBe("Shopping");
    expect(a.pend.size).toBe(0);
    expect(a.engine.status.state).toBe("synced");
  });

  it("merges edits made on two devices while one was offline", async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice(cloud);
    const b = new FakeDevice(cloud);
    a.edit("p1", { title: "Trip", blocks: [para("1", "flights"), para("2", "hotel")] });
    await a.sync();
    await b.sync();

    // Phone goes offline and edits block 1; laptop edits block 2 and the title meanwhile.
    cloud.online = false;
    b.edit("p1", { blocks: [para("1", "flights booked"), para("2", "hotel")] });
    await b.sync();
    expect(b.engine.status.state).toBe("offline");
    cloud.online = true;
    a.edit("p1", { title: "Lisbon trip", blocks: [para("1", "flights"), para("2", "hotel near the river")] });
    await a.sync();

    // Phone comes back.
    await b.sync();
    await a.sync();
    const text = (p: Page) => p.blocks!.map((x: any) => x.content[0].text);
    expect(text(b.pages.p1)).toEqual(["flights booked", "hotel near the river"]);
    expect(b.pages.p1.title).toBe("Lisbon trip");
    expect(a.pages.p1).toEqual(b.pages.p1);
    expect(a.pend.size + b.pend.size).toBe(0);
  });

  it("forgets a page deleted for good on another device", async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice(cloud);
    const b = new FakeDevice(cloud);
    a.edit("p1", { title: "Old" });
    await a.sync();
    await b.sync();
    delete a.pages.p1;
    a.pend.set("p1", { id: "p1", purge: true });
    await a.sync();
    await b.sync();
    expect(b.pages.p1).toBeUndefined();
  });

  it("works the same through a plain transport (Dovli's server)", async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice(cloud, "transport");
    const b = new FakeDevice(cloud, "transport");
    a.edit("p1", { title: "Notes" });
    await a.sync();
    b.edit("p1", { title: "Notes from the phone" }); // a conflict: b never saw a's copy
    await b.sync();
    await a.sync();
    expect(a.pages.p1.title).toBe(b.pages.p1.title);
    expect(a.pend.size + b.pend.size).toBe(0);
    expect(a.engine.syncsFiles).toBe(false);
  });

  it("keeps typing done while its push was on the way, when the cloud had a newer copy", async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice(cloud, "transport");
    const b = new FakeDevice(cloud, "transport");
    a.edit("p1", { blocks: [para("1", "one"), para("2", "two")] });
    await a.sync();
    await b.sync();

    // a sends its edit to block 1, but b's edit to block 2 reaches the cloud first; and while the
    // cloud's answer is on its way back, a types more.
    a.edit("p1", { blocks: [para("1", "one from a"), para("2", "two")] });
    cloud.beforePush = () => {
      b.edit("p1", { blocks: [para("1", "one"), para("2", "two from b")] });
      const rev = ++cloud.seq;
      cloud.rows.set("p1", { id: "p1", data: structuredClone(b.pages.p1), rev, purged: false });
      b.pend.clear();
      b.synced.set("p1", { id: "p1", rev, page: structuredClone(b.pages.p1) });
      b.cursor = rev;
    };
    cloud.duringPush = () => a.edit("p1", { blocks: [para("1", "one from a, still typing"), para("2", "two")] });
    await a.sync();
    await b.sync();
    const text = (p: Page) => p.blocks!.map((x: any) => x.content[0].text);
    expect(text(a.pages.p1)).toEqual(["one from a, still typing", "two from b"]);
    expect(b.pages.p1).toEqual(a.pages.p1);
    expect(a.pend.size + b.pend.size).toBe(0);
  });

  it("merges, not replaces, an edit made here that the outbox hasn't noted yet", async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice(cloud, "transport");
    const b = new FakeDevice(cloud, "transport");
    a.edit("p1", { blocks: [para("1", "one"), para("2", "two")] });
    await a.sync();
    await b.sync();
    b.edit("p1", { blocks: [para("1", "one"), para("2", "two from b")] });
    await b.sync();

    // a's change is in its page but not yet in its outbox (that write is still on its way).
    a.edit("p1", { blocks: [para("1", "one from a"), para("2", "two")] });
    a.pend.delete("p1");
    await a.sync();
    const text = (p: Page) => p.blocks!.map((x: any) => x.content[0].text);
    expect(text(a.pages.p1)).toEqual(["one from a", "two from b"]);
  });

  it("keeps a page that's too big on the device, says so, and still sends the rest", async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice(cloud, "transport");
    a.edit("big", { title: "Huge", blocks: [para("1", "x".repeat(MAX_PAGE_CHARS))] });
    a.edit("small", { title: "Small" });
    await a.sync();
    expect(cloud.rows.has("small")).toBe(true);
    expect(cloud.rows.has("big")).toBe(false);
    expect(a.pend.has("big")).toBe(true);
    expect(a.engine.status.state).toBe("error");
    expect(a.engine.status.error).toContain("1 page is too big");
  });
});
