"use client";

import { useMemo, useState } from "react";
import type { NodeRow, ThreadRow } from "@/lib/types";
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
  const [pullingId, setPullingId] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

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
