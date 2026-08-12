"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeRow, ThreadRow } from "@/lib/types";
import { techColor, type Technique } from "@/lib/techniques";
import { ThreadRail, type ThreadSummary } from "@/components/thread-rail";
import { ThreadCanvas } from "@/components/thread-canvas";
import { createClient } from "@/lib/supabase/client";
import { ROOT_ID, pathTo, layoutThread } from "@/lib/layout";

function buildPullPrompt(thread: ThreadRow, source: NodeRow | null, question: string) {
  const ctx = thread.context ? `Context: ${thread.context}` : "No additional context was given.";
  if (!source) {
    return `${ctx}\n\nWorking question: ${question}\n\nThis is a fresh pull directly from the working question, no prior line of inquiry to build on yet. Produce 2 to 3 provocations that open new lines of inquiry.`;
  }
  return `${ctx}\n\nWorking question: ${question}\n\nCurrent line of inquiry (technique: ${source.tech}): ${source.items.join(" ")}\n\nProduce 2 to 3 new provocations that push this specific line of inquiry further.`;
}

function parsePullResponse(text: string): string[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) return parsed;
  } catch {
    // fall through
  }
  return [cleaned];
}

function buildTracePrompt(thread: ThreadRow, chain: NodeRow[], question: string) {
  const ctx = thread.context ? `Context: ${thread.context}` : "No additional context was given.";
  const steps = chain.map((n, i) => `${i + 1}. [${n.tech}] ${n.items.join(" ")}`).join("\n");
  return `${ctx}\n\nWorking question: ${question}\n\nLine of inquiry so far, in order from the start:\n${steps}\n\nFor each numbered step above, in the same order, name one thing that could have been pulled or considered instead at that exact step. Then write one short summary of the arc of this line of inquiry so far.`;
}

function parseTraceResponse(text: string): { steps: string[]; summary: string } | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (
      parsed &&
      Array.isArray(parsed.steps) &&
      parsed.steps.every((x: unknown) => typeof x === "string") &&
      typeof parsed.summary === "string"
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return null;
}

type Candidate = { id: string; text: string; tech: string };
const CREATIVE_ROUNDS = 3;

// Preview only, rendered inline in the thread rail — the actual composer
// (task #26) picks one of these before naming a thread. A new starting
// point always means a brand new thread; existing threads are untouched
// and stay browsable in the rail above.
const STARTING_POINTS = [
  { key: "prevent-recurrence", label: "Prevent recurrence", glyph: "⛒", blurb: "Something broke. Make sure it never happens again." },
  { key: "innovate-new", label: "Innovate for new", glyph: "✦", blurb: "Generate genuinely new value, not a fix." },
  { key: "business-model", label: "New business", glyph: "▦", blurb: "One thread per Business Model Canvas cell." },
  { key: "respond-threat", label: "Respond to a threat", glyph: "⚠", blurb: "A competitor or disruption is already moving." },
  { key: "exploit-signal", label: "Exploit a signal", glyph: "↗", blurb: "Something's shifting before it becomes a threat to someone else." },
  { key: "constraint-removal", label: "Constraint removal", glyph: "◌", blurb: "What if this limit simply didn't exist." },
  { key: "decision-fork", label: "Decision fork", glyph: "⑂", blurb: "Pressure-test two or three real paths, not generate new ones." },
  { key: "mandate", label: "Mandate-triggered", glyph: "▣", blurb: "A directive, complaint, or requirement handed you the start." },
] as const;

function CreativeCandidateCard({
  candidate,
  onKeep,
  onDiscard,
  onEdit,
}: {
  candidate: Candidate;
  onKeep: () => void;
  onDiscard: () => void;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(candidate.text);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[.04] p-3">
      <span className="block font-mono text-[0.44rem] tracking-[0.1em] text-cyan mb-1.5 uppercase">
        {candidate.tech}
      </span>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full bg-black/30 border border-white/10 rounded-lg text-text text-[0.78rem] font-light p-2 outline-none focus:border-cyan/50"
        />
      ) : (
        <p className="text-[0.79rem] font-light text-[#dbe7f2] leading-snug">{candidate.text}</p>
      )}
      <div className="flex items-center gap-1.5 mt-2.5">
        {editing ? (
          <button
            onClick={() => {
              onEdit(draft);
              setEditing(false);
            }}
            className="font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border border-cyan/40 text-cyan bg-cyan/[.08] hover:bg-cyan/[.16]"
          >
            Save
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border border-white/15 text-muted hover:text-text hover:border-white/30"
          >
            Edit
          </button>
        )}
        <button
          onClick={onKeep}
          className="font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border border-orange/40 text-orange bg-orange/[.08] hover:bg-orange/[.16]"
        >
          Keep
        </button>
        <button
          onClick={onDiscard}
          className="font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border border-white/15 text-muted hover:text-red-300 hover:border-red-300/40 ml-auto"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

export function ThreadWorkspace({
  orgId,
  orgName,
  buildSha,
  threads,
  nodesByThread,
}: {
  orgId: string;
  orgName: string;
  buildSha: string;
  threads: ThreadRow[];
  nodesByThread: Record<string, NodeRow[]>;
}) {
  const [activeId, setActiveId] = useState<string | null>(threads[0]?.id ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodesState, setNodesState] = useState<Record<string, NodeRow[]>>(nodesByThread);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [pullingId, setPullingId] = useState<string | null>(null);

  // The technique library that powers both the pull picker (server-side)
  // and the hover suggestion icon (client-side, free heuristic). Fetched
  // once per org — RLS scopes it to members automatically.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("library_techniques")
      .select("id, key, plain, exec, exemplars, antipatterns, stats")
      .eq("org_id", orgId)
      .then(({ data }) => {
        if (!cancelled) setTechniques((data ?? []) as unknown as Technique[]);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);
  const [pullError, setPullError] = useState<string | null>(null);
  const [trace, setTrace] = useState<{
    nodeId: string;
    chain: NodeRow[];
    steps: string[];
    summary: string;
  } | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [creativeOpen, setCreativeOpen] = useState(false);
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [creativeError, setCreativeError] = useState<string | null>(null);
  const [creativeSourceId, setCreativeSourceId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [railPinned, setRailPinned] = useState(false);
  const [railHover, setRailHover] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(false);
  const [inspectorHover, setInspectorHover] = useState(false);
  const railExpanded = railPinned || railHover;
  const inspectorExpanded = inspectorPinned || inspectorHover;
  const [tidyLoading, setTidyLoading] = useState(false);
  const [tidyMessage, setTidyMessage] = useState<string | null>(null);
  const [tidyError, setTidyError] = useState<string | null>(null);
  const [tidyFitSignal, setTidyFitSignal] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const [addKnotOpen, setAddKnotOpen] = useState(false);
  const [addKnotSourceId, setAddKnotSourceId] = useState<string | null>(null);
  const [addKnotText, setAddKnotText] = useState("");
  const [addKnotSaving, setAddKnotSaving] = useState(false);
  const [addKnotError, setAddKnotError] = useState<string | null>(null);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<string[]>([]);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const activeNodes = activeId ? nodesState[activeId] ?? [] : [];
  const selectedNode = activeNodes.find((n) => n.id === selectedNodeId) ?? null;
  const detailNode = detailNodeId ? activeNodes.find((n) => n.id === detailNodeId) ?? null : null;

  const rail: ThreadSummary[] = useMemo(
    () =>
      threads.map((t) => ({
        id: t.id,
        name: t.name,
        state: t.state,
        nodeCount: (nodesState[t.id] ?? []).length,
        question: t.questions[t.questions.length - 1] ?? "",
        context: t.context ?? "",
      })),
    [threads, nodesState]
  );

  function selectThread(id: string) {
    setActiveId(id);
    setSelectedNodeId(null);
    setPullError(null);
    setTrace(null);
    setTraceError(null);
    setCreativeOpen(false);
    setCreativeError(null);
    setCandidates([]);
    setCreativeSourceId(null);
  }

  function selectNode(id: string | null) {
    setSelectedNodeId(id);
    if (id) setInspectorPinned(true);
  }

  // The canvas persists a drag straight to Supabase itself, but this is
  // what keeps nodesState — the source of truth every full canvas rebuild
  // reads from — in sync with it. Without this, the next pull, add-knot, or
  // tidy silently snaps the dragged knot back to its last-known state.
  function handleNodeMoved(id: string, x: number, y: number) {
    if (!active) return;
    setNodesState((cur) => ({
      ...cur,
      [active.id]: (cur[active.id] ?? []).map((n) =>
        n.id === id ? { ...n, position_x: x, position_y: y } : n
      ),
    }));
  }

  // Recomputes the same depth/row auto-layout the canvas falls back to for
  // brand-new knots, then overwrites every knot's saved position with it —
  // this is what clears manual drag placements and untangles overlap on
  // request, rather than trying to reason about it from a screenshot.
  async function handleTidy() {
    console.log("[Tidy] click received", { active: active?.id, nodeCount: activeNodes.length });
    if (!active || activeNodes.length === 0) {
      console.log("[Tidy] bailed early — no active thread or no nodes");
      return;
    }
    setTidyLoading(true);
    setTidyError(null);
    setTidyMessage(null);
    try {
      const layout = layoutThread(activeNodes);
      console.log("[Tidy] computed layout", layout);
      const supabase = createClient();
      let moved = 0;
      const results = await Promise.all(
        activeNodes.map((n) => {
          const pos = layout[n.id];
          if (!pos) return null;
          if (pos.x !== n.position_x || pos.y !== n.position_y) moved++;
          return supabase
            .from("nodes")
            .update({ position_x: pos.x, position_y: pos.y })
            .eq("id", n.id);
        })
      );
      console.log("[Tidy] write results", results);
      const failed = results.find((r) => r && r.error);
      if (failed?.error) throw new Error(failed.error.message);

      setNodesState((cur) => ({
        ...cur,
        [active.id]: activeNodes.map((n) => {
          const pos = layout[n.id];
          return pos ? { ...n, position_x: pos.x, position_y: pos.y } : n;
        }),
      }));
      // Re-fit even when nothing moved — otherwise a board that was
      // already tidy gives zero visible feedback and looks broken.
      setTidyFitSignal((s) => s + 1);
      setTidyMessage(moved > 0 ? `Rearranged ${moved} knot${moved === 1 ? "" : "s"}.` : "Already tidy.");
      console.log("[Tidy] success, moved:", moved);
    } catch (e) {
      console.error("[Tidy] failed:", e);
      setTidyError(e instanceof Error ? e.message : "Could not tidy the board.");
    } finally {
      setTidyLoading(false);
      window.setTimeout(() => setTidyMessage(null), 2600);
    }
  }

  // Full content view + inline edit for a knot, opened either by clicking
  // through a long hover-zoom dwell or (soon) directly. Persists edits back
  // to Supabase and mirrors them into nodesState.
  function openDetail(id: string) {
    const n = activeNodes.find((x) => x.id === id);
    if (!n) return;
    setDetailNodeId(id);
    setDetailDraft(n.items);
    setDetailError(null);
  }

  function updateDetailItem(i: number, text: string) {
    setDetailDraft((cur) => cur.map((t, idx) => (idx === i ? text : t)));
  }

  async function saveDetail() {
    if (!active || !detailNodeId) return;
    setDetailSaving(true);
    setDetailError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("nodes")
        .update({ items: detailDraft })
        .eq("id", detailNodeId);
      if (error) throw new Error(error.message);

      setNodesState((cur) => ({
        ...cur,
        [active.id]: (cur[active.id] ?? []).map((n) =>
          n.id === detailNodeId ? { ...n, items: detailDraft } : n
        ),
      }));
      setDetailNodeId(null);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setDetailSaving(false);
    }
  }

  // Manual, technique-free knot: the user supplies the content directly,
  // no model call. Functions as a fresh starting point on the same canvas —
  // this is what "split into N threads for evaluation" turned out to mean
  // once we cut the scope down: not a new thread row, just a new place to
  // pull from.
  function openAddKnot(sourceId: string | null) {
    setAddKnotSourceId(sourceId);
    setAddKnotText("");
    setAddKnotError(null);
    setAddKnotOpen(true);
  }

  async function submitAddKnot() {
    if (!active) return;
    const text = addKnotText.trim();
    if (!text) {
      setAddKnotError("Give this knot some words first.");
      return;
    }
    setAddKnotSaving(true);
    setAddKnotError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: newNode, error } = await supabase
        .from("nodes")
        .insert({
          thread_id: active.id,
          parent_id: addKnotSourceId,
          tech: "note",
          base: "note",
          items: [text],
          pulled: [],
          state: "kept",
          by: user?.id ?? null,
        })
        .select(
          "id, thread_id, parent_id, tech, base, items, pulled, state, ready, cond, folded, by, by_label, position_x, position_y, created_at"
        )
        .single();

      if (error || !newNode) throw new Error(error?.message ?? "Could not save that knot.");

      setNodesState((cur) => ({
        ...cur,
        [active.id]: [...(cur[active.id] ?? []), newNode as unknown as NodeRow],
      }));
      setSelectedNodeId(newNode.id);
      setInspectorPinned(true);
      setAddKnotOpen(false);
    } catch (e) {
      setAddKnotError(e instanceof Error ? e.message : "Could not save that knot.");
    } finally {
      setAddKnotSaving(false);
    }
  }

  async function bumpTechniqueStat(techKey: string, field: "kept" | "dropped") {
    const t = techniques.find((x) => x.key === techKey);
    if (!t) return;
    const next = { ...t.stats, [field]: t.stats[field] + 1 };
    await createClient().from("library_techniques").update({ stats: next }).eq("id", t.id);
    setTechniques((cur) => cur.map((x) => (x.id === t.id ? { ...x, stats: next } : x)));
  }

  const question = active ? active.questions[active.questions.length - 1] ?? active.name : "";

  // One unified strip: brand + org + build tag on the left, the working
  // question inline to the right of that (not a separate row), thread
  // controls and the always-there upload/library placeholders on the far
  // right. Shared between the "no threads yet" state and the normal view
  // so branding is never missing.
  const topBar = (
    <div className="glass-chrome flex-none border-b border-white/10 h-14 flex items-center gap-3 px-5 relative">
      <span className="font-semibold tracking-[0.16em] text-xs flex-none">
        THE <span className="text-orange">LOOM</span>
      </span>
      <span className="text-muted text-xs font-light flex-none">{orgName}</span>
      <span
        className="font-mono text-[0.55rem] tracking-[0.08em] text-muted/50 flex-none"
        title="Deployed commit — compare against your latest git push"
      >
        build {buildSha}
      </span>

      {active && (
        <>
          <span className="w-px h-5 bg-white/10 flex-none" />
          <div className="min-w-0 flex-1 flex items-baseline gap-2">
            <span className="font-mono text-[0.55rem] tracking-[0.12em] text-orange flex-none">
              V{active.questions.length}
              {active.state !== "live" ? ` · ${active.state.toUpperCase()}` : ""}
            </span>
            <span className="text-[0.95rem] font-light text-text truncate">{question}</span>
          </div>
        </>
      )}

      <div className={`flex-none flex items-center gap-1.5 relative ${active ? "" : "ml-auto"}`}>
        {active && selectedNodeId && (
          <button
            onClick={() => selectNode(null)}
            title="Clear focus and show every knot at full brightness"
            className="inline-flex items-center gap-1.5 font-mono text-[0.48rem] tracking-[0.12em] uppercase px-2.5 py-1.5 rounded-full border border-white/15 text-muted hover:text-text hover:border-white/30 transition-colors"
          >
            ☀ Light up all
          </button>
        )}
        {active && (
          <button
            onClick={() => setLegendOpen((o) => !o)}
            title="What each knot color means"
            className={`inline-flex items-center gap-1.5 font-mono text-[0.48rem] tracking-[0.12em] uppercase px-2.5 py-1.5 rounded-full border transition-colors ${
              legendOpen
                ? "border-orange/50 text-orange bg-orange/10"
                : "border-white/15 text-muted hover:text-text hover:border-white/30"
            }`}
          >
            ◆ Legend
          </button>
        )}

        {active && (tidyMessage || tidyError) && (
          <div
            className={`absolute right-24 top-full mt-2 whitespace-nowrap font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1.5 rounded-full border ${
              tidyError
                ? "border-red-500/30 text-red-300 bg-red-500/10"
                : "border-white/15 text-muted bg-black/40"
            }`}
          >
            {tidyError ?? tidyMessage}
          </div>
        )}

        {active && legendOpen && (
          <div className="absolute right-24 top-full mt-2 w-64 glass-readable border border-white/10 rounded-xl p-3 z-40 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[0.5rem] tracking-[0.14em] text-orange uppercase">
                Knot colors
              </span>
              <button
                onClick={() => setLegendOpen(false)}
                className="text-muted hover:text-text text-xs leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-[0.62rem] font-light text-muted italic leading-relaxed mb-2">
              Left edge of each knot shows which technique pulled it.
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {techniques.map((t) => (
                <div key={t.id} className="flex items-center gap-2" title={t.plain}>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-none"
                    style={{ background: techColor(t.key) }}
                  />
                  <span className="text-[0.72rem] font-light text-[#dbe7f2] truncate">{t.key}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1.5 mt-1.5 border-t border-white/10">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ background: techColor("note") }}
                />
                <span className="text-[0.72rem] font-light text-[#dbe7f2]">
                  note — manual knot, no technique
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="group relative">
          <button
            disabled
            className="flex items-center gap-1.5 font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1.5 rounded-full border border-white/10 text-muted/70 cursor-not-allowed"
          >
            ⇪ Upload context
          </button>
          <div className="pointer-events-none absolute right-0 top-8 w-56 rounded-xl border border-white/10 bg-[#0d1420]/95 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-20">
            <span className="block font-mono text-[0.42rem] tracking-[0.1em] text-orange uppercase mb-1">
              Soon
            </span>
            <span className="text-[0.68rem] font-light text-[#dbe7f2] leading-snug">
              Upload org documents to prime every pull with real context.
            </span>
          </div>
        </div>

        <div className="group relative">
          <button
            disabled
            className="flex items-center gap-1.5 font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1.5 rounded-full border border-white/10 text-muted/70 cursor-not-allowed"
          >
            ◈ Library
          </button>
          <div className="pointer-events-none absolute right-0 top-8 w-56 rounded-xl border border-white/10 bg-[#0d1420]/95 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-20">
            <span className="block font-mono text-[0.42rem] tracking-[0.1em] text-orange uppercase mb-1">
              Soon
            </span>
            <span className="text-[0.68rem] font-light text-[#dbe7f2] leading-snug">
              Browse and customize the shared technique knowledge base.
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (!active) {
    return (
      <div className="h-screen flex flex-col">
        {topBar}
        <div className="p-8 text-muted text-sm font-light">
          No threads yet. Start one and this canvas fills in.
        </div>
      </div>
    );
  }

  const openLoose = selectedNode ? selectedNode.items.length - selectedNode.pulled.length : 0;

  async function handlePull(sourceId: string | null) {
    if (!active) return;
    setPullError(null);
    setPullingId(sourceId ?? ROOT_ID);

    try {
      const source = sourceId ? activeNodes.find((n) => n.id === sourceId) ?? null : null;
      const prompt = buildPullPrompt(active, source, question);
      const usedTechniques = sourceId
        ? [...pathTo(activeNodes, sourceId)]
            .map((id) => activeNodes.find((n) => n.id === id)?.tech)
            .filter((t): t is string => !!t)
        : [];

      const res = await fetch("/api/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId, prompt, usedTechniques }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Pull failed.");

      const items = parsePullResponse(json.text as string);
      const tech = json.technique?.key ?? "pull";
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: newNode, error } = await supabase
        .from("nodes")
        .insert({
          thread_id: active.id,
          parent_id: sourceId,
          tech,
          base: tech,
          items,
          pulled: [],
          state: "prov",
          by: user?.id ?? null,
        })
        .select(
          "id, thread_id, parent_id, tech, base, items, pulled, state, ready, cond, folded, by, by_label, position_x, position_y, created_at"
        )
        .single();

      if (error || !newNode) throw new Error(error?.message ?? "Could not save the pull.");

      setNodesState((cur) => ({
        ...cur,
        [active.id]: [...(cur[active.id] ?? []), newNode as unknown as NodeRow],
      }));
      setSelectedNodeId(newNode.id);
    } catch (e) {
      setPullError(e instanceof Error ? e.message : "Pull failed.");
    } finally {
      setPullingId(null);
    }
  }

  async function handleTraceBack() {
    if (!active || !selectedNode) return;
    setTraceError(null);
    setTraceLoading(true);

    try {
      const chain = [...pathTo(activeNodes, selectedNode.id)]
        .reverse()
        .map((id) => activeNodes.find((n) => n.id === id))
        .filter((n): n is NodeRow => !!n);

      const prompt = buildTracePrompt(active, chain, question);
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId, prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Trace back failed.");

      const parsed = parseTraceResponse(json.text as string);
      if (!parsed) throw new Error("Could not read the retrospective.");

      setTrace({ nodeId: selectedNode.id, chain, steps: parsed.steps, summary: parsed.summary });
    } catch (e) {
      setTraceError(e instanceof Error ? e.message : "Trace back failed.");
    } finally {
      setTraceLoading(false);
    }
  }

  async function handleCreative(sourceId: string) {
    if (!active) return;
    setCreativeError(null);
    setCreativeLoading(true);
    setCreativeSourceId(sourceId);
    setCandidates([]);

    try {
      const source = activeNodes.find((n) => n.id === sourceId) ?? null;
      const prompt = buildPullPrompt(active, source, question);
      const usedSoFar = [...pathTo(activeNodes, sourceId)]
        .map((id) => activeNodes.find((n) => n.id === id)?.tech)
        .filter((t): t is string => !!t);

      const collected: Candidate[] = [];

      for (let i = 0; i < CREATIVE_ROUNDS; i++) {
        const res = await fetch("/api/pull", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orgId, prompt, usedTechniques: usedSoFar }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (collected.length === 0) throw new Error(json.error ?? "Creative batch failed.");
          break;
        }
        const items = parsePullResponse(json.text as string);
        const tech = json.technique?.key ?? "pull";
        usedSoFar.push(tech);
        for (const text of items) collected.push({ id: crypto.randomUUID(), text, tech });
      }

      setCandidates(collected);
    } catch (e) {
      setCreativeError(e instanceof Error ? e.message : "Creative batch failed.");
    } finally {
      setCreativeLoading(false);
    }
  }

  async function keepCandidate(candidate: Candidate) {
    if (!active || !creativeSourceId) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: newNode, error } = await supabase
      .from("nodes")
      .insert({
        thread_id: active.id,
        parent_id: creativeSourceId,
        tech: candidate.tech,
        base: candidate.tech,
        items: [candidate.text],
        pulled: [],
        state: "prov",
        by: user?.id ?? null,
      })
      .select(
        "id, thread_id, parent_id, tech, base, items, pulled, state, ready, cond, folded, by, by_label, position_x, position_y, created_at"
      )
      .single();

    if (error || !newNode) {
      setCreativeError(error?.message ?? "Could not keep that candidate.");
      return;
    }

    setNodesState((cur) => ({
      ...cur,
      [active.id]: [...(cur[active.id] ?? []), newNode as unknown as NodeRow],
    }));
    setCandidates((cur) => cur.filter((c) => c.id !== candidate.id));
    void bumpTechniqueStat(candidate.tech, "kept");
  }

  function discardCandidate(candidate: Candidate) {
    setCandidates((cur) => cur.filter((c) => c.id !== candidate.id));
    void bumpTechniqueStat(candidate.tech, "dropped");
  }

  function editCandidate(id: string, text: string) {
    setCandidates((cur) => cur.map((c) => (c.id === id ? { ...c, text } : c)));
  }

  return (
    <div className="h-screen flex flex-col">
      {topBar}

      <div className="flex flex-1 min-h-0 relative">
      <aside
        onMouseEnter={() => setRailHover(true)}
        onMouseLeave={() => setRailHover(false)}
        className={`glass-chrome absolute inset-y-0 left-0 z-30 border-r border-white/10 overflow-hidden transition-[width] duration-200 ease-out shadow-2xl ${
          railExpanded ? "w-56 px-2" : "w-14"
        }`}
      >
        {railExpanded ? (
          <div onClick={() => setRailPinned(true)} className="h-full flex flex-col">
            <div className="flex justify-end pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRailPinned((p) => !p);
                }}
                className={`font-mono text-[0.42rem] tracking-[0.1em] uppercase px-2 py-1 rounded-full border ${
                  railPinned
                    ? "border-orange/50 text-orange bg-orange/10"
                    : "border-white/15 text-muted hover:text-text"
                }`}
              >
                {railPinned ? "Pinned" : "Pin"}
              </button>
            </div>
            <ThreadRail threads={rail} activeId={activeId} onSelect={selectThread} />
            <div className="mt-2 pb-4 pt-3 border-t border-white/10">
              <div className="font-mono text-[0.42rem] tracking-[0.14em] text-orange uppercase mb-2 px-1">
                New thread · starting point
              </div>
              <div className="space-y-1">
                {STARTING_POINTS.map((sp) => (
                  <div
                    key={sp.key}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 opacity-55 cursor-not-allowed"
                    title={sp.blurb}
                  >
                    <span className="w-4 h-4 rounded border border-white/15 bg-white/[.05] grid place-items-center text-[0.5rem] text-[#cfe2f6] flex-none">
                      {sp.glyph}
                    </span>
                    <span className="text-[0.66rem] font-light text-text truncate">{sp.label}</span>
                    <span className="ml-auto font-mono text-[0.36rem] tracking-[0.08em] text-orange/70 uppercase flex-none">
                      Soon
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setRailPinned(true)}
            className="w-full h-full flex flex-col items-center pt-3 gap-3"
            title="Threads"
          >
            <span className="text-orange text-xs">≡</span>
            {rail.map((t) => (
              <span
                key={t.id}
                className={`w-1.5 h-1.5 rounded-full flex-none ${
                  t.id === activeId ? "bg-orange" : "bg-white/20"
                }`}
              />
            ))}
          </button>
        )}
      </aside>

      <main className="flex-1 min-w-0 flex flex-col relative ml-14 mr-14">
        {pullError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 text-[0.7rem] font-mono text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1 shadow-lg">
            {pullError}
            <button onClick={() => setPullError(null)} className="text-red-200/70 hover:text-red-100">
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <ThreadCanvas
            nodes={activeNodes}
            question={question}
            questionVersion={active.questions.length}
            selectedId={selectedNodeId}
            onSelect={selectNode}
            onPull={handlePull}
            pullingId={pullingId}
            techniques={techniques}
            onAddKnot={openAddKnot}
            onOpenDetail={openDetail}
            fitSignal={tidyFitSignal}
            onTidy={handleTidy}
            tidyLoading={tidyLoading}
            onNodeMoved={handleNodeMoved}
          />
        </div>
      </main>

      <aside
        onMouseEnter={() => setInspectorHover(true)}
        onMouseLeave={() => setInspectorHover(false)}
        className={`glass-readable absolute inset-y-0 right-0 z-30 border-l border-white/10 overflow-hidden transition-[width] duration-200 ease-out shadow-2xl ${
          inspectorExpanded ? "w-80" : "w-14"
        }`}
      >
        {!inspectorExpanded && (
          <button
            onClick={() => setInspectorPinned(true)}
            className="w-full h-full flex items-center justify-center"
            title="Details"
          >
            <span className="text-muted text-sm">◈</span>
          </button>
        )}
        {inspectorExpanded && (
          <div onClick={() => setInspectorPinned(true)} className="p-4 h-full overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInspectorPinned((p) => !p);
                }}
                className={`font-mono text-[0.42rem] tracking-[0.1em] uppercase px-2 py-1 rounded-full border ${
                  inspectorPinned
                    ? "border-orange/50 text-orange bg-orange/10"
                    : "border-white/15 text-muted hover:text-text"
                }`}
              >
                {inspectorPinned ? "Pinned" : "Pin"}
              </button>
            </div>
            {selectedNode ? (
          <div>
            <div className="font-mono text-[0.55rem] tracking-[0.17em] text-orange mb-3 flex items-center justify-between">
              <span>{selectedNode.tech.toUpperCase()}</span>
              <span className="text-muted">{selectedNode.state.toUpperCase()}</span>
            </div>
            <div className="font-mono text-[0.47rem] tracking-[0.1em] text-muted mb-3">
              {openLoose} LOOSE OF {selectedNode.items.length}
            </div>
            <div className="space-y-2">
              {selectedNode.items.map((item, i) => {
                const done = selectedNode.pulled.includes(i);
                return (
                  <div
                    key={i}
                    className={`text-[0.79rem] font-light rounded-xl border px-3 py-2.5 ${
                      done
                        ? "border-white/10 bg-white/[.03] text-muted opacity-60"
                        : "border-white/10 bg-white/[.045] border-l-2 border-l-cyan text-[#dbe7f2]"
                    }`}
                  >
                    <span className="block font-mono text-[0.46rem] tracking-[0.14em] text-cyan mb-1">
                      {done ? "PULLED" : "LOOSE"}
                    </span>
                    {item}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-1.5 mt-4">
              <button
                onClick={() => {
                  setCreativeOpen(true);
                  void handleCreative(selectedNode.id);
                }}
                disabled={creativeLoading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 font-mono text-[0.55rem] tracking-[0.14em] uppercase px-3 py-2 rounded-full border border-orange/40 text-orange bg-orange/[.08] hover:bg-orange/[.16] disabled:opacity-50 disabled:cursor-wait transition-colors"
              >
                <span className={creativeLoading ? "animate-spin" : ""}>✦</span>
                {creativeLoading ? "GENERATING…" : "CREATIVE"}
              </button>
              <button
                onClick={handleTraceBack}
                disabled={traceLoading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 font-mono text-[0.55rem] tracking-[0.14em] uppercase px-3 py-2 rounded-full border border-gold/40 text-gold bg-gold/[.08] hover:bg-gold/[.16] disabled:opacity-50 disabled:cursor-wait transition-colors"
              >
                <span className={traceLoading ? "animate-spin" : ""}>↺</span>
                {traceLoading ? "TRACING…" : "TRACE BACK"}
              </button>
            </div>
            {traceError && <p className="mt-2 text-[0.68rem] text-red-300">{traceError}</p>}

            {trace && trace.nodeId === selectedNode.id && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="font-mono text-[0.5rem] tracking-[0.14em] text-gold mb-2">
                  ROADS NOT TAKEN
                </div>
                <div className="space-y-2 mb-3">
                  {trace.chain.map((n, i) => (
                    <div
                      key={n.id}
                      className="text-[0.72rem] font-light rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-2"
                    >
                      <span className="block font-mono text-[0.42rem] tracking-[0.1em] text-muted mb-1 uppercase">
                        {n.tech}
                      </span>
                      <span className="text-[#dbe7f2]">{trace.steps[i] ?? "—"}</span>
                    </div>
                  ))}
                </div>
                <div className="font-mono text-[0.5rem] tracking-[0.14em] text-gold mb-1.5">
                  ARC SO FAR
                </div>
                <p className="text-[0.74rem] font-light italic text-muted leading-relaxed">
                  {trace.summary}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted text-[0.78rem] font-light italic leading-relaxed">
            Select a node on the canvas to read what it pulled, or pull from the question itself
            to start a new line of inquiry.
          </p>
            )}
          </div>
        )}
      </aside>
      </div>

      {creativeOpen && (
        <div className="fixed inset-y-0 right-0 w-[420px] z-30 glass-chrome border-l border-orange/25 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-none">
            <div className="font-mono text-[0.6rem] tracking-[0.16em] text-orange uppercase">
              Creative batch
            </div>
            <button
              onClick={() => setCreativeOpen(false)}
              className="text-muted hover:text-text text-sm leading-none"
            >
              ✕
            </button>
          </div>
          <p className="px-4 pt-3 text-[0.68rem] font-light text-muted italic leading-relaxed flex-none">
            Nothing here is saved until you keep it. Discard clears it for good, close the tray to
            walk away from the rest.
          </p>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {creativeLoading && (
              <p className="text-muted text-[0.78rem] font-light italic">
                Generating a batch across techniques…
              </p>
            )}
            {creativeError && <p className="text-red-300 text-[0.72rem]">{creativeError}</p>}
            {!creativeLoading && candidates.length === 0 && !creativeError && (
              <p className="text-muted text-[0.78rem] font-light italic">
                Nothing left to review.
              </p>
            )}
            {candidates.map((c) => (
              <CreativeCandidateCard
                key={c.id}
                candidate={c}
                onKeep={() => keepCandidate(c)}
                onDiscard={() => discardCandidate(c)}
                onEdit={(text) => editCandidate(c.id, text)}
              />
            ))}
          </div>
        </div>
      )}

      {addKnotOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={() => setAddKnotOpen(false)}
        >
          <div
            className="glass-readable border border-white/10 rounded-2xl p-5 w-[420px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[0.6rem] tracking-[0.16em] text-orange uppercase">
                Add knot
              </span>
              <button
                onClick={() => setAddKnotOpen(false)}
                className="text-muted hover:text-text text-sm leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-[0.68rem] font-light text-muted italic leading-relaxed mb-3">
              A plain knot, in your own words — no technique applied. A new starting point you can
              run PULL from whenever you're ready to keep going.
            </p>
            <textarea
              value={addKnotText}
              onChange={(e) => setAddKnotText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="What's this new starting point?"
              className="w-full bg-black/30 border border-white/10 rounded-lg text-text text-[0.82rem] font-light p-2.5 outline-none focus:border-orange/50"
            />
            {addKnotError && <p className="mt-2 text-[0.68rem] text-red-300">{addKnotError}</p>}
            <div className="flex items-center gap-1.5 mt-3 justify-end">
              <button
                onClick={() => setAddKnotOpen(false)}
                className="font-mono text-[0.5rem] tracking-[0.1em] uppercase px-3 py-1.5 rounded-full border border-white/15 text-muted hover:text-text hover:border-white/30"
              >
                Cancel
              </button>
              <button
                onClick={submitAddKnot}
                disabled={addKnotSaving}
                className="font-mono text-[0.5rem] tracking-[0.1em] uppercase px-3 py-1.5 rounded-full border border-orange/40 text-orange bg-orange/[.08] hover:bg-orange/[.16] disabled:opacity-50 disabled:cursor-wait"
              >
                {addKnotSaving ? "Saving…" : "Add knot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailNode && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={() => setDetailNodeId(null)}
        >
          <div
            className="glass-readable border border-white/10 rounded-2xl p-5 w-[480px] max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[0.6rem] tracking-[0.16em] text-orange uppercase flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ background: techColor(detailNode.tech) }}
                />
                K{activeNodes.findIndex((n) => n.id === detailNode.id) + 1} · {detailNode.tech}
              </span>
              <button
                onClick={() => setDetailNodeId(null)}
                className="text-muted hover:text-text text-sm leading-none"
              >
                ✕
              </button>
            </div>
            <p className="font-mono text-[0.44rem] tracking-[0.1em] text-muted uppercase mb-3">
              {detailNode.state}
            </p>
            <div className="space-y-2.5">
              {detailDraft.map((item, i) => (
                <div key={i}>
                  <span className="block font-mono text-[0.42rem] tracking-[0.1em] text-cyan mb-1 uppercase">
                    {detailNode.pulled.includes(i) ? "Pulled" : "Loose"} · Item {i + 1}
                  </span>
                  <textarea
                    value={item}
                    onChange={(e) => updateDetailItem(i, e.target.value)}
                    rows={3}
                    className="w-full bg-black/30 border border-white/10 rounded-lg text-text text-[0.8rem] font-light p-2.5 outline-none focus:border-cyan/50"
                  />
                </div>
              ))}
            </div>
            {detailError && <p className="mt-2 text-[0.68rem] text-red-300">{detailError}</p>}
            <div className="flex items-center gap-1.5 mt-3 justify-end">
              <button
                onClick={() => setDetailNodeId(null)}
                className="font-mono text-[0.5rem] tracking-[0.1em] uppercase px-3 py-1.5 rounded-full border border-white/15 text-muted hover:text-text hover:border-white/30"
              >
                Cancel
              </button>
              <button
                onClick={saveDetail}
                disabled={detailSaving}
                className="font-mono text-[0.5rem] tracking-[0.1em] uppercase px-3 py-1.5 rounded-full border border-cyan/40 text-cyan bg-cyan/[.08] hover:bg-cyan/[.16] disabled:opacity-50 disabled:cursor-wait"
              >
                {detailSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
