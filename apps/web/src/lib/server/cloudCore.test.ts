import { beforeEach, describe, expect, it } from "vitest";
import { MAX_PAGE_CHARS } from "@dovli/sync";
import { CloudError, createCloud, personalWorkspaceId, type CloudStore, type Doc, type DocTx } from "./cloudCore";
import { memoryCloudStore } from "./cloudMemory";

let clock = new Date("2026-10-19T10:00:00Z");
let store: CloudStore & { dump(): Map<string, Doc> };
let cloud: ReturnType<typeof createCloud>;
const page = (id: string, patch: Doc = {}) => ({ id, parentId: null, kind: "doc", title: "Untitled", mark: "¶", blocks: [], createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, order: 0, ...patch });
const get = (path: string) => store.dump().get(path);
const user = () => get("users/u1")!;
const WS = personalWorkspaceId("u1");
const space = () => get(`workspaces/${WS}`)!;
const fresh = () => createCloud({ store, now: () => clock }); // a new server, same database

beforeEach(async () => {
  clock = new Date("2026-10-19T10:00:00Z");
  store = memoryCloudStore();
  cloud = fresh();
  await cloud.upsertUser({ uid: "u1", email: "asha@example.com", name: "Asha Rao", signInMethods: ["email-code"], signedIn: true });
});

describe("the user record", () => {
  it("keeps the person's details and starting values", () => {
    expect(user()).toMatchObject({ uid: "u1", email: "asha@example.com", name: "Asha Rao", plan: "free", status: "active", signInMethods: ["email-code"], deviceCount: 0, personalWorkspaceId: WS });
    expect(user().createdAt).toEqual(clock);
    expect(user().lastSignInAt).toEqual(clock);
    expect(user().syncRev).toBeUndefined(); // that lives on the workspace now
  });

  it("adds sign-in methods and refreshes dates, but keeps the plan and join date", async () => {
    store.dump().get("users/u1")!.plan = "pro"; // changed by an admin in the console
    clock = new Date("2026-11-01T10:00:00Z");
    await cloud.upsertUser({ uid: "u1", signInMethods: ["google"], photoURL: "https://x/p.png" });
    expect(user()).toMatchObject({ plan: "pro", signInMethods: ["email-code", "google"], photoURL: "https://x/p.png", name: "Asha Rao" });
    expect(user().createdAt).toEqual(new Date("2026-10-19T10:00:00Z"));
    expect(user().lastSeenAt).toEqual(clock);
    expect(user().lastSignInAt).toEqual(new Date("2026-10-19T10:00:00Z")); // opening the app isn't a sign-in
  });

  it("refuses odd account ids", async () => {
    await expect(cloud.upsertUser({ uid: "../evil" })).rejects.toBeInstanceOf(CloudError);
  });
});

describe("the personal workspace", () => {
  it("is made on the first visit, owned by the person", () => {
    expect(space()).toMatchObject({ id: WS, name: "Asha's space", kind: "personal", ownerId: "u1", memberIds: ["u1"], roles: { u1: "owner" }, syncRev: 0, pageCount: 0 });
  });

  it("is made only once", async () => {
    await cloud.push("u1", { id: "p1", data: page("p1"), baseRev: null });
    await fresh().upsertUser({ uid: "u1" });
    expect(space().syncRev).toBe(1);
    expect(space().pageCount).toBe(1);
  });
});

describe("devices", () => {
  it("remembers each device once, with its owner and first and last seen", async () => {
    await cloud.checkIn("u1", { deviceId: "dev-abc-12345", platform: "web", name: "Chrome on macOS", appVersion: "1.0.0", installed: false });
    clock = new Date("2026-10-20T10:00:00Z");
    await cloud.checkIn("u1", { deviceId: "dev-abc-12345", platform: "web", name: "Chrome on macOS", appVersion: "1.0.1", installed: true });
    await cloud.checkIn("u1", { deviceId: "phone-xyz-9876", platform: "ios", name: "iPhone", appVersion: "1.0.0", installed: true });
    const d = get("users/u1/devices/dev-abc-12345")!;
    expect(d).toMatchObject({ ownerId: "u1", platform: "web", appVersion: "1.0.1", installed: true });
    expect(d.firstSeenAt).toEqual(new Date("2026-10-19T10:00:00Z"));
    expect(d.lastSeenAt).toEqual(clock);
    expect(user().deviceCount).toBe(2);
  });

  it("refuses a bad device id and tidies the rest", async () => {
    await expect(cloud.checkIn("u1", { deviceId: "x" })).rejects.toBeInstanceOf(CloudError);
    await cloud.checkIn("u1", { deviceId: "dev-abc-12345", platform: "windows-phone", name: "y".repeat(500) });
    expect(get("users/u1/devices/dev-abc-12345")).toMatchObject({ platform: "web", installed: false });
    expect(get("users/u1/devices/dev-abc-12345")!.name.length).toBe(80);
  });
});

describe("pages", () => {
  it("saves a page in the workspace, with readable details, who made it, and its content", async () => {
    expect(await cloud.push("u1", { id: "p1", data: page("p1", { title: "Trip plan" }), baseRev: null, purged: false })).toEqual({ ok: true, rev: 1 });
    const d = get(`workspaces/${WS}/pages/p1`)!;
    expect(d).toMatchObject({ id: "p1", rev: 1, kind: "doc", title: "Trip plan", inTrash: false, purged: false, workspaceId: WS, createdBy: "u1", updatedBy: "u1" });
    expect(d.updatedAt).toEqual(new Date(1_700_000_000_000));
    expect(JSON.parse(d.data).title).toBe("Trip plan");
    expect(space()).toMatchObject({ syncRev: 1, pageCount: 1 });
  });

  it("counts pages, boards and the trash on the workspace", async () => {
    await cloud.push("u1", { id: "p1", data: page("p1"), baseRev: null });
    await cloud.push("u1", { id: "b1", data: page("b1", { kind: "board" }), baseRev: null });
    await cloud.push("u1", { id: "p1", data: page("p1", { deletedAt: 1_700_000_100_000 }), baseRev: 1 });
    expect(space()).toMatchObject({ pageCount: 0, boardCount: 1, trashCount: 1 });
    await cloud.push("u1", { id: "p1", data: null, baseRev: 3, purged: true });
    expect(space()).toMatchObject({ pageCount: 0, boardCount: 1, trashCount: 0 });
    expect(get(`workspaces/${WS}/pages/p1`)).toMatchObject({ purged: true, data: null });
  });

  it("refuses a save from an old copy and returns the newer one", async () => {
    await cloud.push("u1", { id: "p1", data: page("p1", { title: "A" }), baseRev: null });
    await cloud.push("u1", { id: "p1", data: page("p1", { title: "B" }), baseRev: 1 });
    const r = await cloud.push("u1", { id: "p1", data: page("p1", { title: "C" }), baseRev: 1 });
    expect(r).toMatchObject({ ok: false, rev: 2, purged: false });
    expect(r.data?.title).toBe("B");
  });

  it("hands back changes after a revision, oldest first, as pages", async () => {
    await cloud.push("u1", { id: "a", data: page("a"), baseRev: null });
    await cloud.push("u1", { id: "b", data: page("b"), baseRev: null });
    await cloud.push("u1", { id: "a", data: page("a", { title: "A2" }), baseRev: 1 });
    const rows = await cloud.pull("u1", { cursor: 1, limit: 500 });
    expect(rows.map((r) => [r.id, r.rev])).toEqual([["b", 2], ["a", 3]]);
    expect(rows[1].data?.title).toBe("A2");
  });

  it("keeps each person's pages apart, even with the same page id", async () => {
    await cloud.upsertUser({ uid: "u2" });
    await cloud.push("u1", { id: "welcome", data: page("welcome", { title: "Mine" }), baseRev: null });
    await cloud.push("u2", { id: "welcome", data: page("welcome", { title: "Theirs" }), baseRev: null });
    expect((await cloud.pull("u1", { cursor: 0 }))[0].data?.title).toBe("Mine");
    expect((await cloud.pull("u2", { cursor: 0 }))[0].data?.title).toBe("Theirs");
  });

  it("says when a page is too big, without saving it", async () => {
    const r = await cloud.push("u1", { id: "big", data: page("big", { blocks: [{ text: "x".repeat(MAX_PAGE_CHARS) }] }), baseRev: null });
    expect(r).toMatchObject({ ok: false, tooBig: true });
    expect(store.dump().has(`workspaces/${WS}/pages/big`)).toBe(false);
  });

  it("refuses nonsense", async () => {
    for (const body of [{ id: "../x", data: page("x") }, { id: "x", data: "nope" }, { id: "x", data: { kind: "virus" } }, { id: "x", data: [] }, { id: "x", data: page("x"), workspaceId: "../y" }])
      await expect(cloud.push("u1", body)).rejects.toBeInstanceOf(CloudError);
  });
});

describe("who may read and change a workspace", () => {
  beforeEach(async () => {
    await cloud.upsertUser({ uid: "u2" });
    await cloud.upsertUser({ uid: "u3" });
    await cloud.push("u1", { id: "p1", data: page("p1", { title: "Plan" }), baseRev: null });
    // A team space with an editor and a viewer (made by hand here; step 2 adds invites).
    store.dump().set("workspaces/team1", { id: "team1", kind: "team", ownerId: "u1", memberIds: ["u1", "u2", "u3"], roles: { u1: "owner", u2: "editor", u3: "viewer" }, syncRev: 0 });
  });

  it("someone outside can't read or change another person's space", async () => {
    await expect(cloud.pull("u2", { workspaceId: WS })).rejects.toMatchObject({ code: "forbidden", status: 403 });
    await expect(cloud.push("u2", { workspaceId: WS, id: "p1", data: page("p1", { title: "Hacked" }), baseRev: 1 })).rejects.toMatchObject({ code: "forbidden" });
    expect(JSON.parse(get(`workspaces/${WS}/pages/p1`)!.data).title).toBe("Plan");
  });

  it("an editor can change pages; the record shows who made and who changed it", async () => {
    await cloud.push("u1", { workspaceId: "team1", id: "t1", data: page("t1"), baseRev: null });
    await cloud.push("u2", { workspaceId: "team1", id: "t1", data: page("t1", { title: "Edited" }), baseRev: 1 });
    expect(get("workspaces/team1/pages/t1")).toMatchObject({ title: "Edited", createdBy: "u1", updatedBy: "u2" });
  });

  it("a viewer can read but not change", async () => {
    await cloud.push("u1", { workspaceId: "team1", id: "t1", data: page("t1"), baseRev: null });
    expect((await cloud.pull("u3", { workspaceId: "team1" })).map((r) => r.id)).toEqual(["t1"]);
    await expect(cloud.push("u3", { workspaceId: "team1", id: "t1", data: page("t1", { title: "No" }), baseRev: 1 })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("a workspace that doesn't exist says so", async () => {
    await expect(cloud.pull("u1", { workspaceId: "nope" })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("moving pages saved before workspaces", () => {
  // The layout before: users/{uid} had syncRev and counts, and pages were at users/{uid}/pages.
  function oldLayout() {
    store = memoryCloudStore();
    const d = store.dump();
    d.set("users/u9", { uid: "u9", name: "Mayank Jha", email: "m@example.com", plan: "free", syncRev: 3, pageCount: 1, boardCount: 1, trashCount: 0, deviceCount: 1 });
    d.set("users/u9/pages/welcome", { id: "welcome", rev: 1, kind: "doc", title: "Welcome", data: JSON.stringify(page("welcome", { title: "Welcome" })) });
    d.set("users/u9/pages/b1", { id: "b1", rev: 2, kind: "board", title: "Board", data: JSON.stringify(page("b1", { kind: "board" })) });
    d.set("users/u9/pages/gone", { id: "gone", rev: 3, purged: true, data: null });
    d.set("users/u9/devices/dev-abc-12345", { deviceId: "dev-abc-12345", platform: "web" });
    cloud = fresh();
  }
  const W9 = personalWorkspaceId("u9");

  it("moves them into the personal workspace with the same change numbers", async () => {
    oldLayout();
    await cloud.upsertUser({ uid: "u9" });
    const keys = [...store.dump().keys()].sort();
    expect(keys).toEqual(["users/u9", "users/u9/devices/dev-abc-12345", `workspaces/${W9}`, `workspaces/${W9}/pages/b1`, `workspaces/${W9}/pages/gone`, `workspaces/${W9}/pages/welcome`]);
    expect(get(`workspaces/${W9}`)).toMatchObject({ name: "Mayank's space", syncRev: 3, pageCount: 1, boardCount: 1, movingOldPages: false });
    expect(get(`workspaces/${W9}/pages/welcome`)).toMatchObject({ rev: 1, workspaceId: W9, createdBy: "u9" });
    // The old counters left the user record; the rest stayed.
    expect(get("users/u9")).toMatchObject({ name: "Mayank Jha", plan: "free", deviceCount: 1, personalWorkspaceId: W9 });
    expect(get("users/u9")!.syncRev).toBeUndefined();
  });

  it("a device that was up to date stays up to date, and the next change continues the numbering", async () => {
    oldLayout();
    expect(await cloud.pull("u9", { cursor: 3 })).toEqual([]); // nothing new: no re-download
    expect((await cloud.pull("u9", { cursor: 0 })).map((r) => r.rev)).toEqual([1, 2, 3]);
    expect(await cloud.push("u9", { id: "welcome", data: page("welcome", { title: "Hi" }), baseRev: 1 })).toEqual({ ok: true, rev: 4 });
  });

  it("is safe when two requests arrive at once", async () => {
    oldLayout();
    const other = fresh();
    await Promise.all([cloud.pull("u9", { cursor: 0 }), other.pull("u9", { cursor: 0 }), cloud.upsertUser({ uid: "u9" })]);
    expect([...store.dump().keys()].filter((k) => k.startsWith("users/u9/pages"))).toEqual([]);
    expect([...store.dump().keys()].filter((k) => k.startsWith(`workspaces/${W9}/pages`)).length).toBe(3);
    expect(get(`workspaces/${W9}`)!.syncRev).toBe(3);
  });

  it("never overwrites a newer save with an old copy", async () => {
    oldLayout();
    // A newer copy already reached the new place (say, a save landed mid-move).
    store.dump().set(`workspaces/${W9}`, { id: W9, roles: { u9: "owner" }, memberIds: ["u9"], syncRev: 4, movingOldPages: true });
    store.dump().set(`workspaces/${W9}/pages/welcome`, { id: "welcome", rev: 4, title: "Newer", data: "{}" });
    await cloud.ensurePersonal("u9");
    expect(get(`workspaces/${W9}/pages/welcome`)).toMatchObject({ rev: 4, title: "Newer" });
    expect(store.dump().has("users/u9/pages/welcome")).toBe(false);
  });
});

describe("deleting a person", () => {
  it("removes their record, devices and personal workspace with its pages, and nothing else", async () => {
    await cloud.push("u1", { id: "p1", data: page("p1"), baseRev: null });
    await cloud.checkIn("u1", { deviceId: "dev-abc-12345" });
    await cloud.upsertUser({ uid: "u2" });
    await cloud.deleteUser("u1");
    expect([...store.dump().keys()].sort()).toEqual(["users/u2", `workspaces/${personalWorkspaceId("u2")}`]);
  });
});

describe("the memory store behaves like Firestore transactions", () => {
  it("drops all writes when the transaction fails", async () => {
    await expect(
      store.transaction(async (tx: DocTx) => {
        tx.set("users/u1", { name: "Changed" }, true);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(user().name).toBe("Asha Rao");
  });
});
