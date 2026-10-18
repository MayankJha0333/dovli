import { beforeEach, describe, expect, it } from "vitest";
import { MAX_PAGE_CHARS } from "@dovli/sync";
import { CloudError, createCloud, type CloudStore, type Doc, type DocTx } from "./cloudCore";
import { memoryCloudStore } from "./cloudMemory";

let clock = new Date("2026-10-19T10:00:00Z");
let store: CloudStore & { dump(): Map<string, Doc> };
let cloud: ReturnType<typeof createCloud>;
const page = (id: string, patch: Doc = {}) => ({ id, parentId: null, kind: "doc", title: "Untitled", mark: "¶", blocks: [], createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, order: 0, ...patch });
const user = () => store.dump().get("users/u1")!;

beforeEach(async () => {
  clock = new Date("2026-10-19T10:00:00Z");
  store = memoryCloudStore();
  cloud = createCloud({ store, now: () => clock });
  await cloud.upsertUser({ uid: "u1", email: "asha@example.com", name: "Asha", signInMethods: ["email-code"], signedIn: true });
});

describe("the user record", () => {
  it("keeps the person's details and starting values", () => {
    expect(user()).toMatchObject({ uid: "u1", email: "asha@example.com", name: "Asha", plan: "free", status: "active", signInMethods: ["email-code"], pageCount: 0, deviceCount: 0, syncRev: 0 });
    expect(user().createdAt).toEqual(clock);
    expect(user().lastSignInAt).toEqual(clock);
  });

  it("adds sign-in methods and refreshes dates, but keeps the plan and join date", async () => {
    const joined = user().createdAt;
    store.dump().get("users/u1")!.plan = "pro"; // changed by an admin in the console
    clock = new Date("2026-11-01T10:00:00Z");
    await cloud.upsertUser({ uid: "u1", signInMethods: ["google"], photoURL: "https://x/p.png" });
    expect(user()).toMatchObject({ plan: "pro", signInMethods: ["email-code", "google"], photoURL: "https://x/p.png", name: "Asha" });
    expect(user().createdAt).toEqual(joined);
    expect(user().lastSeenAt).toEqual(clock);
    expect(user().lastSignInAt).toEqual(new Date("2026-10-19T10:00:00Z")); // opening the app isn't a sign-in
  });

  it("refuses odd account ids", async () => {
    await expect(cloud.upsertUser({ uid: "../evil" })).rejects.toBeInstanceOf(CloudError);
  });
});

describe("devices", () => {
  it("remembers each device once, with first and last seen", async () => {
    await cloud.checkIn("u1", { deviceId: "dev-abc-12345", platform: "web", name: "Chrome on Mac", appVersion: "1.0.0", installed: false });
    clock = new Date("2026-10-20T10:00:00Z");
    await cloud.checkIn("u1", { deviceId: "dev-abc-12345", platform: "web", name: "Chrome on Mac", appVersion: "1.0.1", installed: true });
    await cloud.checkIn("u1", { deviceId: "phone-xyz-9876", platform: "ios", name: "iPhone", appVersion: "1.0.0", installed: true });
    const d = store.dump().get("users/u1/devices/dev-abc-12345")!;
    expect(d).toMatchObject({ platform: "web", appVersion: "1.0.1", installed: true });
    expect(d.firstSeenAt).toEqual(new Date("2026-10-19T10:00:00Z"));
    expect(d.lastSeenAt).toEqual(clock);
    expect(user().deviceCount).toBe(2);
  });

  it("refuses a bad device id and tidies the rest", async () => {
    await expect(cloud.checkIn("u1", { deviceId: "x" })).rejects.toBeInstanceOf(CloudError);
    await cloud.checkIn("u1", { deviceId: "dev-abc-12345", platform: "windows-phone", name: "y".repeat(500) });
    expect(store.dump().get("users/u1/devices/dev-abc-12345")).toMatchObject({ platform: "web", installed: false });
    expect(store.dump().get("users/u1/devices/dev-abc-12345")!.name.length).toBe(80);
  });
});

describe("pages", () => {
  it("saves a page with readable details and its content", async () => {
    expect(await cloud.push("u1", { id: "p1", data: page("p1", { title: "Trip plan" }), baseRev: null, purged: false })).toEqual({ ok: true, rev: 1 });
    const d = store.dump().get("users/u1/pages/p1")!;
    expect(d).toMatchObject({ id: "p1", rev: 1, kind: "doc", title: "Trip plan", inTrash: false, purged: false });
    expect(d.updatedAt).toEqual(new Date(1_700_000_000_000));
    expect(JSON.parse(d.data).title).toBe("Trip plan");
    expect(user()).toMatchObject({ syncRev: 1, pageCount: 1 });
  });

  it("counts pages, boards and the trash", async () => {
    await cloud.push("u1", { id: "p1", data: page("p1"), baseRev: null });
    await cloud.push("u1", { id: "b1", data: page("b1", { kind: "board" }), baseRev: null });
    await cloud.push("u1", { id: "p1", data: page("p1", { deletedAt: 1_700_000_100_000 }), baseRev: 1 });
    expect(user()).toMatchObject({ pageCount: 0, boardCount: 1, trashCount: 1 });
    await cloud.push("u1", { id: "p1", data: null, baseRev: 3, purged: true });
    expect(user()).toMatchObject({ pageCount: 0, boardCount: 1, trashCount: 0 });
    expect(store.dump().get("users/u1/pages/p1")).toMatchObject({ purged: true, data: null });
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
    const rows = await cloud.pull("u1", 1, 500);
    expect(rows.map((r) => [r.id, r.rev])).toEqual([["b", 2], ["a", 3]]);
    expect(rows[1].data?.title).toBe("A2");
  });

  it("keeps each person's pages apart, even with the same page id", async () => {
    await cloud.upsertUser({ uid: "u2" });
    await cloud.push("u1", { id: "welcome", data: page("welcome", { title: "Mine" }), baseRev: null });
    await cloud.push("u2", { id: "welcome", data: page("welcome", { title: "Theirs" }), baseRev: null });
    expect((await cloud.pull("u1", 0, 500))[0].data?.title).toBe("Mine");
    expect((await cloud.pull("u2", 0, 500))[0].data?.title).toBe("Theirs");
  });

  it("says when a page is too big, without saving it", async () => {
    const r = await cloud.push("u1", { id: "big", data: page("big", { blocks: [{ text: "x".repeat(MAX_PAGE_CHARS) }] }), baseRev: null });
    expect(r).toMatchObject({ ok: false, tooBig: true });
    expect(store.dump().has("users/u1/pages/big")).toBe(false);
  });

  it("refuses nonsense", async () => {
    for (const body of [{ id: "../x", data: page("x") }, { id: "x", data: "nope" }, { id: "x", data: { kind: "virus" } }, { id: "x", data: [] }])
      await expect(cloud.push("u1", body)).rejects.toBeInstanceOf(CloudError);
  });

  it("deleting a person removes their record, pages and devices", async () => {
    await cloud.push("u1", { id: "p1", data: page("p1"), baseRev: null });
    await cloud.checkIn("u1", { deviceId: "dev-abc-12345" });
    await cloud.upsertUser({ uid: "u2" });
    await cloud.deleteUser("u1");
    expect([...store.dump().keys()]).toEqual(["users/u2"]);
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
    expect(user().name).toBe("Asha");
  });
});
