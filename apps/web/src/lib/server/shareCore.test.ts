import { beforeEach, describe, expect, it } from "vitest";
import { createCloud, personalWorkspaceId, type CloudStore, type Doc } from "./cloudCore";
import { memoryCloudStore } from "./cloudMemory";
import { emailKey } from "./emailCodeCore";
import { createSharing, type Person } from "./shareCore";

let store: CloudStore & { dump(): Map<string, Doc> };
let cloud: ReturnType<typeof createCloud>;
let share: ReturnType<typeof createSharing>;
let people: Map<string, Person>;
let n = 0;
const page = (id: string, patch: Doc = {}) => ({ id, parentId: null, kind: "doc", title: "Trip plan", mark: "¶", blocks: [{ id: "b1", type: "paragraph", content: [] }], createdAt: 1, updatedAt: 1, order: 0, ...patch });
const A = "alice", B = "bob", C = "carol";
const WA = personalWorkspaceId(A);
const get = (p: string) => store.dump().get(p);

beforeEach(async () => {
  store = memoryCloudStore();
  people = new Map([
    [A, { uid: A, email: "alice@example.com", name: "Alice", photoURL: null }],
    [B, { uid: B, email: "bob@example.com", name: "Bob", photoURL: null }],
    [C, { uid: C, email: "carol@example.com", name: "Carol", photoURL: null }],
  ]);
  cloud = createCloud({ store });
  share = createSharing({
    store,
    accounts: {
      findByEmail: async (e) => [...people.values()].find((p) => p.email === e) ?? null,
      get: async (uid) => people.get(uid) ?? null,
    },
    makeLinkId: () => `link-${++n}-abcdefghij`,
  });
  for (const u of [A, B, C]) await cloud.upsertUser({ uid: u, email: people.get(u)!.email });
  await cloud.push(A, { id: "p1", data: page("p1"), baseRev: null });
});

describe("inviting people", () => {
  it("someone with an account gets access straight away, and it shows in their list", async () => {
    const r = await share.invite(A, WA, "p1", "Bob@Example.com", "editor");
    expect(r).toMatchObject({ status: "added", email: "bob@example.com", name: "Bob", inviter: "Alice", title: "Trip plan" });
    expect(get(`workspaces/${WA}/pages/p1`)).toMatchObject({ shared: { bob: "editor" }, sharedIds: ["bob"] });
    expect(await share.inbox(B)).toMatchObject([{ workspaceId: WA, pageId: "p1", title: "Trip plan", role: "editor", sharedByName: "Alice" }]);
  });

  it("a new email waits, then gets access when that person signs up", async () => {
    const r = await share.invite(A, WA, "p1", "dan@example.com", "viewer");
    expect(r.status).toBe("invited");
    expect((await share.settings(A, WA, "p1")).people.map((p) => [p.email, p.role, p.pending])).toEqual([
      ["alice@example.com", "owner", false],
      ["dan@example.com", "viewer", true],
    ]);
    // Dan signs up.
    people.set("dan", { uid: "dan", email: "dan@example.com", name: "Dan", photoURL: null });
    expect(await share.claim("dan", "dan@example.com")).toBe(1);
    expect(get(`workspaces/${WA}/pages/p1`)).toMatchObject({ shared: { dan: "viewer" }, invited: {} });
    expect(store.dump().has(`pendingInvites/${emailKey("dan@example.com")}`)).toBe(false);
    expect((await share.inbox("dan")).map((x) => x.pageId)).toEqual(["p1"]);
  });

  it("refuses inviting yourself, bad emails and bad roles", async () => {
    await expect(share.invite(A, WA, "p1", "alice@example.com", "editor")).rejects.toMatchObject({ code: "bad_request" });
    await expect(share.invite(A, WA, "p1", "not an email", "editor")).rejects.toBeTruthy();
    await expect(share.invite(A, WA, "p1", "bob@example.com", "owner")).rejects.toMatchObject({ code: "bad_request" });
  });

  it("only the page's owner or editors of its workspace can share it", async () => {
    await share.invite(A, WA, "p1", "bob@example.com", "editor"); // Bob can edit this one page…
    await expect(share.invite(B, WA, "p1", "carol@example.com", "viewer")).rejects.toMatchObject({ code: "forbidden" }); // …but can't share it on
    await expect(share.settings(C, WA, "p1")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("says when the page hasn't reached the account yet", async () => {
    await expect(share.invite(A, WA, "not-saved-yet", "bob@example.com", "viewer")).rejects.toMatchObject({ code: "not_synced", status: 409 });
  });
});

describe("changing and removing access", () => {
  beforeEach(async () => {
    await share.invite(A, WA, "p1", "bob@example.com", "editor");
    await share.invite(A, WA, "p1", "dan@example.com", "editor");
  });

  it("changes a person's role everywhere", async () => {
    await share.setRole(A, WA, "p1", { uid: B }, "viewer");
    expect(get(`workspaces/${WA}/pages/p1`)!.shared).toEqual({ bob: "viewer" });
    expect((await share.inbox(B))[0].role).toBe("viewer");
  });

  it("removing a person takes the page out of their list and stops them opening it", async () => {
    await share.setRole(A, WA, "p1", { uid: B }, null);
    expect(await share.inbox(B)).toEqual([]);
    await expect(share.open(B, { workspaceId: WA, pageId: "p1" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("changes or cancels a waiting invite", async () => {
    await share.setRole(A, WA, "p1", { email: "dan@example.com" }, "viewer");
    expect(get(`workspaces/${WA}/pages/p1`)!.invited[emailKey("dan@example.com")].role).toBe("viewer");
    await share.setRole(A, WA, "p1", { email: "dan@example.com" }, null);
    expect(get(`workspaces/${WA}/pages/p1`)!.invited).toEqual({});
    expect(await share.claim("dan", "dan@example.com")).toBe(0);
  });
});

describe("opening and editing a shared page", () => {
  it("an invited editor can open and save; the owner's devices then get the change", async () => {
    await share.invite(A, WA, "p1", "bob@example.com", "editor");
    const o = await share.open(B, { workspaceId: WA, pageId: "p1" });
    expect(o).toMatchObject({ role: "editor", rev: 1, ownerName: "Alice" });
    expect(await share.save(B, { workspaceId: WA, pageId: "p1" }, { title: "Trip plan v2", blocks: [], baseRev: 1 })).toEqual({ ok: true, rev: 2 });
    const rows = await cloud.pull(A, { cursor: 1 });
    expect(rows.map((r) => [r.id, r.data?.title])).toEqual([["p1", "Trip plan v2"]]);
    expect(get(`workspaces/${WA}/pages/p1`)).toMatchObject({ updatedBy: "bob", createdBy: "alice", shared: { bob: "editor" } });
  });

  it("an invited viewer can open but not save", async () => {
    await share.invite(A, WA, "p1", "bob@example.com", "viewer");
    expect((await share.open(B, { workspaceId: WA, pageId: "p1" })).role).toBe("viewer");
    await expect(share.save(B, { workspaceId: WA, pageId: "p1" }, { blocks: [], baseRev: 1 })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("a save from an old copy is refused with the newer one", async () => {
    await share.invite(A, WA, "p1", "bob@example.com", "editor");
    await cloud.push(A, { id: "p1", data: page("p1", { title: "Owner's change" }), baseRev: 1 });
    const r = await share.save(B, { workspaceId: WA, pageId: "p1" }, { title: "Bob's change", blocks: [], baseRev: 1 });
    expect(r).toMatchObject({ ok: false, rev: 2 });
    expect((r as any).page.title).toBe("Owner's change");
  });

  it("the owner's next sync keeps the sharing settings", async () => {
    await share.invite(A, WA, "p1", "bob@example.com", "editor");
    await cloud.push(A, { id: "p1", data: page("p1", { title: "Renamed" }), baseRev: 1 });
    expect(get(`workspaces/${WA}/pages/p1`)).toMatchObject({ title: "Renamed", shared: { bob: "editor" } });
    expect((await share.inbox(B))[0].title).toBe("Renamed");
  });

  it("nobody else can open it", async () => {
    await expect(share.open(C, { workspaceId: WA, pageId: "p1" })).rejects.toMatchObject({ code: "not_found" });
    await expect(share.open(null, { workspaceId: WA, pageId: "p1" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("a page in the trash can't be opened by others", async () => {
    await share.invite(A, WA, "p1", "bob@example.com", "editor");
    await cloud.push(A, { id: "p1", data: page("p1", { deletedAt: 5 }), baseRev: 1 });
    await expect(share.open(B, { workspaceId: WA, pageId: "p1" })).rejects.toMatchObject({ code: "not_found" });
    expect(await share.inbox(B)).toEqual([]);
  });
});

describe("the invitation link", () => {
  it("anyone can view with a view link, without an account", async () => {
    const link = await share.setLink(A, WA, "p1", { enabled: true, role: "viewer" });
    expect(link).toMatchObject({ role: "viewer", enabled: true });
    expect(await share.open(null, { linkId: link.id })).toMatchObject({ role: "viewer", pageId: "p1" });
    await expect(share.save(null, { linkId: link.id }, { blocks: [], baseRev: 1 })).rejects.toMatchObject({ status: 401 });
  });

  it("an edit link lets signed-in people edit, and others only view", async () => {
    const link = await share.setLink(A, WA, "p1", { enabled: true, role: "editor" });
    expect((await share.open(null, { linkId: link.id })).role).toBe("viewer");
    expect((await share.open(C, { linkId: link.id })).role).toBe("editor");
    expect(await share.save(C, { linkId: link.id }, { blocks: [], baseRev: 1 })).toMatchObject({ ok: true });
  });

  it("turning it off or making a new one stops the old link", async () => {
    const first = await share.setLink(A, WA, "p1", { enabled: true });
    await share.setLink(A, WA, "p1", { enabled: false });
    await expect(share.open(null, { linkId: first.id })).rejects.toMatchObject({ code: "not_found" });
    const again = await share.setLink(A, WA, "p1", { enabled: true });
    expect(again.id).toBe(first.id); // same link, back on
    const fresh = await share.setLink(A, WA, "p1", { reset: true });
    expect(fresh.id).not.toBe(first.id);
    await expect(share.open(null, { linkId: first.id })).rejects.toMatchObject({ code: "not_found" });
    expect((await share.open(null, { linkId: fresh.id })).pageId).toBe("p1");
  });

  it("made-up or malformed links open nothing", async () => {
    for (const id of ["nope-nope-nope", "../../x", ""]) await expect(share.open(null, { linkId: id })).rejects.toMatchObject({ code: "not_found" });
  });

  it("shows up in the Share window's settings", async () => {
    await share.setLink(A, WA, "p1", { enabled: true, role: "editor" });
    expect((await share.settings(A, WA, "p1")).link).toMatchObject({ role: "editor", enabled: true });
  });
});
