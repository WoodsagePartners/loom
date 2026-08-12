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

  return (
    <div className="flex h-screen">
      <aside className="glass-chrome w-56 flex-none border-r border-white/10 px-2">
        <ThreadRail threads={rail} activeId={activeId} onSelect={selectThread} />
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

            <button
              onClick={handleTraceBack}
              disabled={traceLoading}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 font-mono text-[0.55rem] tracking-[0.14em] uppercase px-3 py-2 rounded-full border border-gold/40 text-gold bg-gold/[.08] hover:bg-gold/[.16] disabled:opacity-50 disabled:cursor-wait transition-colors"
            >
              <span className={traceLoading ? "animate-spin" : ""}>↺</span>
              {traceLoading ? "TRACING BACK…" : "TRACE BACK"}
            </button>
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
    </div>
  );
}
