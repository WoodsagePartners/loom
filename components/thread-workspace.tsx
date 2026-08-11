"use client";

import { useMemo, useState } from "react";
import type { NodeRow, ThreadRow } from "@/lib/types";
import { ThreadRail, type ThreadSummary } from "@/components/thread-rail";
import { ThreadCanvas } from "@/components/thread-canvas";

export function ThreadWorkspace({
  threads,
  nodesByThread,
}: {
  threads: ThreadRow[];
  nodesByThread: Record<string, NodeRow[]>;
}) {
  const [activeId, setActiveId] = useState<string | null>(threads[0]?.id ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const activeNodes = activeId ? nodesByThread[activeId] ?? [] : [];
  const selectedNode = activeNodes.find((n) => n.id === selectedNodeId) ?? null;

  const rail: ThreadSummary[] = useMemo(
    () =>
      threads.map((t) => ({
        id: t.id,
        name: t.name,
        state: t.state,
        nodeCount: (nodesByThread[t.id] ?? []).length,
      })),
    [threads, nodesByThread]
  );

  function selectThread(id: string) {
    setActiveId(id);
    setSelectedNodeId(null);
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

  return (
    <div className="flex h-screen">
      <aside className="w-56 flex-none border-r border-white/10 px-2">
        <ThreadRail threads={rail} activeId={activeId} onSelect={selectThread} />
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="px-8 pt-6 pb-3 flex-none">
          <div className="font-mono text-[0.55rem] tracking-[0.2em] text-orange mb-1">
            WORKING QUESTION · V{active.questions.length}
            {active.state !== "live" ? ` · ${active.state.toUpperCase()}` : ""}
          </div>
          <div className="text-2xl font-light leading-snug max-w-3xl">{question}</div>
        </div>
        <div className="flex-1 min-h-0">
          <ThreadCanvas
            nodes={activeNodes}
            question={question}
            questionVersion={active.questions.length}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
          />
        </div>
      </main>

      <aside className="w-80 flex-none border-l border-white/10 p-4 overflow-y-auto">
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
