export type ThreadState = "live" | "quiet" | "cut";
export type NodeState = "prov" | "kept" | "pin";

export type ThreadRow = {
  id: string;
  name: string;
  state: ThreadState;
  step: number;
  context: string | null;
  questions: string[];
  touched_at: string;
};

export type NodeRow = {
  id: string;
  thread_id: string;
  parent_id: string | null;
  tech: string;
  base: string | null;
  items: string[];
  pulled: number[];
  state: NodeState;
  ready: boolean;
  cond: string | null;
  folded: boolean;
  by: string | null;
  by_label: string | null;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
};

// A knot's primary lineage still lives on parent_id (one parent, drives the
// tree layout). node_edges generalizes that into a real DAG: any additional
// "also informed by" links — e.g. a synthesis knot that combines two prior
// lines of inquiry — live here as extra rows, without disturbing the single
// parent_id every existing knot already has. See lib/layout.ts.
export type EdgeRow = {
  id: string;
  thread_id: string;
  from_node_id: string;
  to_node_id: string;
  relation: string;
  created_at: string;
};
