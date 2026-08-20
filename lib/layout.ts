import type { EdgeRow, NodeRow } from "./types";

export const ROOT_ID = "__root__";
// Widened alongside the larger knot fonts (was 220, then 240, then 260) —
// more horizontal room means the same text wraps to fewer lines, which
// keeps the height bump from the bigger type smaller than it would
// otherwise be.
export const NODE_W = 280;
export const NODE_H = 92;
export const GAP_X = 120;
// A knot's real rendered height (tech label + glyph, up to 3 lines of
// wrapped text at the larger legible font, an optional state badge, the
// PULL button row, padding and border) comfortably exceeds NODE_H once
// badge + button are both present — worst case runs close to 210px at the
// current font sizes. GAP_Y has to absorb that gap on top of NODE_H, not
// just add cosmetic breathing room, or sibling knots at the same depth
// overlap. Row pitch (NODE_H + GAP_Y) = 232px, ~20px of margin over the
// realistic worst case.
export const GAP_Y = 140;

export type Point = { x: number; y: number };

/**
 * Positions nodes left-to-right by depth (distance from the question) and
 * top-to-bottom by leaf order, same shape as the-loom.html's layout(), but
 * adapted to a virtual root since threads don't store a literal root node
 * row — the question pill plays that role visually.
 */
export function layoutThread(nodes: NodeRow[]): Record<string, Point> {
  const byParent = new Map<string | null, NodeRow[]>();
  for (const n of nodes) {
    const key = n.parent_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  const slotOf: Record<string, { depth: number; row: number }> = {};
  let slot = 0;

  function walk(id: string, depth: number): number {
    const children = byParent.get(id === ROOT_ID ? null : id) ?? [];
    if (!children.length) {
      const row = slot++;
      slotOf[id] = { depth, row };
      return row;
    }
    const rows = children.map((c) => walk(c.id, depth + 1));
    const row = (Math.min(...rows) + Math.max(...rows)) / 2;
    slotOf[id] = { depth, row };
    return row;
  }

  walk(ROOT_ID, 0);

  const out: Record<string, Point> = {};
  for (const id in slotOf) {
    out[id] = {
      x: slotOf[id].depth * (NODE_W + GAP_X),
      y: slotOf[id].row * (NODE_H + GAP_Y),
    };
  }
  return out;
}

/**
 * Every stored edge that ISN'T already implied by a knot's primary
 * parent_id — the extra "also informed by" links a synthesis knot carries
 * on top of its one primary parent. These never affect depth/row layout
 * (that's still driven by parent_id alone, so the board stays a clean
 * tree skeleton); they're drawn as secondary wires on top of it. Once a
 * knot has two or more of these pointing in, the board is a true DAG, not
 * just a tree — this is the seam where that shows up.
 */
export function secondaryEdges(nodes: NodeRow[], edges: EdgeRow[]): EdgeRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return edges.filter((e) => {
    const target = byId.get(e.to_node_id);
    return !target || target.parent_id !== e.from_node_id;
  });
}

/** Ancestor chain from the question down to (and including) `id`. */
export function pathTo(nodes: NodeRow[], id: string | null): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path = new Set<string>();
  let cur = id ? byId.get(id) : undefined;
  while (cur) {
    path.add(cur.id);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}
