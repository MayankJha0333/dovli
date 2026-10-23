import type { BoardData, Page } from "./types";

// Merging two versions of a page that were edited apart (for example on a phone with no signal
// and on a laptop at the same time). It is a three-way merge: `base` is the last version both sides
// agreed on, `local` is this device's version and `remote` is the cloud's.
//
// Rules, chosen so no one's writing is ever silently lost:
// - A field or block changed on only one side takes that side's change.
// - Blocks are matched by id anywhere in the page. A block's content, the block it sits in and its
//   place among its siblings merge separately, so a move on one side and an edit on the other both stay.
// - Inside a block each part (text, type, each prop) merges on its own. Only when both sides changed
//   the same part does the block keep this device's version, with the cloud's right after it.
// - A block moved on both sides goes where this device put it.
// - A block deleted on one side but edited on the other is kept, with the blocks around and inside it.
// - Whiteboard shapes keep the newest version of each shape (Excalidraw counts versions).

/** Deep equality that ignores key order: the editor and the Markdown reader write keys in different orders. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => same(x, (b as unknown[])[i]));
  const ka = Object.keys(a).filter((k) => (a as any)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as any)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same((a as any)[k], (b as any)[k]));
}

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

type Key = string;
const ROOT = "";

/** A block tree as flat records: each block without its children, its parent, and each list's order. */
interface Flat {
  node: Map<Key, { block: any; parent: Key }>;
  kids: Map<Key, Key[]>;
  ids: Set<string>;
}

interface Sides {
  B: Flat;
  L: Flat;
  R: Flat;
}

function flatten(blocks: any[] | undefined): Flat {
  const flat: Flat = { node: new Map(), kids: new Map(), ids: new Set() };
  const walk = (list: any[], parent: Key) => {
    const keys: Key[] = [];
    list.forEach((block, i) => {
      if (!block || typeof block !== "object") return;
      // A block without an id is known by its place; a repeated id (left by an older merge) by its count.
      let key: Key = typeof block.id === "string" && block.id ? block.id : `\u0000${parent}/${i}`;
      for (let n = 2; flat.node.has(key); n++) key = `${block.id}\u0000${n}`;
      if (typeof block.id === "string") flat.ids.add(block.id);
      const { children, ...bare } = block;
      flat.node.set(key, { block: bare, parent });
      keys.push(key);
      if (Array.isArray(children)) walk(children, key);
    });
    flat.kids.set(parent, keys);
  };
  walk(Array.isArray(blocks) ? blocks : [], ROOT);
  return flat;
}

function pick(b: unknown, l: unknown, r: unknown): { v: unknown; conflict: boolean } {
  if (same(l, r) || same(r, b)) return { v: l, conflict: false };
  if (same(l, b)) return { v: r, conflict: false };
  return { v: l, conflict: true };
}

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Merges a block's own parts, props one by one; its children merge as blocks of their own. */
function mergeBare(b: any, l: any, r: any): { block: any; conflict: boolean } {
  let conflict = false;
  const out: any = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    let v: unknown;
    if (k === "props" && isPlain(l.props) && isPlain(r.props)) {
      const props: any = {};
      const bp = isPlain(b?.props) ? b.props : {};
      for (const p of new Set([...Object.keys(l.props), ...Object.keys(r.props)])) {
        const m = pick(bp[p], l.props[p], r.props[p]);
        conflict ||= m.conflict;
        if (m.v !== undefined) props[p] = m.v;
      }
      v = props;
    } else {
      const m = pick(b?.[k], l[k], r[k]);
      conflict ||= m.conflict;
      v = m.v;
    }
    if (v !== undefined) out[k] = v;
  }
  return { block: out, conflict };
}

/** A new id from `make(1)`, `make(2)`… that no block uses yet. */
function freshId(used: Set<string>, make: (n: number) => string): string {
  let n = 1;
  while (used.has(make(n))) n++;
  used.add(make(n));
  return make(n);
}

/** What each kept block says, and a copy of the cloud's version for each block both sides changed. */
function mergeContents({ B, L, R }: Sides, usedIds: Set<string>) {
  const bare = new Map<Key, any>();
  const copies = new Map<Key, any>();
  // A merge repeated before its new base was saved (a sync cut short) finds the copy already made.
  const copied = (id: string, r: any) =>
    [L, R].some((f) => [...f.node.values()].some((n) => typeof n.block.id === "string" && n.block.id.startsWith(`${id}-c`) && same({ ...n.block, id: undefined }, { ...r, id: undefined })));
  for (const key of new Set([...L.node.keys(), ...R.node.keys()])) {
    const b = B.node.get(key)?.block;
    const l = L.node.get(key)?.block;
    const r = R.node.get(key)?.block;
    if (l && r) {
      const m = mergeBare(b, l, r);
      bare.set(key, m.block);
      if (m.conflict && !copied(l.id, r)) {
        const id = typeof l.id === "string" ? { id: freshId(usedIds, (n) => (n === 1 ? `${l.id}-c` : `${l.id}-c${n}`)) } : {};
        copies.set(key, { ...r, ...id, children: [] });
      }
    } else {
      // On one side only: added there, or deleted on the other. Kept if it's new or was edited.
      const only = (l ?? r)!;
      if (!b || !same(only, b)) bare.set(key, only);
    }
  }
  return { bare, copies };
}

/** The block each kept block sits in. Adds to `bare` the blocks a kept one needs around or inside it. */
function mergeParents({ B, L, R }: Sides, bare: Map<Key, any>): Map<Key, Key> {
  const parent = new Map<Key, Key>();
  const parentOf = (key: Key): Key => {
    const l = L.node.get(key);
    const r = R.node.get(key);
    if (l && r) return pick(B.node.get(key)?.parent, l.parent, r.parent).v as Key;
    return (l ?? r)!.parent;
  };
  const keep = (key: Key, block: any) => {
    bare.set(key, block);
    parent.set(key, parentOf(key));
  };
  for (const key of bare.keys()) parent.set(key, parentOf(key));

  // A kept block inside a block deleted on the other side keeps that block.
  const keepParents = () => {
    let changed = false;
    for (const p of [...parent.values()]) {
      if (p === ROOT || bare.has(p)) continue;
      keep(p, (L.node.get(p) ?? R.node.get(p))!.block);
      changed = true;
    }
    return changed;
  };
  // A block kept although the other side deleted it comes back with what was inside it.
  const keepInside = () => {
    let changed = false;
    for (const key of [...bare.keys()]) {
      const f = L.node.has(key) && !R.node.has(key) ? L : R.node.has(key) && !L.node.has(key) ? R : null;
      if (!f || !B.node.has(key)) continue;
      const other = f === L ? R : L;
      for (const k of f.kids.get(key) ?? []) {
        if (bare.has(k) || other.node.has(k)) continue;
        keep(k, f.node.get(k)!.block);
        changed = true;
      }
    }
    return changed;
  };
  // A into B here while B went into A there makes a loop. Its blocks go where this device has them
  // (its own tree has no loops), or to the top level.
  const breakLoops = () => {
    let changed = false;
    for (const start of [...parent.keys()]) {
      const path: Key[] = [];
      for (let k = start; k !== ROOT; k = parent.get(k) ?? ROOT) {
        const i = path.indexOf(k);
        if (i < 0) {
          path.push(k);
          continue;
        }
        for (const x of path.slice(i)) parent.set(x, L.node.get(x)?.parent ?? ROOT);
        changed = true;
        break;
      }
    }
    return changed;
  };
  for (let changed = true; changed; ) {
    const kept = keepParents();
    const inside = keepInside();
    changed = breakLoops() || kept || inside;
  }
  return parent;
}

/** The keys of `seq` in the longest run that keeps base's order: everything else was moved or added. */
function unmoved(base: Key[], seq: Key[]): Set<Key> {
  const at = new Map(base.map((k, i) => [k, i]));
  // Longest increasing run of base positions by patience sorting, so long lists stay fast.
  const idx = seq.filter((k) => at.has(k));
  const tails: number[] = [];
  const prev: number[] = [];
  idx.forEach((k, i) => {
    const pos = at.get(k)!;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (at.get(idx[tails[mid]])! < pos) lo = mid + 1;
      else hi = mid;
    }
    prev[i] = lo > 0 ? tails[lo - 1] : -1;
    tails[lo] = i;
  });
  const keep = new Set<Key>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) keep.add(idx[i]);
  return keep;
}

/**
 * The order of the blocks `here` inside `p`. What neither side moved keeps the common order; what
 * one side moved or added goes after the block it follows on that side, this device's for a block
 * both moved.
 */
function mergeOrder({ B, L, R }: Sides, p: Key, here: Set<Key>): Key[] {
  const seq = (f: Flat) => (f.kids.get(p) ?? []).filter((k) => here.has(k));
  const b = seq(B);
  const l = seq(L);
  const r = seq(R);
  const keepL = unmoved(b, l);
  const keepR = unmoved(b, r);
  const movedL = l.filter((k) => !keepL.has(k));
  const movedLSet = new Set(movedL);
  const movedR = r.filter((k) => !keepR.has(k));
  const placed = new Set([...movedL, ...movedR]);
  const out = b.filter((k) => !placed.has(k));
  const index = new Map([l, r].map((s) => [s, new Map(s.map((k, i) => [k, i]))]));

  // Each moved block waits until the one it follows is placed, so a block added next to one the
  // other side moved stays next to it. The cloud's go first in each round, so after a shared
  // neighbour this device's end up first.
  const waiting = [...movedR.filter((k) => !movedLSet.has(k)).map((k) => ({ k, s: r })), ...movedL.map((k) => ({ k, s: l }))];
  const pending = new Set(waiting.map((w) => w.k));
  for (let force = false; waiting.length; ) {
    let progress = false;
    for (let w = 0; w < waiting.length; w++) {
      const { k, s } = waiting[w];
      let at = 0;
      let blocked = false;
      for (let j = index.get(s)!.get(k)! - 1; j >= 0; j--) {
        const i = out.indexOf(s[j]);
        if (i >= 0) {
          at = i + 1;
          break;
        }
        if (pending.has(s[j]) && !force) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      out.splice(at, 0, k);
      pending.delete(k);
      waiting.splice(w--, 1);
      progress = true;
    }
    // Two blocks each waiting for the other: place them anyway.
    force = !progress;
  }
  const inOut = new Set(out);
  for (const k of here) if (!inOut.has(k)) out.push(k);
  return out;
}

/** Three-way merge of a page's blocks (a tree), matched by block id anywhere in it. */
export function mergeBlocks(base: any[], local: any[], remote: any[]): any[] {
  const sides: Sides = { B: flatten(base), L: flatten(local), R: flatten(remote) };
  const usedIds = new Set([...sides.B.ids, ...sides.L.ids, ...sides.R.ids]);
  const { bare, copies } = mergeContents(sides, usedIds);
  const parent = mergeParents(sides, bare);

  const members = new Map<Key, Set<Key>>();
  for (const [key, p] of parent) {
    const set = members.get(p);
    if (set) set.add(key);
    else members.set(p, new Set([key]));
  }
  const renamed = new Map<Key, string>();
  const idOf = (key: Key, block: any) => {
    if (!key.includes("\u0000") || typeof block.id !== "string") return block.id;
    if (!renamed.has(key)) renamed.set(key, freshId(usedIds, (n) => `${block.id}-${n + 1}`));
    return renamed.get(key);
  };
  const hadChildren = (key: Key) => [sides.L, sides.R, sides.B].some((f) => f.kids.has(key));
  const build = (p: Key): any[] =>
    mergeOrder(sides, p, members.get(p) ?? new Set()).flatMap((key) => {
      const block = bare.get(key);
      const children = build(key);
      const id = idOf(key, block);
      const out = { ...block, ...(id !== undefined ? { id } : {}), ...(children.length || hadChildren(key) ? { children } : {}) };
      const copy = copies.get(key);
      return copy ? [out, copy] : [out];
    });
  return build(ROOT);
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
