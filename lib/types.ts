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
  created_at: string;
};
