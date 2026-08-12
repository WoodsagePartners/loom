"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  ControlButton,
  Handle,
  Position,
  applyNodeChanges,
  useReactFlow,
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
import { pickTechnique, explainSuggestion, techColor, type Technique } from "@/lib/techniques";

type Suggestion = { key: string; why: string } | null;

function suggestFor(nodeId: string, nodes: NodeRow[], techniques: Technique[]): Suggestion {
  if (techniques.length === 0) return null;
  const used = [...pathTo(nodes, nodeId)]
    .map((id) => nodes.find((x) => x.id === id)?.tech)
    .filter((t): t is string => !!t);
  const picked = pickTechnique(used, techniques);
  return picked ? { key: picked.key, why: explainSuggestion(picked, used) } : null;
}

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
  pull: "↯",
  note: "✎",
};

function PullButton({ onClick, pulling, label }: { onClick: () => void; pulling: boolean; label: string }) {
  return (
    <button
      className="nodrag nopan mt-2.5 inline-flex items-center gap-2 font-mono text-[0.9rem] tracking-[0.04em] uppercase px-3.5 py-2 rounded-full border border-orange/40 text-orange bg-orange/[.08] hover:bg-orange/[.16] disabled:opacity-50 disabled:cursor-wait transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={pulling}
    >
      <span className={pulling ? "animate-spin" : ""}>↯</span>
      {pulling ? "PULLING…" : label}
    </button>
  );
}

function AddKnotButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="nodrag nopan mt-2.5 inline-flex items-center gap-2 font-mono text-[0.9rem] tracking-[0.04em] uppercase px-3.5 py-2 rounded-full border border-white/15 text-muted hover:text-text hover:border-white/30 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Add a plain knot here — no technique, just your own words"
    >
      + Add
    </button>
  );
}

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

function SuggestionIcon({ suggestion }: { suggestion: Suggestion }) {
  if (!suggestion) return null;
  return (
    <div className="nodrag nopan group absolute -left-2 -top-2 z-10">
      <div className="w-5 h-5 rounded-full border border-gold/50 bg-gold/15 grid place-items-center text-[0.7rem] text-gold cursor-help">
        ✦
      </div>
      <div className="pointer-events-none absolute left-0 top-6 w-56 rounded-xl border border-gold/30 bg-[#0d1420]/95 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-20">
        <div className="font-mono text-[0.6rem] tracking-[0.1em] text-gold uppercase mb-1">
          Suggested · {suggestion.key}
        </div>
        <div className="text-[0.78rem] font-light text-[#dbe7f2] leading-snug">{suggestion.why}</div>
      </div>
    </div>
  );
}

const PORT_STYLE = {
  background: "#ffd75e",
  border: "2px solid #7a5a14",
  width: 8,
  height: 8,
};

// How far in a knot-focus click zooms, at minimum (won't zoom OUT if
// you're already closer than this).
const FOCUS_ZOOM_LEVEL = 1.15;

type KnotData = {
  node: NodeRow;
  dim: boolean;
  selected: boolean;
  pulling: boolean;
  onPull: (id: string) => void;
  onAddKnot: (id: string) => void;
  suggestion: Suggestion;
  label: number;
};

function KnotNode({ data }: NodeProps) {
  const { node: n, dim, selected, pulling, onPull, onAddKnot, suggestion, label } =
    data as unknown as KnotData;
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
          ? "linear-gradient(150deg, rgba(48,132,142,.4), rgba(28,84,104,.4)), linear-gradient(rgba(7,12,19,.6), rgba(7,12,19,.6))"
          : "linear-gradient(150deg, rgba(50,92,144,.48), rgba(30,58,96,.46)), linear-gradient(rgba(7,12,19,.6), rgba(7,12,19,.6))",
        backdropFilter: "blur(20px) saturate(125%)",
        WebkitBackdropFilter: "blur(20px) saturate(125%)",
        border: `1px solid ${selected ? "rgba(66,232,224,.5)" : "rgba(150,190,235,.3)"}`,
        borderLeftWidth: "4px",
        borderLeftColor: techColor(n.tech),
        boxShadow: "0 10px 26px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,255,255,.16)",
      }}
    >
      <Handle type="target" position={Position.Left} style={PORT_STYLE} />
      <Handle type="source" position={Position.Right} style={PORT_STYLE} />
      <SuggestionIcon suggestion={suggestion} />

      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="font-mono text-[0.95rem] tracking-[0.04em] uppercase text-[#a8d4ff]">
          <span className="text-muted">K{label} · </span>
          {n.tech}
        </span>
        <span
          className="w-8 h-8 rounded-md grid place-items-center text-[1.05rem] font-mono flex-none"
          style={{
            border: `1px solid ${techColor(n.tech)}66`,
            background: `${techColor(n.tech)}22`,
            color: techColor(n.tech),
          }}
        >
          {GLYPH[n.base ?? n.tech] ?? "◈"}
        </span>
      </div>
      <div className="text-[1.15rem] font-light leading-snug text-[#dbe7f2] line-clamp-3">
        {n.items[0] ?? ""}
      </div>
      {b && (
        <span
          className={`inline-block mt-2.5 font-mono text-[0.75rem] tracking-[0.04em] px-2 py-0.5 rounded-lg border ${b.cls}`}
        >
          {b.label}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <PullButton onClick={() => onPull(n.id)} pulling={pulling} label="PULL" />
        <AddKnotButton onClick={() => onAddKnot(n.id)} />
      </div>
      {open > 0 && <Fray count={open} />}
    </div>
  );
}

type QuestionData = {
  question: string;
  questionVersion: number;
  pulling: boolean;
  onPull: () => void;
  onAddKnot: () => void;
  suggestion: Suggestion;
};

function QuestionNode({ data }: NodeProps) {
  const { question, questionVersion, pulling, onPull, onAddKnot, suggestion } =
    data as unknown as QuestionData;
  return (
    <div
      className="relative rounded-[2.5rem] flex flex-col items-center justify-center gap-1 px-6 py-4 glass cursor-grab active:cursor-grabbing"
      style={{ width: NODE_W, minHeight: NODE_H }}
    >
      <Handle type="source" position={Position.Right} style={PORT_STYLE} />
      <SuggestionIcon suggestion={suggestion} />
      <span className="font-mono text-[0.8rem] tracking-[0.12em] text-orange">
        WORKING QUESTION · V{questionVersion}
      </span>
      <span className="text-[1.25rem] font-light text-text text-center leading-snug line-clamp-2">
        {question}
      </span>
      <div className="flex items-center gap-1.5">
        <PullButton onClick={onPull} pulling={pulling} label="PULL" />
        <AddKnotButton onClick={onAddKnot} />
      </div>
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
  onPull,
  pullingId,
  onAddKnot,
  onOpenDetail,
  fitSignal,
  onTidy,
  tidyLoading,
  onNodeMoved,
  techniques,
}: {
  nodes: NodeRow[];
  question: string;
  questionVersion: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPull: (sourceId: string | null) => void;
  pullingId: string | null;
  onAddKnot: (sourceId: string | null) => void;
  onOpenDetail: (id: string) => void;
  fitSignal: number;
  onTidy: () => void;
  tidyLoading: boolean;
  onNodeMoved: (id: string, x: number, y: number) => void;
  techniques: Technique[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { fitView, zoomIn, zoomOut, getZoom, setCenter, screenToFlowPosition } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  // Snapshot of the *flow-space point* under the container's center, plus
  // the zoom level, taken right before a click focuses in on a knot. Storing
  // a flow coordinate rather than a raw pixel viewport is what makes the
  // restore self-correcting if the container resizes in between (e.g. the
  // inspector panel opening or closing) — setCenter recomputes against
  // whatever the container measures at restore time instead of replaying
  // stale pixels. Escape restores it and clears focus in one motion.
  const savedViewport = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const captureViewport = useCallback(() => {
    if (savedViewport.current != null) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const flow = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    savedViewport.current = { x: flow.x, y: flow.y, zoom: getZoom() };
  }, [screenToFlowPosition, getZoom]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      onSelect(null);
      if (!savedViewport.current) return;
      const c = savedViewport.current;
      savedViewport.current = null;
      setCenter(c.x, c.y, { zoom: c.zoom, duration: 400 });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCenter, onSelect]);

  // The zoom dock is deliberately NOT an xyflow Panel — Panel positions
  // itself relative to the .react-flow container's own box, which isn't
  // reliably the same as the bottom of the actual browser window (nested
  // flex heights, the rail/inspector panels resizing, etc). Rendering it as
  // a plain position:fixed element pins it to the real viewport edge, then
  // this just tracks the canvas container's left edge so it still sits
  // where the canvas begins horizontally.
  const [dockLeft, setDockLeft] = useState(20);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDockLeft(el.getBoundingClientRect().left + 20);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  // Position is part of the key, not just id, so a TIDY (which overwrites
  // position_x/position_y on every node in the thread) actually triggers a
  // full rebuild instead of silently no-opping because the id list didn't
  // change. Ordinary drags don't touch this — they only ever write to
  // Supabase, never back into the `nodes` prop, so this stays quiet for
  // the common case.
  const nodesKey = nodes.map((n) => `${n.id}:${n.position_x ?? ""}:${n.position_y ?? ""}`).join(",");

  const buildNodes = useCallback((): Node[] => {
    const layout = layoutThread(nodes);
    const rootPos = layout[ROOT_ID] ?? { x: 0, y: 0 };
    const focusPath = selectedId ? pathTo(nodes, selectedId) : null;

    const questionNode: Node = {
      id: ROOT_ID,
      type: "question",
      position: rootPos,
      selectable: false,
      data: {
        question,
        questionVersion,
        pulling: pullingId === ROOT_ID,
        onPull: () => onPull(null),
        onAddKnot: () => onAddKnot(null),
        suggestion: suggestFor(ROOT_ID, nodes, techniques),
      },
      style: { width: NODE_W },
    };

    const knotNodes: Node[] = nodes.map((n, i) => {
      const saved =
        n.position_x != null && n.position_y != null
          ? { x: n.position_x, y: n.position_y }
          : layout[n.id] ?? { x: 0, y: 0 };
      const onPath = focusPath ? focusPath.has(n.id) : true;
      return {
        id: n.id,
        type: "knot",
        position: saved,
        data: {
          node: n,
          dim: !!focusPath && !onPath,
          selected: n.id === selectedId,
          pulling: pullingId === n.id,
          onPull: () => onPull(n.id),
          onAddKnot: () => onAddKnot(n.id),
          suggestion: suggestFor(n.id, nodes, techniques),
          label: i + 1,
        },
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

  // Refresh dim/selected/pulling flags in place when focus or pull state
  // changes, without touching position — this is what keeps a dragged knot
  // exactly where you dropped it.
  useEffect(() => {
    const focusPath = selectedId ? pathTo(nodes, selectedId) : null;
    setFlowNodes((cur) =>
      cur.map((fn) => {
        if (fn.id === ROOT_ID) {
          return {
            ...fn,
            data: {
              ...fn.data,
              pulling: pullingId === ROOT_ID,
              onPull: () => onPull(null),
              onAddKnot: () => onAddKnot(null),
            },
          };
        }
        const n = nodes.find((x) => x.id === fn.id);
        if (!n) return fn;
        const onPath = focusPath ? focusPath.has(n.id) : true;
        return {
          ...fn,
          data: {
            ...fn.data,
            node: n,
            dim: !!focusPath && !onPath,
            selected: n.id === selectedId,
            pulling: pullingId === n.id,
            onPull: () => onPull(n.id),
            onAddKnot: () => onAddKnot(n.id),
          },
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, nodes, pullingId, onPull, onAddKnot]);

  // A TIDY re-fits the viewport even when positions didn't move (see
  // handleTidy in thread-workspace.tsx) — this is the visible confirmation
  // that the action actually ran, not just a silent no-op.
  useEffect(() => {
    if (fitSignal > 0) fitView({ padding: 0.25, duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  // The technique library loads asynchronously after mount — once it (or
  // the node set) changes, refresh just the suggestion field in place.
  useEffect(() => {
    setFlowNodes((cur) =>
      cur.map((fn) => ({
        ...fn,
        data: {
          ...fn.data,
          suggestion: suggestFor(fn.id, nodes, techniques),
        },
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techniques, nodes]);

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
          // Uniform wire color — technique is already legible from the
          // knot's left-edge accent, keeping every wire the same color
          // reads as one continuous weave instead of a tangle.
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

  // Persisting to Supabase alone isn't enough — ThreadWorkspace's nodesState
  // is the source of truth buildNodes() rebuilds from, and it never learns
  // about a drag unless told. Skip that and the very next full rebuild
  // (a new pull, a new knot, a Tidy) silently snaps the dragged knot back to
  // wherever nodesState still thinks it is.
  const onNodeDragStop: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      if (node.id === ROOT_ID) return;
      onNodeMoved(node.id, node.position.x, node.position.y);
      void supabase
        .from("nodes")
        .update({ position_x: node.position.x, position_y: node.position.y })
        .eq("id", node.id)
        .then(({ error }) => {
          if (error) console.error("Failed to save knot position:", error.message);
        });
    },
    [supabase, onNodeMoved]
  );

  // First click on a knot focuses it: select (dims the rest of the board),
  // snapshot the current viewport, and zoom in on it. Click the SAME knot
  // again — it's already selected — and that second, deliberate click opens
  // the full content for editing. Escape (see the effect above) is what
  // backs out of a focused knot and restores the pre-focus viewport.
  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.id === ROOT_ID) return;
      if (selectedId === node.id) {
        onOpenDetail(node.id);
        return;
      }
      captureViewport();
      onSelect(node.id);
      const width = node.measured?.width ?? NODE_W;
      const height = node.measured?.height ?? NODE_H;
      setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        zoom: Math.max(getZoom(), FOCUS_ZOOM_LEVEL),
        duration: 450,
      });
    },
    [selectedId, onOpenDetail, captureViewport, onSelect, setCenter, getZoom]
  );

  return (
    <div className="h-full w-full" ref={containerRef}>
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelect(null)}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.06)" />
      </ReactFlow>
      <div
        className="react-flow__controls horizontal fixed bottom-5 z-20"
        style={{ left: dockLeft }}
      >
        <ControlButton onClick={() => zoomIn({ duration: 200 })} title="Zoom in">
          <span className="text-[0.85rem] leading-none">+</span>
        </ControlButton>
        <ControlButton onClick={() => fitView({ padding: 0.25, duration: 400 })} title="Reframe the whole board">
          <span className="block w-2.5 h-2.5 border border-current" />
        </ControlButton>
        <ControlButton onClick={() => zoomOut({ duration: 200 })} title="Zoom out">
          <span className="text-[0.95rem] leading-none">−</span>
        </ControlButton>
        <ControlButton
          onClick={onTidy}
          disabled={tidyLoading}
          title="Tidy board — reset every knot to a clean auto-layout"
        >
          <span className={`text-[0.85rem] leading-none ${tidyLoading ? "animate-spin" : ""}`}>⟲</span>
        </ControlButton>
      </div>
    </div>
  );
}

export function ThreadCanvas(props: {
  nodes: NodeRow[];
  question: string;
  questionVersion: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPull: (sourceId: string | null) => void;
  pullingId: string | null;
  onAddKnot: (sourceId: string | null) => void;
  onOpenDetail: (id: string) => void;
  fitSignal: number;
  onTidy: () => void;
  tidyLoading: boolean;
  onNodeMoved: (id: string, x: number, y: number) => void;
  techniques: Technique[];
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
