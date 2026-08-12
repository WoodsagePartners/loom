import type { NodeRow } from "./types";

export const ROOT_ID = "__root__";
// Widened alongside the larger knot fonts (was 220) — more horizontal room
// means the same text wraps to fewer lines, which keeps the height bump
// from the bigger type smaller than it would otherwise be.
export const NODE_W = 240;
export const NODE_H = 92;
export const GAP_X = 110;
// A knot's real rendered height (tech label + glyph, up to 3 lines of
// wrapped text at the larger legible font, an optional state badge, the
// PULL button row, padding and border) comfortably exceeds NODE_H once
// badge + button are both present — worst case runs close to 190px at the
// current font sizes. GAP_Y has to absorb that gap on top of NODE_H, not
// just add cosmetic breathing room, or sibling knots at the same depth
// overlap. Row pitch (NODE_H + GAP_Y) = 204px, ~15px of margin over the
// realistic worst case.
export const GAP_Y = 112;

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
