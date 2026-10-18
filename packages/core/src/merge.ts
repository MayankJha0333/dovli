import type { BoardData, Page } from "./types";

// Merging two versions of a page that were edited apart (for example on a phone with no signal
// and on a laptop at the same time). It is a three-way merge: `base` is the last version both sides
// agreed on, `local` is this device's version and `remote` is the cloud's.
//
// Rules, chosen so no one's writing is ever silently lost:
// - A field or block changed on only one side takes that side's change.
// - A block changed on both sides keeps this device's version and puts the cloud's version
//   right after it, so both edits stay on the page.
// - A block deleted on one side but edited on the other is kept.
// - Whiteboard shapes keep the newest version of each shape (Excalidraw counts versions).

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

type Field = Exclude<keyof Page, "id" | "blocks" | "board" | "createdAt" | "updatedAt">;
const FIELDS: Field[] = ["parentId", "kind", "title", "mark", "style", "look", "cover", "favorite", "deletedAt", "lastOpenedAt", "order", "expanded"];

export function mergePage(base: Page | null, local: Page, remote: Page): Page {
  if (same(local, remote)) return local;
  // Nothing in common to compare against: keep whichever was edited last.
  if (!base) return local.updatedAt >= remote.updatedAt ? local : remote;

  const localNewer = local.updatedAt >= remote.updatedAt;
  const out: Page = { ...local };
  for (const f of FIELDS) {
    const b = base[f];
    const l = local[f];
    const r = remote[f];
    let v: unknown;
    if (same(l, r)) v = l;
    else if (same(l, b)) v = r;
    else if (same(r, b)) v = l;
    else if (f === "lastOpenedAt") v = Math.max(Number(l ?? 0), Number(r ?? 0));
    else v = localNewer ? l : r;
    (out as any)[f] = v;
  }
  out.createdAt = Math.min(local.createdAt, remote.createdAt);
  out.updatedAt = Math.max(local.updatedAt, remote.updatedAt);

  if (out.kind === "doc") out.blocks = mergeBlocks(base.blocks ?? [], local.blocks ?? [], remote.blocks ?? []);
  else out.board = mergeBoard(base.board, local.board, remote.board);
  return out;
}

/** Three-way merge of a list of blocks, matched by block id. */
export function mergeBlocks(base: any[], local: any[], remote: any[]): any[] {
  const B = new Map(base.map((b) => [b.id, b]));
  const L = new Map(local.map((b) => [b.id, b]));
  const R = new Map(remote.map((b) => [b.id, b]));
  const kept = new Map<string, any>();
  const extraAfter = new Map<string, any>();

  for (const id of new Set([...L.keys(), ...R.keys(), ...B.keys()])) {
    const b = B.get(id);
    const l = L.get(id);
    const r = R.get(id);
    if (l && r) {
      if (same(l, r) || same(r, b)) kept.set(id, l);
      else if (same(l, b)) kept.set(id, r);
      else if (l.children?.length || r.children?.length) {
        // Same block changed on both sides: merge the nested blocks, keep this device's own content.
        kept.set(id, { ...l, children: mergeBlocks(b?.children ?? [], l.children ?? [], r.children ?? []) });
        if (!same(l.content, r.content) && !same(r.content, b?.content)) extraAfter.set(id, { ...r, id: `${id}-c`, children: [] });
      } else {
        kept.set(id, l);
        extraAfter.set(id, { ...r, id: `${id}-c` });
      }
    } else if (l && !r) {
      // Missing in the cloud: added here, or deleted there. Keep it if it is new or edited here.
      if (!b || !same(l, b)) kept.set(id, l);
    } else if (r && !l) {
      if (!b || !same(r, b)) kept.set(id, r);
    }
  }

  // Order: this device's order, then blocks only the cloud has, placed after their cloud neighbour.
  const order: string[] = local.map((b) => b.id).filter((id) => kept.has(id));
  remote.forEach((b, i) => {
    if (!kept.has(b.id) || order.includes(b.id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(remote[j].id);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    order.splice(at, 0, b.id);
  });

  const out: any[] = [];
  for (const id of order) {
    out.push(kept.get(id));
    const extra = extraAfter.get(id);
    if (extra && !kept.has(extra.id)) out.push(extra);
  }
  return out;
}

/** Whiteboards: newest version of each shape wins; a shape deleted on one side and untouched on the other goes. */
export function mergeBoard(base: BoardData | undefined, local: BoardData | undefined, remote: BoardData | undefined): BoardData {
  const be = new Map((base?.elements ?? []).map((e: any) => [e.id, e]));
  const le = new Map((local?.elements ?? []).map((e: any) => [e.id, e]));
  const re = new Map((remote?.elements ?? []).map((e: any) => [e.id, e]));
  const elements: any[] = [];
  for (const id of new Set([...le.keys(), ...re.keys()])) {
    const l = le.get(id);
    const r = re.get(id);
    const b = be.get(id);
    if (l && r) elements.push((r.version ?? 0) > (l.version ?? 0) ? r : l);
    else if (l) {
      if (!b || (l.version ?? 0) > (b.version ?? 0)) elements.push(l);
    } else if (r) {
      if (!b || (r.version ?? 0) > (b.version ?? 0)) elements.push(r);
    }
  }
  const files = { ...(remote?.files ?? {}), ...(local?.files ?? {}) };
  return {
    ...(remote ?? {}),
    ...(local ?? {}),
    elements,
    files,
    skeleton: local?.skeleton ?? remote?.skeleton,
  };
}
