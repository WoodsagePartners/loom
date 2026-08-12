"use client";

import type { ThreadState } from "@/lib/types";

export type ThreadSummary = {
  id: string;
  name: string;
  state: ThreadState;
  nodeCount: number;
  question: string;
  context: string;
};

function strandPath(nodeCount: number) {
  const n = Math.max(nodeCount, 1);
  let d = "M2 9";
  for (let i = 1; i <= 3; i++) {
    d += ` Q ${i * 6} ${9 - Math.min(n, 6) * 0.8 * (i % 2 ? 1 : -1)}, ${i * 6 + 3} 9`;
  }
  return d;
}

export function ThreadRail({
  threads,
  activeId,
  onSelect,
  onNew,
}: {
  threads: ThreadSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 h-full overflow-y-auto py-2">
      {threads.map((t) => {
        const active = t.id === activeId;
        const strandColor = t.state === "cut" ? "#93a5b6" : "#f8991d";
        // The visible label is already the thread's name — the hover title
        // earns its keep by showing what a name alone can't: the working
        // question and, if given, the context behind it.
        const hint = [t.question, t.context].filter(Boolean).join("\n\n");
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            title={hint || t.name}
            className="group relative flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all duration-300 ease-out text-left"
            style={{
              // "Pulled taut": the active strand steps forward and brightens;
              // everything else recedes into the background weave.
              transform: active ? "translateX(4px) scale(1.03)" : "translateX(0) scale(1)",
              opacity: active ? 1 : 0.5,
              filter: active ? "none" : "saturate(0.55)",
              background: active ? "rgba(248,153,29,.12)" : "transparent",
              border: `1px solid ${active ? "rgba(248,153,29,.4)" : "transparent"}`,
            }}
          >
            <svg viewBox="0 0 24 18" width={24} height={18} className="flex-none">
              <path
                d={strandPath(t.nodeCount)}
                stroke={strandColor}
                strokeWidth={Math.min(1.2 + t.nodeCount * 0.28, 3.2)}
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-light truncate text-text max-w-[9rem]">{t.name}</span>
            {t.state !== "live" && (
              <span className="ml-auto font-mono text-[0.44rem] tracking-[0.1em] text-muted uppercase flex-none">
                {t.state}
              </span>
            )}
          </button>
        );
      })}
      {onNew && (
        <button
          onClick={onNew}
          className="mt-1 rounded-xl border border-dashed border-white/10 text-muted text-lg font-extralight py-2 hover:text-orange hover:border-orange/40 transition-colors"
        >
          +
        </button>
      )}
    </div>
  );
}
