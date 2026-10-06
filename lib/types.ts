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

// ---- Process design (see supabase/migrations/add_process_design.sql) ----

// Who or what does a step. 'person' may link to a real workspace member via
// member_user_id; 'role' is a job function ("Rig Supervisor"); 'system' is
// software that already exists ("SAP"); 'ai' is a proposed or live agent.
export type ActorKind = "person" | "role" | "system" | "ai";

export type ActorRow = {
  id: string;
  org_id: string;
  kind: ActorKind;
  name: string;
  member_user_id: string | null;
  color: string | null;
  notes: string | null;
  created_at: string;
};

// The consultant's verdict on a step. 'assist' = a human still does it but
// with automation/AI helping; 'automate' = the proposed actor takes it over.
export type Disposition = "undecided" | "keep" | "assist" | "automate" | "eliminate";

export type StepRow = {
  id: string;
  thread_id: string;
  title: string;
  detail: string | null;
  actor_id: string | null; // who does it today (as-is lane)
  proposed_actor_id: string | null; // who could do it (to-be lane)
  disposition: Disposition;
  pain: string | null;
  minutes_per_run: number | null;
  runs_per_month: number | null;
  seq: number;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
  updated_at: string;
};

export type StepEdgeRow = {
  id: string;
  thread_id: string;
  from_step_id: string;
  to_step_id: string;
  label: string | null;
  created_at: string;
};
