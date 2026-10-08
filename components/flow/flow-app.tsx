"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { createClient } from "@/lib/supabase/client";
import {
  LANE_H,
  MIN_X,
  NODE_H,
  pickColor,
  PALETTE,
  type Actor,
  type ActorKind,
  type EdgeKind,
  type FlowEdge,
  type Focus,
  type FlowNode,
  type Lane,
  type Lens,
  type PhaseNode,
  type Roadmap,
  type RoadmapPhase,
  type Workflow,
  type EdgePatch,
  type FlowComment,
} from "@/lib/flow";
import type { Workspace, WorkspaceRole } from "@/lib/workspaces";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { LangToggle } from "@/components/lang-toggle";
import { LeftNav } from "@/components/flow/left-nav";
import { MoreMenu } from "@/components/more-menu";
import { CtaBanner } from "@/components/flow/cta-banner";
import { WorkflowCanvas } from "@/components/flow/workflow-canvas";
import { TeamPanel } from "@/components/team-panel";
import { AccountMenu, AccountModal } from "@/components/account";
import { PresenceStack, usePresence } from "@/components/presence";
import { Guide, guideSeen, markGuideSeen } from "@/components/guide";
import { CommentCard } from "@/components/flow/comment-card";
import type { Profile } from "@/lib/profile";
import { useT } from "@/lib/i18n";
import { ContentI18nProvider, Tx } from "@/lib/content-i18n";

type Initial = {
  workflows: Workflow[];
  lanes: Lane[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  actors: Actor[];
  roadmaps: Roadmap[];
  phases: RoadmapPhase[];
  phaseNodes: PhaseNode[];
};

export function FlowApp({
  orgId,
  orgName,
  workspaces,
  role,
  memberCount,
  buildSha,
  profile: initialProfile,
  initial,
}: {
  orgId: string;
  orgName: string;
  workspaces: Workspace[];
  role: WorkspaceRole;
  memberCount: number;
  buildSha: string;
  profile: Profile;
  initial: Initial;
}) {
  const t = useT();
  const sb = useMemo(() => createClient(), []);

  const [workflows, setWorkflows] = useState(initial.workflows);
  const [lanes, setLanes] = useState(initial.lanes);
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);
  const [actors, setActors] = useState(initial.actors);
  const [roadmaps, setRoadmaps] = useState(initial.roadmaps);
  const [phases, setPhases] = useState(initial.phases);
  const [phaseNodes, setPhaseNodes] = useState(initial.phaseNodes);
  const [lens, setLens] = useState<Lens>(null);
  const [selecting, setSelecting] = useState(false);
  const [dotOpen, setDotOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initial.workflows[0]?.id ?? null);
  const [ask, confirmDialog] = useConfirm();
  const [toast, setToast] = useState<{ msg: string; kind: "error" | "info" } | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStart, setGuideStart] = useState<string | undefined>(undefined);
  const [members, setMembers] = useState<{ id: string; email: string; name: string; role: string }[]>([]);
  const [guideOffer, setGuideOffer] = useState(false);
  const [comments, setComments] = useState<FlowComment[]>([]);
  const [commentNodeId, setCommentNodeId] = useState<string | null>(null);
  useEffect(() => {
    if (!guideSeen()) setGuideOffer(true); // first visit only: offer, never force
  }, []);
  const [profile, setProfile] = useState(initialProfile);
  const peers = usePresence(orgId, profile, (p) => setToast({ msg: `${p.name || p.email.split("@")[0]} ${t("joined the workspace", "ist dem Arbeitsbereich beigetreten")}`, kind: "info" }));
  // who is in this workspace (shown under Team in the left menu); refresh whenever the Team panel closes
  useEffect(() => {
    if (teamOpen) return;
    let live = true;
    (async () => {
      const [{ data }, { data: names }] = await Promise.all([sb.rpc("team_members", { target_org: orgId }), sb.rpc("team_member_names", { target_org: orgId })]);
      if (!live || !Array.isArray(data)) return;
      const nameOf = new Map<string, string>(((names ?? []) as { user_id: string; full_name: string | null }[]).map((n) => [n.user_id, n.full_name ?? ""]));
      setMembers(
        (data as { user_id: string; email: string; role: string }[])
          .map((m) => ({ id: m.user_id, email: m.email, name: nameOf.get(m.user_id) ?? "", role: m.role }))
          .sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.role === "admin" ? -1 : 1))
      );
    })();
    return () => { live = false; };
  }, [orgId, teamOpen, sb]);
  const [firstName, setFirstName] = useState("");

  // remember the last workflow per workspace (per-viewer convenience only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`loom_wf_${orgId}`);
      if (saved && initial.workflows.some((w) => w.id === saved)) setActiveId(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);
  const select = (id: string) => {
    setLens(null);
    setSelecting(false);
    setActiveId(id);
    try {
      localStorage.setItem(`loom_wf_${orgId}`, id);
    } catch {}
  };

  // Save confirmation: one quiet "Saved" after a burst of edits settles — never per keystroke or drag.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedToast = useRef(0);
  const hadError = useRef(false);
  const fail = useCallback((msg: string, kind: "error" | "info" = "error") => {
    if (kind === "error") hadError.current = true;
    setToast({ msg, kind });
  }, []);
  // Loom is built for a big screen: a gentle, one-time heads-up on small ones.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("loom_desktop_note") === "1";
    } catch {}
    if (seen || window.innerWidth >= 1000) return;
    try {
      sessionStorage.setItem("loom_desktop_note", "1");
    } catch {}
    const id = setTimeout(() => fail(t("Loom works best on a desktop or laptop screen.", "Loom funktioniert am besten auf einem Desktop- oder Laptop-Bildschirm."), "info"), 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const noteEdit = () => {
    hadError.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (hadError.current || Date.now() - lastSavedToast.current < 15000) return;
      lastSavedToast.current = Date.now();
      setToast({ msg: t("All changes saved ✓", "Alle Änderungen gespeichert ✓"), kind: "info" });
    }, 2500);
  };
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.kind === "info" ? Math.max(2800, toast.msg.length * 90) : 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const reload = useCallback(async () => {
    const ids = (await sb.from("workflows").select("*").eq("org_id", orgId).order("created_at")).data as Workflow[] | null;
    const wf = ids ?? [];
    const wfIds = wf.map((w) => w.id);
    const [a, l, n, e, rm, ph, pn, cm] = await Promise.all([
      sb.from("actors").select("*").eq("org_id", orgId).order("created_at"),
      wfIds.length ? sb.from("lanes").select("*").in("workflow_id", wfIds).order("position") : Promise.resolve({ data: [] }),
      wfIds.length ? sb.from("flow_nodes").select("*").in("workflow_id", wfIds) : Promise.resolve({ data: [] }),
      wfIds.length ? sb.from("flow_edges").select("*").in("workflow_id", wfIds) : Promise.resolve({ data: [] }),
      wfIds.length ? sb.from("roadmaps").select("*").in("workflow_id", wfIds).order("position") : Promise.resolve({ data: [] }),
      wfIds.length ? sb.from("roadmap_phases").select("*").in("workflow_id", wfIds).order("position") : Promise.resolve({ data: [] }),
      wfIds.length ? sb.from("phase_nodes").select("*").in("workflow_id", wfIds) : Promise.resolve({ data: [] }),
      wfIds.length ? sb.from("flow_comments").select("*").in("workflow_id", wfIds).order("created_at") : Promise.resolve({ data: [] }),
    ]);
    setComments((cm.data ?? []) as FlowComment[]); // stays empty until the comments table exists
    setRoadmaps((rm.data ?? []) as Roadmap[]);
    setPhases((ph.data ?? []) as RoadmapPhase[]);
    setPhaseNodes((pn.data ?? []) as PhaseNode[]);
    setWorkflows(wf);
    setActors((a.data ?? []) as Actor[]);
    setLanes((l.data ?? []) as Lane[]);
    setNodes((n.data ?? []) as FlowNode[]);
    setEdges((e.data ?? []) as FlowEdge[]);
  }, [sb, orgId]);

  // pick up teammates' work when returning to the tab (they work asynchronously, over days)
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [reload]);

  const wfLanes = useMemo(() => lanes.filter((l) => l.workflow_id === activeId).sort((a, b) => a.position - b.position), [lanes, activeId]);
  const wfNodes = useMemo(() => nodes.filter((n) => n.workflow_id === activeId), [nodes, activeId]);
  const commentCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of comments) out[c.node_id] = (out[c.node_id] ?? 0) + 1;
    return out;
  }, [comments]);
  const commentNode = commentNodeId ? nodes.find((n) => n.id === commentNodeId) ?? null : null;
  async function addComment(body: string) {
    if (!commentNode) return;
    const { data, error } = await sb
      .from("flow_comments")
      .insert({ workflow_id: commentNode.workflow_id, node_id: commentNode.id, body, author_name: profile.name || profile.email })
      .select("*")
      .single();
    if (error || !data) return fail(t("Couldn't save the comment.", "Kommentar konnte nicht gespeichert werden."));
    setComments((cs) => [...cs, data as FlowComment]);
  }
  async function deleteComment(id: string) {
    const { error } = await sb.from("flow_comments").delete().eq("id", id);
    if (error) return fail(t("Couldn't delete the comment.", "Kommentar konnte nicht gelöscht werden."));
    setComments((cs) => cs.filter((c) => c.id !== id));
  }
  const wfEdges = useMemo(() => edges.filter((e) => e.workflow_id === activeId), [edges, activeId]);
  const active = workflows.find((w) => w.id === activeId) ?? null;

  // ------------------------------------------------------------ undo/redo --
  // Snapshot history of the active workflow's steps and lines. Undo/redo diffs the
  // snapshot against the current data and applies the difference to the database.
  type Snap = { nodes: FlowNode[]; edges: FlowEdge[] };
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const activeRef = useRef(activeId);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  activeRef.current = activeId;
  const hist = useRef<{ past: Snap[]; future: Snap[]; last: number }>({ past: [], future: [], last: 0 });
  const [histCount, setHistCount] = useState({ u: 0, r: 0 });
  const syncHist = () => setHistCount({ u: hist.current.past.length, r: hist.current.future.length });
  const snap = (): Snap => ({
    nodes: nodesRef.current.filter((n) => n.workflow_id === activeRef.current),
    edges: edgesRef.current.filter((e) => e.workflow_id === activeRef.current),
  });
  // call BEFORE a change; changes within 0.7s (e.g. add step + its line) share one undo step
  const record = () => {
    noteEdit();
    const h = hist.current;
    const now = Date.now();
    if (now - h.last > 700) {
      h.past.push(snap());
      if (h.past.length > 60) h.past.shift();
      h.future = [];
      syncHist();
    }
    h.last = now;
  };
  useEffect(() => {
    hist.current = { past: [], future: [], last: 0 };
    syncHist();
  }, [activeId]);

  async function applySnap(target: Snap) {
    const wf = activeRef.current;
    if (!wf) return;
    const cur = snap();
    const tn = new Set(target.nodes.map((n) => n.id));
    const te = new Set(target.edges.map((e) => e.id));
    const cn = new Map(cur.nodes.map((n) => [n.id, JSON.stringify(n)]));
    const ce = new Map(cur.edges.map((e) => [e.id, JSON.stringify(e)]));
    const delNodes = cur.nodes.filter((n) => !tn.has(n.id)).map((n) => n.id);
    const delEdges = cur.edges.filter((e) => !te.has(e.id)).map((e) => e.id);
    const upNodes = target.nodes.filter((n) => cn.get(n.id) !== JSON.stringify(n));
    const upEdges = target.edges.filter((e) => ce.get(e.id) !== JSON.stringify(e));
    setNodes((p) => [...p.filter((n) => n.workflow_id !== wf), ...target.nodes]);
    setEdges((p) => [...p.filter((e) => e.workflow_id !== wf), ...target.edges]);
    const errs: string[] = [];
    if (delEdges.length) { const r = await sb.from("flow_edges").delete().in("id", delEdges); if (r.error) errs.push(r.error.message); }
    if (delNodes.length) { const r = await sb.from("flow_nodes").delete().in("id", delNodes); if (r.error) errs.push(r.error.message); }
    if (upNodes.length) { const r = await sb.from("flow_nodes").upsert(upNodes); if (r.error) errs.push(r.error.message); }
    if (upEdges.length) { const r = await sb.from("flow_edges").upsert(upEdges); if (r.error) errs.push(r.error.message); }
    if (errs.length) {
      fail(errs[0]);
      reload();
    }
  }
  function undo() {
    const h = hist.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(snap());
    h.last = 0;
    syncHist();
    applySnap(prev);
  }
  function redo() {
    const h = hist.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(snap());
    h.last = 0;
    syncHist();
    applySnap(next);
  }
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        (e.shiftKey ? redoRef.current : undoRef.current)();
      } else if (k === "y") {
        e.preventDefault();
        redoRef.current();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  // everything people typed that the language toggle should translate
  const contentTexts = useMemo(
    () => [
      ...workflows.flatMap((w) => [w.name, w.description ?? ""]),
      ...lanes.map((l) => l.name),
      ...actors.flatMap((a) => [a.name, a.role ?? ""]),
      ...nodes.flatMap((n) => [n.label ?? "", n.description ?? ""]),
      ...edges.flatMap((e) => [e.label ?? "", e.payload ?? "", e.channel ?? "", e.note ?? ""]),
      ...roadmaps.map((r) => r.name),
      ...phases.map((p) => p.name),
    ],
    [workflows, lanes, actors, nodes, edges, roadmaps, phases]
  );

  // ------------------------------------------------------------ workflows --
  async function createWorkflow(name: string, color?: string) {
    const { data: wf, error } = await sb
      .from("workflows")
      .insert({ org_id: orgId, name, color: color ?? pickColor(workflows.length) })
      .select("*")
      .single();
    if (error || !wf) return fail(error?.message ?? t("Could not create the process.", "Der Prozess konnte nicht angelegt werden."));
    const { data: lane, error: lErr } = await sb
      .from("lanes")
      .insert({ workflow_id: wf.id, name: t("Lane 1", "Bahn 1"), color: pickColor(0), position: 0 })
      .select("*")
      .single();
    if (lErr || !lane) return fail(lErr?.message ?? t("Could not create the first lane.", "Die erste Bahn konnte nicht angelegt werden."));
    const { data: start } = await sb
      .from("flow_nodes")
      .insert({ workflow_id: wf.id, lane_id: lane.id, type: "start", label: t("Start", "Beginn"), x: MIN_X, y_offset: (LANE_H - NODE_H) / 2 })
      .select("*")
      .single();
    setWorkflows((p) => [...p, wf as Workflow]);
    setLanes((p) => [...p, lane as Lane]);
    if (start) setNodes((p) => [...p, start as FlowNode]);
    select(wf.id);
  }

  async function patchWorkflow(id: string, patch: Partial<Workflow>) {
    setWorkflows((p) => p.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    const { error } = await sb.from("workflows").update(patch).eq("id", id);
    if (error) {
      fail(error.message);
      reload();
    }
  }

  async function duplicateWorkflow(id: string) {
    const src = workflows.find((x) => x.id === id);
    if (!src) return;
    fail(t("Copying… one second.", "Wird kopiert … einen Moment."), "info");
    const { id: _w, ...wfRest } = src as Workflow & Record<string, unknown>;
    const { data: wf, error } = await sb
      .from("workflows")
      .insert({ ...wfRest, name: `${src.name} ${t("(copy)", "(Kopie)")}` })
      .select("*")
      .single();
    if (error || !wf) return fail(error?.message ?? t("Could not copy the process.", "Der Prozess konnte nicht kopiert werden."));
    const laneMap: Record<string, string> = {};
    const nodeMap: Record<string, string> = {};
    const srcLanes = lanes.filter((l) => l.workflow_id === id);
    for (const l of srcLanes) {
      const { id: oldId, ...rest } = l as Lane & Record<string, unknown>;
      const { data, error: e } = await sb.from("lanes").insert({ ...rest, workflow_id: wf.id }).select("id").single();
      if (e || !data) return fail(e?.message ?? t("Copy stopped at the lanes.", "Kopie bei den Bahnen abgebrochen."));
      laneMap[oldId] = data.id;
    }
    for (const n of nodes.filter((x) => x.workflow_id === id)) {
      const { id: oldId, ...rest } = n as FlowNode & Record<string, unknown>;
      const { data, error: e } = await sb
        .from("flow_nodes")
        .insert({ ...rest, workflow_id: wf.id, lane_id: n.lane_id ? laneMap[n.lane_id] ?? null : null })
        .select("id")
        .single();
      if (e || !data) return fail(e?.message ?? t("Copy stopped at the steps.", "Kopie bei den Schritten abgebrochen."));
      nodeMap[oldId] = data.id;
    }
    for (const ed of edges.filter((x) => x.workflow_id === id)) {
      const { id: _e, ...rest } = ed as FlowEdge & Record<string, unknown>;
      if (!nodeMap[ed.from_node_id] || !nodeMap[ed.to_node_id]) continue;
      const { error: e } = await sb
        .from("flow_edges")
        .insert({ ...rest, workflow_id: wf.id, from_node_id: nodeMap[ed.from_node_id], to_node_id: nodeMap[ed.to_node_id] });
      if (e) return fail(e.message);
    }
    await reload();
    select(wf.id);
    fail(t("Copied. Plans aren't included.", "Kopiert. Pläne sind nicht enthalten."), "info");
  }

  async function deleteWorkflow(id: string) {
    const w = workflows.find((x) => x.id === id);
    if (!(await ask(t(`Delete "${w?.name}" and everything in it?`, `„${w?.name}“ und alles darin löschen?`)))) return;
    const { error } = await sb.from("workflows").delete().eq("id", id);
    if (error) return fail(error.message);
    const rest = workflows.filter((x) => x.id !== id);
    setWorkflows(rest);
    if (activeId === id) setActiveId(rest[0]?.id ?? null);
    reload();
  }

  // ---------------------------------------------------------------- lanes --
  async function addLane(name: string, color?: string) {
    if (!activeId) return;
    const position = wfLanes.reduce((m, l) => Math.max(m, l.position), -1) + 1;
    const { data, error } = await sb
      .from("lanes")
      .insert({ workflow_id: activeId, name, color: color ?? pickColor(wfLanes.length), position })
      .select("*")
      .single();
    if (error || !data) return fail(error?.message ?? t("Could not add the lane.", "Die Bahn konnte nicht hinzugefügt werden."));
    setLanes((p) => [...p, data as Lane]);
  }

  async function duplicateLane(id: string) {
    const src = lanes.find((l) => l.id === id);
    if (!src || !activeId) return;
    fail(t("Copying… one second.", "Wird kopiert … einen Moment."), "info");
    const position = wfLanes.reduce((m, l) => Math.max(m, l.position), -1) + 1;
    const { id: _l, ...laneRest } = src as Lane & Record<string, unknown>;
    const { data: lane, error } = await sb
      .from("lanes")
      .insert({ ...laneRest, name: `${src.name} ${t("(copy)", "(Kopie)")}`, position })
      .select("id")
      .single();
    if (error || !lane) return fail(error?.message ?? t("Could not copy the lane.", "Die Bahn konnte nicht kopiert werden."));
    const nodeMap: Record<string, string> = {};
    // the Start step is one per process, so it stays behind
    for (const n of nodes.filter((x) => x.lane_id === id && x.type !== "start")) {
      const { id: oldId, ...rest } = n as FlowNode & Record<string, unknown>;
      const { data, error: e } = await sb.from("flow_nodes").insert({ ...rest, lane_id: lane.id }).select("id").single();
      if (e || !data) return fail(e?.message ?? t("Copy stopped at the steps.", "Kopie bei den Schritten abgebrochen."));
      nodeMap[oldId] = data.id;
    }
    for (const ed of edges.filter((x) => nodeMap[x.from_node_id] && nodeMap[x.to_node_id])) {
      const { id: _e, ...rest } = ed as FlowEdge & Record<string, unknown>;
      const { error: e } = await sb
        .from("flow_edges")
        .insert({ ...rest, from_node_id: nodeMap[ed.from_node_id], to_node_id: nodeMap[ed.to_node_id] });
      if (e) return fail(e.message);
    }
    await reload();
    fail(t("Lane copied below. Lines between lanes aren't copied.", "Bahn unten kopiert. Linien zwischen Bahnen werden nicht kopiert."), "info");
  }

  async function patchLane(id: string, patch: Partial<Lane>) {
    setLanes((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await sb.from("lanes").update(patch).eq("id", id);
    if (error) {
      fail(error.message);
      reload();
    }
  }

  async function moveLane(id: string, dir: -1 | 1) {
    const i = wfLanes.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= wfLanes.length) return;
    const a = wfLanes[i];
    const b = wfLanes[j];
    setLanes((p) => p.map((l) => (l.id === a.id ? { ...l, position: b.position } : l.id === b.id ? { ...l, position: a.position } : l)));
    const r = await Promise.all([
      sb.from("lanes").update({ position: b.position }).eq("id", a.id),
      sb.from("lanes").update({ position: a.position }).eq("id", b.id),
    ]);
    if (r.some((x) => x.error)) {
      fail(r.find((x) => x.error)!.error!.message);
      reload();
    }
  }

  async function deleteLane(id: string) {
    const inLane = wfNodes.filter((n) => n.lane_id === id);
    const others = wfLanes.filter((l) => l.id !== id);
    if (inLane.length > 0 && others.length === 0)
      return fail(t("Add another lane first — this one still holds steps.", "Fügen Sie zuerst eine weitere Bahn hinzu — diese enthält noch Schritte."));
    if (!(await ask(inLane.length ? t(`Delete this lane? Its ${inLane.length} step(s) move to "${others[0].name}".`, `Bahn löschen? Die ${inLane.length} Schritte wandern nach „${others[0].name}“.`) : t("Delete this lane?", "Diese Bahn löschen?")))) return;
    if (inLane.length) {
      const { error } = await sb.from("flow_nodes").update({ lane_id: others[0].id }).eq("lane_id", id);
      if (error) return fail(error.message);
    }
    const { error } = await sb.from("lanes").delete().eq("id", id);
    if (error) return fail(error.message);
    reload();
  }

  // --------------------------------------------------------------- actors --
  async function addActor(a: { name: string; kind: ActorKind; role: string }) {
    const { data, error } = await sb
      .from("actors")
      .insert({ org_id: orgId, name: a.name, kind: a.kind, role: a.role || null, color: pickColor(actors.length) })
      .select("*")
      .single();
    if (error || !data) return fail(error?.message ?? t("Could not add the role.", "Die Rolle konnte nicht hinzugefügt werden."));
    setActors((p) => [...p, data as Actor]);
  }

  async function patchActor(id: string, patch: Partial<Actor>) {
    setActors((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await sb.from("actors").update(patch).eq("id", id);
    if (error) {
      fail(error.message);
      reload();
    }
  }

  async function deleteActor(id: string) {
    const a = actors.find((x) => x.id === id);
    const used = nodes.filter((n) => n.actor_id === id).length;
    if (!(await ask(t(`Delete "${a?.name}"?${used ? ` ${used} step(s) will have no owner.` : ""}`, `„${a?.name}“ löschen?${used ? ` ${used} Schritt(e) haben dann keine Zuständigkeit.` : ""}`)))) return;
    const { error } = await sb.from("actors").delete().eq("id", id);
    if (error) return fail(error.message);
    setActors((p) => p.filter((x) => x.id !== id));
    setNodes((p) => p.map((n) => (n.actor_id === id ? { ...n, actor_id: null } : n)));
  }

  // ---------------------------------------------------------------- nodes --
  async function addNode(x: number, laneId: string, yOffset: number, label = ""): Promise<string | null> {
    if (!activeId) return null;
    record();
    const { data, error } = await sb
      .from("flow_nodes")
      .insert({ workflow_id: activeId, lane_id: laneId, type: "action", label, x, y_offset: yOffset })
      .select("*")
      .single();
    if (error || !data) {
      fail(error?.message ?? t("Could not add the step.", "Der Schritt konnte nicht hinzugefügt werden."));
      return null;
    }
    setNodes((p) => [...p, data as FlowNode]);
    return data.id as string;
  }

  function patchNode(id: string, patch: Partial<FlowNode>): string | null {
    if (patch.type === "start" && edges.some((e) => e.to_node_id === id))
      return t("A Start step can't have incoming connections. Remove them first.", "Ein Start-Schritt darf keine eingehenden Verbindungen haben. Entfernen Sie diese zuerst.");
    if (patch.type === "end" && edges.some((e) => e.from_node_id === id))
      return t("An End step can't have outgoing connections. Remove them first.", "Ein End-Schritt darf keine ausgehenden Verbindungen haben. Entfernen Sie diese zuerst.");
    record();
    setNodes((p) => p.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    sb.from("flow_nodes")
      .update(patch)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          fail(error.message);
          reload();
        }
      });
    return null;
  }

  function moveNode(id: string, x: number, laneId: string, yOffset: number) {
    patchNode(id, { x, lane_id: laneId, y_offset: yOffset });
  }

  async function deleteNodes(ids: string[]) {
    record();
    setNodes((p) => p.filter((n) => !ids.includes(n.id)));
    setEdges((p) => p.filter((e) => !ids.includes(e.from_node_id) && !ids.includes(e.to_node_id)));
    const { error } = await sb.from("flow_nodes").delete().in("id", ids);
    if (error) {
      fail(error.message);
      reload();
    }
  }

  // ---------------------------------------------------------------- edges --
  async function connect(from: string, to: string, sourceHandle: string | null, targetHandle: string | null): Promise<string | null> {
    if (!activeId) return null;
    record();
    const { data, error } = await sb
      .from("flow_edges")
      .insert({ workflow_id: activeId, from_node_id: from, to_node_id: to, source_handle: sourceHandle, target_handle: targetHandle })
      .select("*")
      .single();
    if (error || !data) {
      fail(error?.message ?? t("Could not connect those steps.", "Die Schritte konnten nicht verbunden werden."));
      return null;
    }
    setEdges((p) => [...p, data as FlowEdge]);
    return (data as FlowEdge).id;
  }

  async function patchEdge(id: string, patch: EdgePatch) {
    record();
    setEdges((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await sb.from("flow_edges").update(patch).eq("id", id);
    if (error) {
      fail(error.message);
      reload();
    }
  }

  async function deleteEdges(ids: string[]) {
    record();
    setEdges((p) => p.filter((e) => !ids.includes(e.id)));
    const { error } = await sb.from("flow_edges").delete().in("id", ids);
    if (error) {
      fail(error.message);
      reload();
    }
  }

  // ------------------------------------------------------------ roadmaps --
  const wfRoadmaps = useMemo(() => roadmaps.filter((r) => r.workflow_id === activeId).sort((a, b) => a.position - b.position), [roadmaps, activeId]);
  const wfPhases = useMemo(() => phases.filter((p) => p.workflow_id === activeId).sort((a, b) => a.position - b.position), [phases, activeId]);
  const wfPhaseNodes = useMemo(() => phaseNodes.filter((p) => p.workflow_id === activeId), [phaseNodes, activeId]);
  const phaseCounts = useMemo(() => {
    const c: Record<string, number> = {};
    wfPhaseNodes.forEach((pn) => (c[pn.phase_id] = (c[pn.phase_id] ?? 0) + 1));
    return c;
  }, [wfPhaseNodes]);

  async function addRoadmap(name: string, color?: string) {
    if (!activeId) return;
    const { data, error } = await sb
      .from("roadmaps")
      .insert({ workflow_id: activeId, name, color: color ?? pickColor(wfRoadmaps.length + 2), position: wfRoadmaps.length })
      .select("*")
      .single();
    if (error || !data) return fail(error?.message ?? t("Could not add the plan.", "Der Plan konnte nicht hinzugefügt werden."));
    setRoadmaps((p) => [...p, data as Roadmap]);
  }
  async function patchRoadmap(id: string, patch: Partial<Roadmap>) {
    setRoadmaps((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await sb.from("roadmaps").update(patch).eq("id", id);
    if (error) {
      fail(error.message);
      reload();
    }
  }
  async function deleteRoadmap(id: string) {
    const r = roadmaps.find((x) => x.id === id);
    if (!(await ask(t(`Delete the roadmap "${r?.name}" and its phases? Your steps stay.`, `Roadmap „${r?.name}“ und ihre Phasen löschen? Ihre Schritte bleiben.`)))) return;
    const gone = new Set(phases.filter((p) => p.roadmap_id === id).map((p) => p.id));
    setRoadmaps((p) => p.filter((x) => x.id !== id));
    setPhases((p) => p.filter((x) => x.roadmap_id !== id));
    setPhaseNodes((p) => p.filter((x) => !gone.has(x.phase_id)));
    if (lens && ((lens.kind === "roadmap" && lens.id === id) || (lens.kind === "phase" && gone.has(lens.id)))) {
      setLens(null);
      setSelecting(false);
    }
    const { error } = await sb.from("roadmaps").delete().eq("id", id);
    if (error) {
      fail(error.message);
      reload();
    }
  }
  async function addPhase(roadmapId: string, name: string, color?: string) {
    if (!activeId) return;
    const mine = phases.filter((p) => p.roadmap_id === roadmapId);
    const { data, error } = await sb
      .from("roadmap_phases")
      .insert({ roadmap_id: roadmapId, workflow_id: activeId, name, color: color ?? pickColor(mine.length + 5), position: mine.length })
      .select("*")
      .single();
    if (error || !data) return fail(error?.message ?? t("Could not add the phase.", "Die Phase konnte nicht hinzugefügt werden."));
    setPhases((p) => [...p, data as RoadmapPhase]);
  }
  async function patchPhase(id: string, patch: Partial<RoadmapPhase>) {
    setPhases((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await sb.from("roadmap_phases").update(patch).eq("id", id);
    if (error) {
      fail(error.message);
      reload();
    }
  }
  async function deletePhase(id: string) {
    const ph = phases.find((x) => x.id === id);
    if (!(await ask(t(`Delete the phase "${ph?.name}"? Your steps stay.`, `Phase „${ph?.name}“ löschen? Ihre Schritte bleiben.`)))) return;
    setPhases((p) => p.filter((x) => x.id !== id));
    setPhaseNodes((p) => p.filter((x) => x.phase_id !== id));
    if (lens?.kind === "phase" && lens.id === id) {
      setLens(null);
      setSelecting(false);
    }
    const { error } = await sb.from("roadmap_phases").delete().eq("id", id);
    if (error) {
      fail(error.message);
      reload();
    }
  }
  async function togglePhaseNode(phaseId: string, nodeId: string) {
    if (!activeId) return;
    const has = phaseNodes.some((x) => x.phase_id === phaseId && x.node_id === nodeId);
    if (has) {
      setPhaseNodes((p) => p.filter((x) => !(x.phase_id === phaseId && x.node_id === nodeId)));
      const { error } = await sb.from("phase_nodes").delete().eq("phase_id", phaseId).eq("node_id", nodeId);
      if (error) {
        fail(error.message);
        reload();
      }
    } else {
      setPhaseNodes((p) => [...p, { phase_id: phaseId, node_id: nodeId, workflow_id: activeId }]);
      const { error } = await sb.from("phase_nodes").insert({ phase_id: phaseId, node_id: nodeId, workflow_id: activeId });
      if (error) {
        fail(error.message);
        reload();
      }
    }
  }

  // The lens decides which steps stay bright; everything else is dimmed.
  const focus = useMemo<Focus | null>(() => {
    if (!lens) return null;
    const ids = new Set<string>();
    const badges = new Map<string, string[]>();
    let ring: string | null = null;
    if (lens.kind === "phase") {
      const ph = wfPhases.find((p) => p.id === lens.id);
      if (!ph) return null;
      ring = ph.color;
      wfPhaseNodes.filter((pn) => pn.phase_id === ph.id).forEach((pn) => ids.add(pn.node_id));
    } else if (lens.kind === "roadmap") {
      const mine = wfPhases.filter((p) => p.roadmap_id === lens.id);
      mine.forEach((ph) =>
        wfPhaseNodes
          .filter((pn) => pn.phase_id === ph.id)
          .forEach((pn) => {
            ids.add(pn.node_id);
            badges.set(pn.node_id, [...(badges.get(pn.node_id) ?? []), ph.color ?? "#64748b"]);
          })
      );
    } else if (lens.kind === "actor") {
      ring = actors.find((a) => a.id === lens.id)?.color ?? null;
      wfNodes.filter((n) => n.actor_id === lens.id).forEach((n) => ids.add(n.id));
    } else if (lens.kind === "lane") {
      ring = wfLanes.find((l) => l.id === lens.id)?.color ?? null;
      wfNodes.filter((n) => n.lane_id === lens.id).forEach((n) => ids.add(n.id));
    }
    return { ids, ring, badges, selecting: selecting && lens.kind === "phase" };
  }, [lens, selecting, wfPhases, wfPhaseNodes, actors, wfNodes, wfLanes]);

  const lensTitle = useMemo(() => {
    if (!lens) return "";
    if (lens.kind === "phase") {
      const ph = phases.find((p) => p.id === lens.id);
      const rm = roadmaps.find((r) => r.id === ph?.roadmap_id);
      return ph ? `${rm?.name ?? ""} › ${ph.name}` : "";
    }
    if (lens.kind === "roadmap") return roadmaps.find((r) => r.id === lens.id)?.name ?? "";
    if (lens.kind === "actor") return actors.find((a) => a.id === lens.id)?.name ?? "";
    return wfLanes.find((l) => l.id === lens.id)?.name ?? "";
  }, [lens, phases, roadmaps, actors, wfLanes]);

  async function signOut() {
    await sb.auth.signOut();
    window.location.assign("/");
  }

  return (
    <ContentI18nProvider texts={contentTexts}>
    {confirmDialog}
    <div className="h-screen flex flex-col">
      <div className="glass-chrome flex-none border-b border-white/10 h-[4.25rem] flex items-center gap-3 pl-5 pr-8 relative z-40">
        <span className="flex items-center gap-2 font-semibold tracking-[0.16em] text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/loom-mark.svg" alt="" width={42} height={42} className="rounded-xl" />
          <span>THE <span className="text-orange">LOOM</span></span>
        </span>
        <span className="text-muted/40">|</span>
        <WorkspaceSwitcher orgId={orgId} orgName={orgName} workspaces={workspaces} role={role} />
        <CtaBanner />
        <div className="ml-auto flex items-center gap-3">
          <MoreMenu onHelp={() => setGuideOpen(true)} />
          {peers.length > 1 && (
            <>
              <PresenceStack peers={peers} meId={profile.id} />
              <span className="w-px h-8 bg-white/15" aria-hidden />
            </>
          )}
          <AccountMenu profile={profile} onAccount={() => setAccountOpen(true)} onTeam={() => setTeamOpen(true)} onGuide={() => setGuideOpen(true)} onSignOut={signOut} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        <LeftNav
          workflows={workflows}
          activeWorkflowId={activeId}
          lanes={wfLanes}
          actors={actors}
          members={members}
          onHelp={(term) => { setGuideStart(term); setGuideOpen(true); }}
          memberHint={t(`${memberCount} member(s) in this workspace.`, `${memberCount} Mitglied(er) in diesem Workspace.`)}
          onSelectWorkflow={select}
          onCreateWorkflow={createWorkflow}
          onPatchWorkflow={patchWorkflow}
          onDeleteWorkflow={deleteWorkflow}
          onDuplicateWorkflow={duplicateWorkflow}
          onAddLane={addLane}
          onPatchLane={patchLane}
          onMoveLane={moveLane}
          onDeleteLane={deleteLane}
          onDuplicateLane={duplicateLane}
          onAddActor={addActor}
          onPatchActor={patchActor}
          onDeleteActor={deleteActor}
          onOpenTeam={() => setTeamOpen(true)}
          roadmaps={wfRoadmaps}
          phases={wfPhases}
          phaseCounts={phaseCounts}
          lens={lens}
          onLens={(l) => {
            setLens(l);
            if (!l || l.kind !== "phase") setSelecting(false);
          }}
          onAddRoadmap={addRoadmap}
          onPatchRoadmap={patchRoadmap}
          onDeleteRoadmap={deleteRoadmap}
          onAddPhase={addPhase}
          onPatchPhase={patchPhase}
          onDeletePhase={deletePhase}
        />

        <main className="flex-1 min-w-0 relative">
          {active ? (
            <WorkflowCanvas
              key={active.id}
              processName={active.name}
              lanes={wfLanes}
              nodes={wfNodes}
              edges={wfEdges}
              actors={actors}
              onAddNode={addNode}
              onMoveNode={moveNode}
              onPatchNode={patchNode}
              onDeleteNodes={deleteNodes}
              onConnect={connect}
              onPatchEdge={patchEdge}
              canUndo={histCount.u > 0}
              canRedo={histCount.r > 0}
              onUndo={undo}
              onRedo={redo}
              onNotice={fail}
              onDeleteEdges={deleteEdges}
              focus={focus}
              onFocusToggle={(nodeId) => lens?.kind === "phase" && togglePhaseNode(lens.id, nodeId)}
              commentCounts={commentCounts}
              onOpenComments={setCommentNodeId}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <form
                className="glass rounded-3xl w-full max-w-md p-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (firstName.trim()) createWorkflow(firstName.trim());
                }}
              >
                <div className="font-mono text-[0.7rem] tracking-[0.14em] text-orange mb-2">{t("LET'S BEGIN", "LOS GEHT'S")}</div>
                <h1 className="text-xl mb-2">{t("What process do you want to map?", "Welchen Prozess möchten Sie abbilden?")}</h1>
                <p className="text-[0.9rem] text-muted mb-5">
                  {t(
                    "Pick one process that matters, such as “Customer order to delivery” or “Hiring a new employee”. You'll add the steps, who owns each one, and how they connect.",
                    "Wählen Sie einen wichtigen Prozess, etwa „Kundenauftrag bis Lieferung“ oder „Neue Mitarbeiter einstellen“. Sie fügen Schritte, Zuständigkeiten und Verbindungen hinzu."
                  )}
                </p>
                <input
                  autoFocus
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("Name your process…", "Prozess benennen…")}
                  className="w-full bg-black/30 border border-white/10 rounded-xl text-[0.95rem] px-3.5 py-3 outline-none focus:border-orange/50"
                />
                <button
                  className="mt-4 w-full rounded-full text-[#1a0f05] text-[0.8rem] font-mono font-semibold tracking-wider py-3 shadow-[0_6px_24px_rgba(248,153,29,.35)]"
                  style={{ background: "linear-gradient(135deg, #f8991d, #e0771a)" }}
                >
                  {t("CREATE WORKFLOW", "ABLAUF ERSTELLEN")}
                </button>
              </form>
            </div>
          )}

          {lens && focus && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 glass glass-bright rounded-full pl-4 pr-2 py-1.5 flex items-center gap-3 text-[0.78rem]">
              <span className="relative flex-none">
                <button
                  onClick={() => setDotOpen((o) => !o)}
                  title={t("Change color", "Farbe ändern")}
                  aria-label={t("Change color", "Farbe ändern")}
                  className="block w-3.5 h-3.5 rounded-full border border-white/40 hover:scale-110 transition-transform"
                  style={{ background: focus.ring ?? "#f8991d" }}
                />
                {dotOpen && (
                  <div className="absolute left-0 top-6 z-50 glass glass-bright glass-dense rounded-2xl p-2 flex gap-1">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        aria-label={c}
                        onClick={() => {
                          if (lens.kind === "phase") patchPhase(lens.id, { color: c });
                          else if (lens.kind === "roadmap") patchRoadmap(lens.id, { color: c });
                          else if (lens.kind === "actor") patchActor(lens.id, { color: c });
                          else patchLane(lens.id, { color: c });
                          setDotOpen(false);
                        }}
                        className="w-[18px] h-[18px] rounded-full border-2 hover:scale-110 transition-transform"
                        style={{ background: c, borderColor: focus.ring === c ? "#fff" : "transparent" }}
                      />
                    ))}
                  </div>
                )}
              </span>
              <span className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-muted/70">
                {lens.kind === "phase"
                  ? t("Phase", "Phase")
                  : lens.kind === "roadmap"
                    ? t("Plan", "Plan")
                    : lens.kind === "actor"
                      ? t("Role", "Rolle")
                      : t("Lane", "Bahn")}
              </span>
              <span className="max-w-[260px] truncate font-medium">
                <Tx text={lensTitle} />
              </span>
              <span className="text-muted">
                {focus.ids.size} {t("steps", "Schritte")}
              </span>
              {lens.kind === "phase" && (
                <button
                  onClick={() => setSelecting((x) => !x)}
                  className={`rounded-full px-3 py-1 font-mono text-[0.62rem] tracking-[0.08em] uppercase border ${
                    selecting ? "bg-orange text-black border-orange" : "border-white/20 text-text hover:border-orange/60"
                  }`}
                >
                  {selecting ? t("Done", "Fertig") : t("Select steps", "Schritte wählen")}
                </button>
              )}
              <button
                onClick={() => {
                  setLens(null);
                  setSelecting(false);
                }}
                className="w-6 h-6 rounded-full text-muted hover:text-text hover:bg-white/10"
                aria-label={t("Clear focus", "Fokus beenden")}
              >
                ✕
              </button>
            </div>
          )}
          {lens?.kind === "phase" && selecting && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 text-[0.74rem] text-muted pointer-events-none">
              {t("Click steps to add or remove them from this phase.", "Klicken Sie auf Schritte, um sie dieser Phase hinzuzufügen oder zu entfernen.")}
            </div>
          )}

          {toast && (
            <div
              role="status"
              aria-live="polite"
              className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2.5 text-[0.72rem] font-light tracking-wide glass rounded-full px-3.5 py-1.5 ${toast.kind === "error" ? "text-red-200/90 !border-red-400/30" : "text-text/75 !border-white/10"}`}
            >
              {toast.msg}
              <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
        </main>
      </div>

      {guideOffer && !guideOpen && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-white/15 p-4 shadow-2xl" style={{ background: "var(--tint-solid)" }}>
          <div className="text-sm font-medium mb-1">{t("New to Loom?", "Neu bei Loom?")}</div>
          <p className="text-[0.88rem] text-muted font-normal mb-3">
            {t("Want a quick tour of how it works? It takes about a minute.", "Möchten Sie eine kurze Einführung, wie Loom funktioniert? Das dauert etwa eine Minute.")}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setGuideOffer(false);
                setGuideOpen(true);
              }}
              className="flex-1 rounded-full text-white text-xs font-mono tracking-wider py-2"
              style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
            >
              {t("SHOW ME", "ZEIGEN")}
            </button>
            <button
              onClick={() => {
                markGuideSeen();
                setGuideOffer(false);
              }}
              className="flex-1 rounded-full border border-white/15 text-xs font-mono tracking-wider py-2"
            >
              {t("NOT NOW", "SPÄTER")}
            </button>
          </div>
          <p className="text-[0.78rem] text-muted font-normal mt-2">{t("You can always find it under Help.", "Sie finden es jederzeit unter Hilfe.")}</p>
        </div>
      )}
      {commentNode && (
        <CommentCard
          title={commentNode.label}
          comments={comments.filter((c) => c.node_id === commentNode.id)}
          meId={profile.id}
          canModerate={role === "owner" || role === "admin"}
          onAdd={addComment}
          onDelete={deleteComment}
          onClose={() => setCommentNodeId(null)}
        />
      )}
      {guideOpen && <Guide start={guideStart} onClose={() => { setGuideOpen(false); setGuideStart(undefined); }} />}
      {accountOpen && <AccountModal profile={profile} onClose={() => setAccountOpen(false)} onSaved={setProfile} />}
      {teamOpen && <TeamPanel orgId={orgId} orgName={orgName} role={role} onClose={() => setTeamOpen(false)} />}
    </div>
    </ContentI18nProvider>
  );
}
