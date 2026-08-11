"use client";

import { useMemo } from "react";
import type { NodeRow } from "@/lib/types";
import { layoutThread, pathTo, ROOT_ID, NODE_W, NODE_H } from "@/lib/layout";

const GLYPH: Record<string, string> = {
  "first principles": "▽",
  reframe: "↺",
  invert: "⇅",
  "outsider view": "◇",
  analogous: "⇄",
  "scope shift": "⇧",
  absence: "◌",
  "forced collision": "✕",
  "found out": "▣",
  "night shift": "☾",
  fiber: "〜",
};

function badge(n: NodeRow) {
  if (n.state === "prov") return { label: "OPEN", cls: "border-port/45 text-port bg-port/10" };
  if (n.state === "pin")
    return n.ready
      ? { label: "READY", cls: "border-gold/50 text-gold bg-gold/10" }
      : { label: "TIED", cls: "border-gold/50 text-gold bg-gold/10" };
  if (n.by === "night shift") return { label: "NIGHT", cls: "border-night/40 text-night bg-night/10" };
  return null;
}

/** A handful of short diagonal ticks fanning off the node's edge — a loose
 * thread end literally fraying, standing in for the flat dot-list the
 * original prototype used. */
function Fray({ count }: { count: number }) {
  const n = Math.min(count, 5);
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" className="absolute -right-3 top-1/2 -translate-y-1/2 overflow-visible">
      {Array.from({ length: n }).map((_, i) => {
        const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 26;
        const len = 12 + (i % 2) * 4;
        const y = 17 + spread;
        return (
          <line
            key={i}
            x1={2}
            y1={17}
            x2={2 + len}
            y2={y}
            stroke="#ffd75e"
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.75 - i * 0.08}
          />
        );
      })}
    </svg>
  );
}

export function ThreadCanvas({
  nodes,
  question,
  questionVersion,
  selectedId,
  onSelect,
}: {
  nodes: NodeRow[];
  question: string;
  questionVersion: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const positions = useMemo(() => layoutThread(nodes), [nodes]);
  const focusPath = useMemo(
    () => (selectedId ? pathTo(nodes, selectedId) : null),
    [nodes, selectedId]
  );

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  let maxX = 0;
  let maxY = 0;
  for (const p of Object.values(positions)) {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const rootPos = positions[ROOT_ID] ?? { x: 0, y: 0 };

  return (
    <div className="relative overflow-auto h-full w-full">
      <div
        className="relative"
        style={{ width: maxX + NODE_W + 80, height: Math.max(maxY + NODE_H + 60, 200) }}
      >
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          width={maxX + NODE_W + 80}
          height={Math.max(maxY + NODE_H + 60, 200)}
        >
          {nodes.map((n) => {
            if (!n.parent_id && n.parent_id !== null) return null;
            const from = n.parent_id ? positions[n.parent_id] : positions[ROOT_ID];
            const to = positions[n.id];
            if (!from || !to) return null;
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const m = (x1 + x2) / 2;
            const onPath = focusPath ? focusPath.has(n.id) : false;
            const dim = focusPath && !onPath;
            return (
              <g key={n.id} opacity={dim ? 0.22 : 1}>
                <path
                  d={`M${x1} ${y1} C ${m} ${y1}, ${m} ${y2}, ${x2} ${y2}`}
                  stroke={onPath ? "#ffd75e" : "#d9a63f"}
                  strokeWidth={onPath ? 2.4 : 1.5}
                  fill="none"
                  strokeLinecap="round"
                  opacity={n.state === "prov" ? 0.55 : 0.85}
                />
                <circle cx={x1} cy={y1} r={3.4} fill="#ffd75e" stroke="#7a5a14" strokeWidth={1} />
                <circle cx={x2} cy={y2} r={3.4} fill="#ffd75e" stroke="#7a5a14" strokeWidth={1} />
              </g>
            );
          })}
        </svg>

        {/* The question pill plays the role the root node did in the prototype */}
        <div
          className="absolute rounded-full flex flex-col items-center justify-center gap-1 px-6 glass"
          style={{ left: rootPos.x, top: rootPos.y, width: NODE_W, height: NODE_H }}
        >
          <span className="font-mono text-[0.5rem] tracking-[0.18em] text-orange">
            WORKING QUESTION · V{questionVersion}
          </span>
          <span className="text-xs font-light text-text text-center leading-snug line-clamp-2">
            {question}
          </span>
        </div>

        {nodes.map((n) => {
          const p = positions[n.id];
          if (!p) return null;
          const open = n.items.length - n.pulled.length;
          const onPath = focusPath ? focusPath.has(n.id) : true;
          const dim = focusPath && !onPath;
          const b = badge(n);
          const sel = n.id === selectedId;

          return (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              className={`absolute text-left rounded-2xl p-3 transition-all duration-200 ${
                sel ? "ring-2 ring-cyan/60" : ""
              }`}
              style={{
                left: p.x,
                top: p.y,
                width: NODE_W,
                minHeight: NODE_H,
                opacity: dim ? 0.28 : 1,
                filter: dim ? "saturate(0.5)" : "none",
                background: sel
                  ? "linear-gradient(150deg, rgba(48,132,142,.46), rgba(28,84,104,.46))"
                  : "linear-gradient(150deg, rgba(50,92,144,.6), rgba(30,58,96,.58))",
                border: `1px solid ${sel ? "rgba(66,232,224,.5)" : "rgba(150,190,235,.3)"}`,
                boxShadow: "0 10px 26px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,255,255,.16)",
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-[#a8d4ff]">
                  {n.tech}
                </span>
                <span className="w-5 h-5 rounded-md border border-white/20 bg-white/[.07] grid place-items-center text-[0.64rem] font-mono text-[#cfe2f6] flex-none">
                  {GLYPH[n.base ?? n.tech] ?? "◈"}
                </span>
              </div>
              <div className="text-[0.73rem] font-light leading-snug text-[#dbe7f2] line-clamp-3">
                {n.items[0] ?? ""}
              </div>
              {b && (
                <span
                  className={`inline-block mt-2 font-mono text-[0.44rem] tracking-[0.1em] px-1.5 py-0.5 rounded-lg border ${b.cls}`}
                >
                  {b.label}
                </span>
              )}
              {open > 0 && <Fray count={open} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
