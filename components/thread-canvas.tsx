"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeRow } from "@/lib/types";
import { layoutThread, pathTo, ROOT_ID, NODE_W, NODE_H } from "@/lib/layout";
import { createClient } from "@/lib/supabase/client";

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
  if (n.by_label === "night shift") return { label: "NIGHT", cls: "border-night/40 text-night bg-night/10" };
  if (n.by_label === "team") return { label: "TEAM", cls: "border-cyan/45 text-cyan bg-cyan/10" };
  return null;
}

/** A handful of short diagonal ticks fanning off the node's edge — a loose
 * thread end literally fraying, standing in for the flat dot-list the
 * original prototype used. */
function Fray({ count }: { count: number }) {
  const n = Math.min(count, 5);
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" className="absolute -right-3 top-1/2 -translate-y-1/2 overflow-visible pointer-events-none">
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

const PORT_STYLE = {
  background: "#ffd75e",
  border: "2px solid #7a5a14",
  width: 8,
  height: 8,
};

type KnotData = { node: NodeRow; dim: boolean; selected: boolean };

function KnotNode({ data }: NodeProps) {
  const { node: n, dim, selected } = data as unknown as KnotData;
  const open = n.items.length - n.pulled.length;
  const b = badge(n);

  return (
    <div
      className={`relative text-left rounded-2xl p-3 cursor-grab active:cursor-grabbing transition-all duration-200 ${
        selected ? "ring-2 ring-cyan/60" : ""
      }`}
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        opacity: dim ? 0.28 : 1,
        filter: dim ? "saturate(0.5)" : "none",
        background: selected
          ? "linear-gradient(150deg, rgba(48,132,142,.46), rgba(28,84,104,.46))"
          : "linear-gradient(150deg, rgba(50,92,144,.6), rgba(30,58,96,.58))",
        border: `1px solid ${selected ? "rgba(66,232,224,.5)" : "rgba(150,190,235,.3)"}`,
        boxShadow: "0 10px 26px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,255,255,.16)",
      }}
    >
      <Handle type="target" position={Position.Left} style={PORT_STYLE} />
      <Handle type="source" position={Position.Right} style={PORT_STYLE} />

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
    </div>
  );
}

type QuestionData = { question: string; questionVersion: number };

function QuestionNode({ data }: NodeProps) {
  const { question, questionVersion } = data as unknown as QuestionData;
  return (
    <div
      className="relative rounded-full flex flex-col items-center justify-center gap-1 px-6 glass cursor-grab active:cursor-grabbing"
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="source" position={Position.Right} style={PORT_STYLE} />
      <span className="font-mono text-[0.5rem] tracking-[0.18em] text-orange">
        WORKING QUESTION · V{questionVersion}
      </span>
      <span className="text-xs font-light text-text text-center leading-snug line-clamp-2">
        {question}
      </span>
    </div>
  );
}

const nodeTypes = { knot: KnotNode, question: QuestionNode };

function CanvasInner({
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
  const supabase = useMemo(() => createClient(), []);
  const nodesKey = nodes.map((n) => n.id).join(",");

  const buildNodes = useCallback((): Node[] => {
    const layout = layoutThread(nodes);
    const rootPos = layout[ROOT_ID] ?? { x: 0, y: 0 };
    const focusPath = selectedId ? pathTo(nodes, selectedId) : null;

    const questionNode: Node = {
      id: ROOT_ID,
      type: "question",
      position: rootPos,
      selectable: false,
      data: { question, questionVersion },
      style: { width: NODE_W, height: NODE_H },
    };

    const knotNodes: Node[] = nodes.map((n) => {
      const saved =
        n.position_x != null && n.position_y != null
          ? { x: n.position_x, y: n.position_y }
          : layout[n.id] ?? { x: 0, y: 0 };
      const onPath = focusPath ? focusPath.has(n.id) : true;
      return {
        id: n.id,
        type: "knot",
        position: saved,
        data: { node: n, dim: !!focusPath && !onPath, selected: n.id === selectedId },
        style: { width: NODE_W },
      };
    });

    return [questionNode, ...knotNodes];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesKey]);

  const [flowNodes, setFlowNodes] = useState<Node[]>(buildNodes);

  // Full reset only when the underlying node set actually changes (new
  // thread selected, or a node was created/deleted) — not on every render,
  // so a knot the user just dragged doesn't snap back mid-session.
  useEffect(() => {
    setFlowNodes(buildNodes());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesKey]);

  // Refresh dim/selected flags in place when focus changes, without
  // touching position — this is what keeps a dragged knot exactly where
  // you dropped it.
  useEffect(() => {
    const focusPath = selectedId ? pathTo(nodes, selectedId) : null;
    setFlowNodes((cur) =>
      cur.map((fn) => {
        if (fn.id === ROOT_ID) return fn;
        const n = nodes.find((x) => x.id === fn.id);
        if (!n) return fn;
        const onPath = focusPath ? focusPath.has(n.id) : true;
        return {
          ...fn,
          data: { node: n, dim: !!focusPath && !onPath, selected: n.id === selectedId },
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, nodes]);

  const edges: Edge[] = useMemo(() => {
    const focusPath = selectedId ? pathTo(nodes, selectedId) : null;
    return nodes.map((n) => {
      const source = n.parent_id ?? ROOT_ID;
      const onPath = focusPath ? focusPath.has(n.id) : false;
      const dim = !!focusPath && !onPath;
      return {
        id: `e-${source}-${n.id}`,
        source,
        target: n.id,
        style: {
          stroke: onPath ? "#ffd75e" : "#d9a63f",
          strokeWidth: onPath ? 2.4 : 1.5,
          opacity: dim ? 0.12 : n.state === "prov" ? 0.55 : 0.85,
        },
      };
    });
  }, [nodes, selectedId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setFlowNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onNodeDragStop: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      if (node.id === ROOT_ID) return;
      void supabase
        .from("nodes")
        .update({ position_x: node.position.x, position_y: node.position.y })
        .eq("id", node.id);
    },
    [supabase]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.id === ROOT_ID) return;
      onSelect(node.id);
    },
    [onSelect]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.06)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function ThreadCanvas(props: {
  nodes: NodeRow[];
  question: string;
  questionVersion: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
