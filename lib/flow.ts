// Loom v2 model: workspace > workflows > lanes / nodes / edges, plus actors.
import { THEME } from "@/lib/colors";
// See supabase migrations workflow_model_*.

export type ActorKind = "person" | "team" | "system" | "ai" | "external";
export type NodeType = "start" | "action" | "decision" | "wait" | "document" | "end";

export type Actor = {
  id: string;
  org_id: string;
  kind: ActorKind;
  name: string;
  role: string | null;
  color: string | null;
  notes: string | null;
  /** Set when this role is an enterprise role shared by every workspace in the organization. */
  enterprise_id?: string | null;
};

export type Workflow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string | null;
  ai_context?: string | null;
  locked?: boolean; // owners/admins can lock a process: view-only until unlocked
  locked_at?: string | null;
};

export type Lane = {
  id: string;
  workflow_id: string;
  name: string;
  color: string | null;
  position: number;
};

export type FlowNode = {
  id: string;
  workflow_id: string;
  lane_id: string | null;
  actor_id: string | null;
  type: NodeType;
  label: string;
  description: string | null;
  x: number;
  y_offset: number;
  duration_minutes?: number | null; // how long the step itself takes
  wait_minutes?: number | null; // how long work waits before the step starts
};

// ---- roadmaps: named plans, each split into colored phases that group steps ----
export type Roadmap = { id: string; workflow_id: string; name: string; color: string | null; position: number };
export type RoadmapPhase = {
  id: string;
  roadmap_id: string;
  workflow_id: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
};
export type PhaseNode = { phase_id: string; node_id: string; workflow_id: string };

/** What the diagram is currently "looking at": everything else is dimmed. */
export type Lens =
  | { kind: "roadmap"; id: string }
  | { kind: "phase"; id: string }
  | { kind: "actor"; id: string }
  | { kind: "lane"; id: string }
  | null;

export type Focus = {
  ids: Set<string>; // steps kept at full strength
  ring: string | null; // color of the highlight ring
  badges: Map<string, string[]>; // step id → colors of the phases it belongs to
  selecting: boolean; // clicking a step toggles it in the active phase
};

export type EdgeKind = "flow" | "info" | "exception";

export const EDGE_KINDS: {
  key: EdgeKind;
  en: string;
  de: string;
  hint: string;
  hintDe: string;
  dash: string | undefined;
  color: string;
}[] = [
  { key: "flow", en: "Flow", de: "Ablauf", hint: "Work moves forward", hintDe: "Die Arbeit geht weiter", dash: undefined, color: THEME.slate },
  { key: "info", en: "Info", de: "Info", hint: "Information or a document is passed along; no work moves", hintDe: "Information oder Dokument wird weitergereicht; keine Arbeit bewegt sich", dash: "8 6", color: "#8fa6ff" },
  { key: "exception", en: "Rework", de: "Nacharbeit", hint: "An exception, a loop back, or when things go wrong", hintDe: "Ausnahme, Rückschleife oder wenn etwas schiefgeht", dash: "2 6", color: THEME.danger },
];
export const edgeKindInfo = (k: EdgeKind | null | undefined) => EDGE_KINDS.find((x) => x.key === k) ?? EDGE_KINDS[0];

export type FlowEdge = {
  id: string;
  workflow_id: string;
  from_node_id: string;
  to_node_id: string;
  label: string | null;
  source_handle: string | null;
  target_handle: string | null;
  kind: EdgeKind;
  color?: string | null;
  payload?: string | null;
  channel?: string | null;
  wait_minutes?: number | null;
  friction?: Friction | null;
  weight?: Weight | null;
  note?: string | null;
};
export type Friction = "none" | "some" | "painful";
// how much work travels a line — drawn as line thickness (a light Sankey view)
export type Weight = "light" | "medium" | "heavy";
export const WEIGHTS: { key: Weight; en: string; de: string; px: number }[] = [
  { key: "light", en: "Occasional", de: "Gelegentlich", px: 1.1 },
  { key: "medium", en: "Regular", de: "Regelmäßig", px: 2.6 },
  { key: "heavy", en: "Main route", de: "Hauptweg", px: 5 },
];
export type EdgePatch = Partial<Pick<FlowEdge, "label" | "kind" | "color" | "payload" | "channel" | "wait_minutes" | "friction" | "weight" | "note">>;
export const FRICTIONS: { key: Friction; en: string; de: string; color: string }[] = [
  { key: "none", en: "None", de: "Keine", color: "#4ade80" },
  { key: "some", en: "Some", de: "Etwas", color: "#fbbf24" },
  { key: "painful", en: "Painful", de: "Schmerzhaft", color: THEME.danger },
];
export const CHANNELS: { en: string; de: string }[] = [
  { en: "Email", de: "E-Mail" },
  { en: "System / app", de: "System / App" },
  { en: "Phone", de: "Telefon" },
  { en: "Paper", de: "Papier" },
  { en: "Shared drive", de: "Gemeinsames Laufwerk" },
  { en: "Verbal", de: "Mündlich" },
];
export const WAIT_UNITS = [
  { key: "min", mult: 1, en: "minutes", de: "Minuten" },
  { key: "h", mult: 60, en: "hours", de: "Stunden" },
  { key: "d", mult: 1440, en: "days", de: "Tage" },
] as const;
export function waitParts(m: number | null | undefined): { v: string; unit: (typeof WAIT_UNITS)[number] } {
  if (!m) return { v: "", unit: WAIT_UNITS[0] };
  const u = m % 1440 === 0 ? WAIT_UNITS[2] : m % 60 === 0 ? WAIT_UNITS[1] : WAIT_UNITS[0];
  return { v: String(m / u.mult), unit: u };
}

// ---- palette: 8 colors usable for actors, lanes and workflows -------------
export const PALETTE = ["#60a5fa", THEME.orange, "#5eead4", "#c084fc", "#f472b6", "#a3e635", "#fb7185", "#22d3ee"];
/** Muted palette for roles (same family as the NGR demo roles). PALETTE above stays for lanes, processes and members. */
export const ROLE_PALETTE = ["#5f8bb3", "#5a8a6b", "#d08a3c", "#8a7bb0", "#b5677d", "#8f9a4f", "#b8765a", "#6b8f94"];
export const NEUTRAL = "#64748b";
export const pickColor = (i: number) => PALETTE[i % PALETTE.length];

// ---- actor kinds: SHAPE tells you what kind of player owns a node --------
export const ACTOR_KINDS: { key: ActorKind; en: string; de: string; hint: string; hintDe: string }[] = [
  { key: "person", en: "Person", de: "Person", hint: "A named individual", hintDe: "Eine namentlich bekannte Person" },
  { key: "team", en: "Team", de: "Team", hint: "A department or role group", hintDe: "Abteilung oder Rollengruppe" },
  { key: "system", en: "System", de: "System", hint: "Software or machine", hintDe: "Software oder Maschine" },
  { key: "ai", en: "AI", de: "KI", hint: "An AI agent or model", hintDe: "Ein KI-Agent oder -Modell" },
  { key: "external", en: "Outside party", de: "Externe Partei", hint: "Customer, supplier, regulator", hintDe: "Kunde, Lieferant, Behörde" },
];

// ---- node types: what happens on a node ----------------------------------
export const NODE_TYPES: { key: NodeType; en: string; de: string; glyph: string; hint: string; hintDe: string }[] = [
  { key: "start", en: "Start", de: "Beginn", glyph: "▶", hint: "What kicks the process off", hintDe: "Was den Prozess auslöst" },
  { key: "action", en: "Action", de: "Aktion", glyph: "■", hint: "Someone or something does work", hintDe: "Jemand oder etwas leistet Arbeit" },
  { key: "decision", en: "Decision", de: "Entscheidung", glyph: "◆", hint: "A branch: two or more ways out", hintDe: "Eine Verzweigung mit mehreren Wegen" },
  { key: "wait", en: "Wait / Handoff", de: "Warten / Übergabe", glyph: "◔", hint: "Work sits idle or changes hands", hintDe: "Arbeit liegt still oder wechselt den Besitzer" },
  { key: "document", en: "Document / Data", de: "Dokument / Daten", glyph: "▤", hint: "Something produced or consumed", hintDe: "Etwas wird erzeugt oder verwendet" },
  { key: "end", en: "End", de: "Ende", glyph: "⏚", hint: "Where the process stops", hintDe: "Wo der Prozess endet" },
];
export const nodeTypeInfo = (t: NodeType) => NODE_TYPES.find((x) => x.key === t)!;

// ---- canvas geometry (flow coordinates) ----------------------------------
export const LANE_H = 200;
export const LANE_LABEL_W = 150; // chalkline label tab at the left edge
export const LANE_W = 6000;
export const MIN_X = LANE_LABEL_W + 40;
export const NODE_W = 200;
export const NODE_H = 76;

export const laneIndexAt = (y: number, laneCount: number) =>
  Math.max(0, Math.min(laneCount - 1, Math.floor(y / LANE_H)));

// ---- comments on steps ----
export type FlowComment = {
  id: string;
  workflow_id: string;
  node_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

// ---- the layer (z=1): questions, findings and ideas pinned to steps and lines ----
export type PinKind = "question" | "finding" | "idea";
export type LineageStep = { kind: string; text: string; de?: string };
export type Lineage = LineageStep[];

export type FlowPin = {
  id: string;
  workflow_id: string;
  node_id: string | null;
  edge_id: string | null;
  parent_id: string | null;
  kind: PinKind;
  body: string;
  status: "open" | "active" | "done" | "dismissed";
  origin: string | null; // key of the signal this pin came from, if any
  support: string | null; // an idea's short "because…" (reason or evidence)
  phase_id: string | null; // legacy (plans were retired in favour of pursuits)
  pursued_at: string | null; // set when the pin is pursued; the Pursuits list is every pin with this
  headline: string | null; // a three-word label for a pursuit (Loom writes it, you can change it)
  lineage: Lineage | null; // where it came from, frozen at the moment it was pursued
  author_name: string;
  created_at: string;
};
