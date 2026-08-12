"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeRow, ThreadRow } from "@/lib/types";
import type { Technique } from "@/lib/techniques";
import { ThreadRail, type ThreadSummary } from "@/components/thread-rail";
import { ThreadCanvas } from "@/components/thread-canvas";
import { createClient } from "@/lib/supabase/client";
import { ROOT_ID, pathTo } from "@/lib/layout";

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

// Preview only — the actual composer (task #26) picks one of these before
// naming a thread. Content matches the framework already agreed on.
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
  threads,
  nodesByThread,
}: {
  orgId: string;
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
  const [composerOpen, setComposerOpen] = useState(false);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const activeNodes = activeId ? nodesState[activeId] ?? [] : [];
  const selectedNode = activeNodes.find((n) => n.id === selectedNodeId) ?? null;

  const rail: ThreadSummary[] = useMemo(
    () =>
      threads.map((t) => ({
        id: t.id,
        name: t.name,
        state: t.state,
        nodeCount: (nodesState[t.id] ?? []).length,
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

  async function bumpTechniqueStat(techKey: string, field: "kept" | "dropped") {
    const t = techniques.find((x) => x.key === techKey);
    if (!t) return;
    const next = { ...t.stats, [field]: t.stats[field] + 1 };
    await createClient().from("library_techniques").update({ stats: next }).eq("id", t.id);
    setTechniques((cur) => cur.map((x) => (x.id === t.id ? { ...x, stats: next } : x)));
  }

  if (!active) {
    return (
      <div className="p-8 text-muted text-sm font-light">
        No threads yet. Start one and this canvas fills in.
      </div>
    );
  }

  const question = active.questions[active.questions.length - 1] ?? active.name;
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
    <div className="flex h-screen">
      <aside className="glass-chrome w-56 flex-none border-r border-white/10 px-2">
        <ThreadRail
          threads={rail}
          activeId={activeId}
          onSelect={selectThread}
          onNew={() => setComposerOpen(true)}
        />
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="px-8 pt-6 pb-3 flex-none">
          <div className="font-mono text-[0.55rem] tracking-[0.2em] text-orange mb-1">
            WORKING QUESTION · V{active.questions.length}
            {active.state !== "live" ? ` · ${active.state.toUpperCase()}` : ""}
          </div>
          <div className="text-2xl font-light leading-snug max-w-3xl">{question}</div>
          {pullError && (
            <div className="mt-2 inline-flex items-center gap-2 text-[0.7rem] font-mono text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1">
              {pullError}
              <button onClick={() => setPullError(null)} className="text-red-200/70 hover:text-red-100">
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <ThreadCanvas
            nodes={activeNodes}
            question={question}
            questionVersion={active.questions.length}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            onPull={handlePull}
            pullingId={pullingId}
            techniques={techniques}
          />
        </div>
      </main>

      <aside className="glass-chrome w-80 flex-none border-l border-white/10 p-4 overflow-y-auto">
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
      </aside>

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

      {composerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="glass-chrome w-full max-w-2xl rounded-3xl border border-white/10 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <div className="font-mono text-[0.6rem] tracking-[0.16em] text-orange uppercase">
                Start a weaving session
              </div>
              <button
                onClick={() => setComposerOpen(false)}
                className="text-muted hover:text-text text-sm leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-muted text-[0.75rem] font-light italic mb-5">
              Composer coming soon — pick the shape of the problem before picking a technique.
              Preview below.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {STARTING_POINTS.map((sp) => (
                <div
                  key={sp.key}
                  className="relative rounded-2xl border border-white/10 bg-white/[.03] p-3 opacity-60 cursor-not-allowed"
                >
                  <span className="absolute top-2 right-2 font-mono text-[0.4rem] tracking-[0.1em] text-orange/80 uppercase">
                    Soon
                  </span>
                  <span className="w-6 h-6 rounded-md border border-white/15 bg-white/[.06] grid place-items-center text-[0.7rem] text-[#cfe2f6] mb-2">
                    {sp.glyph}
                  </span>
                  <div className="text-[0.78rem] font-normal text-text mb-1">{sp.label}</div>
                  <div className="text-[0.68rem] font-light text-muted leading-snug">{sp.blurb}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
