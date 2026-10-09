"use client";

import { Fragment, createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  Controls,
  ControlButton,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  NodeToolbar,
  Position,
  SelectionMode,
  ViewportPortal,
  applyNodeChanges,
  getSmoothStepPath,
  useReactFlow,
  useStore,
  Panel,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import {
  LANE_H,
  LANE_LABEL_W,
  LANE_W,
  MIN_X,
  NEUTRAL,
  NODE_H,
  NODE_TYPES,
  NODE_W,
  PALETTE,
  EDGE_KINDS,
  edgeKindInfo,
  nodeTypeInfo,
  type Actor,
  type EdgeKind,
  type FlowEdge,
  type Focus,
  type FlowNode,
  type FlowPin,
  type PhaseNode,
  type Roadmap,
  type RoadmapPhase,
  type PinKind,
  type Lane,
  type NodeType,
  type EdgePatch,
  FRICTIONS,
  WEIGHTS,
  CHANNELS,
  WAIT_UNITS,
  waitParts,
} from "@/lib/flow";
import { useT } from "@/lib/i18n";
import { Tx, useTx } from "@/lib/content-i18n";
import { HandIcon, LockIcon, PointerIcon, UnlockIcon } from "@/components/icons";
import { useTheme } from "@/lib/theme";
import { GroundSymbol, ShapeBody } from "@/components/flow/shapes";
import { HopBar, LayerLegend, PIN_KINDS, PinLayer, computeSignals, type Signal } from "@/components/flow/pin-layer";
import { BirdsEye } from "@/components/flow/birds-eye";
import { HelpTip } from "@/components/flow/help-tip";

// ------------------------------------------------------------------ types --
type NodeData = {
  node: FlowNode;
  actor: Actor | null;
  actors: Actor[];
  editing: boolean;
  onStartEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string) => void;
  onCancelEdit: () => void;
  onPatch: (id: string, patch: Partial<FlowNode>) => string | null;
  onDelete: (id: string) => void;
  onClose: () => void;
  onAddNext: (id: string) => void;
  dim: boolean;
  ring: string | null;
  badges: string[];
  selecting: boolean;
  soft?: boolean;
  commentCount: number;
  onOpenComments: (id: string) => void;
};
type RFNode = Node<NodeData, "flow">;
type EdgeData = {
  label: string | null;
  kind: EdgeKind;
  color: string | null;
  onColor: (id: string, color: string | null) => void;
  onLabel: (id: string, label: string) => void;
  onKind: (id: string, kind: EdgeKind) => void;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  smarts: Pick<FlowEdge, "payload" | "channel" | "wait_minutes" | "friction" | "weight" | "note">;
  onSmarts: (id: string, patch: EdgePatch) => void;
  dim: boolean;
  soft?: boolean;
};
type RFEdge = Edge<EdgeData, "flow">;

const HANDLES: { id: string; pos: Position }[] = [
  { id: "t", pos: Position.Top },
  { id: "r", pos: Position.Right },
  { id: "b", pos: Position.Bottom },
  { id: "l", pos: Position.Left },
];

const TYPE_SHORT: Record<NodeType, [string, string]> = {
  start: ["Start", "Beginn"],
  action: ["Action", "Aktion"],
  decision: ["Decide", "Wahl"],
  wait: ["Wait", "Warten"],
  document: ["Doc", "Dok."],
  end: ["End", "Ende"],
};

const INPUT_CLS =
  "nodrag nopan nowheel w-full bg-black/40 border border-white/15 rounded-md text-text text-[0.8rem] px-2 py-1.5 outline-none focus:border-orange/60";

// ------------------------------------------------------------- node view --

// hover cards and quick actions wait this long, so moving across a board stays calm
const HOVER_DELAY = 1000;

// ---- drag a card by its top strip --------------------------------------------------
function useDragCard(getZoom?: () => number) {
  const [o, setO] = useState({ x: 0, y: 0 });
  const st = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const bind = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      st.current = { sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = st.current;
      if (!d) return;
      const z = getZoom ? getZoom() || 1 : 1;
      setO({ x: d.ox + (e.clientX - d.sx) / z, y: d.oy + (e.clientY - d.sy) / z });
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      st.current = null;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    },
  };
  return { o, setO, bind };
}

function CardFooter({ onDelete, onDone }: { onDelete: () => void; onDone: () => void }) {
  const t = useT();
  return (
    <div className="mt-3 flex items-center justify-between">
      <button type="button" onClick={onDelete} className="btn-danger inline-flex h-6 items-center rounded-full border px-3 text-[0.68rem] font-mono leading-none tracking-wider transition-colors">{t("DELETE", "LÖSCHEN")}</button>
      <button type="button" onClick={onDone} className="inline-flex h-6 items-center rounded-full border border-orange/60 bg-orange/10 px-3 text-[0.68rem] font-mono leading-none tracking-wider text-orange hover:bg-orange/20 transition-colors">{t("DONE", "FERTIG")}</button>
    </div>
  );
}

function DragGrip({ bind }: { bind: ReturnType<typeof useDragCard>["bind"] }) {
  const t = useT();
  return (
    <div
      {...bind}
      title={t("Drag to move this card", "Zum Verschieben ziehen")}
      className="nodrag nopan -mx-3 -mt-3 mb-2 h-5 rounded-t-xl cursor-grab active:cursor-grabbing flex items-center justify-center select-none touch-none bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
    >
      <span className="font-mono text-[0.6rem] tracking-[0.35em] text-muted/60 leading-none">⋮⋮⋮</span>
    </div>
  );
}

const FlowNodeView = memo(function FlowNodeView({ data, selected, dragging, positionAbsoluteY }: NodeProps<RFNode>) {
  const card = useDragCard();
  const resetCard = card.setO;
  useEffect(() => { if (!selected) resetCard({ x: 0, y: 0 }); }, [selected, resetCard]);
  const t = useT();
  // open the editor above the step when it sits in the lower half of the screen
  const flipUp = useStore((st) => st.transform[1] + positionAbsoluteY * st.transform[2] > st.height * 0.5);
  const { node, actor, actors, editing } = data;
  const info = nodeTypeInfo(node.type);
  const tx = useTx();
  const wave = Math.min(4200, Math.max(0, node.x * 2.2)); // left → right sweep when the language changes
  const [hoverNode, setHoverNode] = useState(false);
  // while a box/multi selection is active the cards stay closed so the canvas is visible
  const peerN = useContext(PeerCtx);
  const lockN = useContext(LockCtx);
  const quietStore = useStore((st) => st.userSelectionActive || st.nodes.filter((n) => n.selected && n.id !== "__bounds").length > 1);
  const quiet = peerN || quietStore;
  const [plusVis, setPlusVis] = useState(false);
  const plusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); if (plusTimer.current) clearTimeout(plusTimer.current); }, []);
  const plusOn = () => {
    if (plusTimer.current) clearTimeout(plusTimer.current);
    setPlusVis(true);
  };
  const plusOff = () => {
    if (plusTimer.current) clearTimeout(plusTimer.current);
    plusTimer.current = setTimeout(() => setPlusVis(false), 350);
  };
  const [draft, setDraft] = useState(node.label);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setDraft(node.label), [node.label, editing]);

  const isStart = node.type === "start";
  const isEnd = node.type === "end";
  const color = isStart ? "#f8991d" : isEnd ? "#93a5b6" : (actor?.color ?? NEUTRAL);
  const w = NODE_W;
  const h = NODE_H;

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) return;
    const ids = [0, 60, 200].map((ms) => setTimeout(() => inputRef.current?.focus(), ms));
    return () => ids.forEach(clearTimeout);
  }, [editing]);

  const commit = () => data.onCommitLabel(node.id, draft.trim());

  const labelEl = editing ? (
    <input
      ref={inputRef}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") data.onCancelEdit();
      }}
      onFocus={(e) => e.currentTarget.select()}
      className="nodrag nopan w-full bg-transparent text-center text-[0.81rem] leading-tight outline-none border-b border-orange/60"
      placeholder={t("Name this step", "Schritt benennen")}
    />
  ) : (
    <div
      title={node.label ? tx(node.label) : undefined}
      className={`w-full text-center text-[0.81rem] leading-tight truncate ${
        node.label ? "" : "text-muted/60 italic"
      }`}
    >
      {node.label ? <Tx text={node.label} d={wave} /> : t("Double-click to name", "Doppelklick zum Benennen")}
    </div>
  );

  return (
    <div
      onMouseEnter={() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => { setHoverNode(true); plusOn(); }, HOVER_DELAY);
      }}
      onMouseLeave={() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setHoverNode(false);
        plusOff();
      }}
      onMouseDownCapture={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setHoverNode(false); }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (peerN || lockN) return;
        data.onStartEdit(node.id);
      }}
      className="relative group"
      style={{
        width: w,
        height: h,
        outline: selected ? "2px solid rgba(248,153,29,.85)" : "none",
        outlineOffset: 4,
        borderRadius: 18,
        opacity: data.dim ? (data.soft ? 0.75 : 0.2) : 1,
        filter: data.dim && !data.soft ? "grayscale(0.8)" : undefined,
        transition: "opacity .35s ease, filter .35s ease",
        cursor: data.selecting ? "pointer" : undefined,
      }}
    >
      {data.ring && (
        <div
          className="absolute pointer-events-none"
          style={{ inset: -7, borderRadius: 22, border: `2px solid ${data.ring}`, boxShadow: `0 0 18px ${data.ring}88` }}
        />
      )}
      {!isStart && !isEnd && (data.commentCount > 0 || hoverNode) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenComments(node.id);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          title={data.commentCount > 0 ? t("Comments on this step", "Kommentare zu diesem Schritt") : t("Add a comment", "Kommentar hinzufügen")}
          className="nodrag nopan absolute -top-3 -right-3 z-10 h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center gap-1 text-[0.68rem] font-mono border transition-colors"
          style={
            data.commentCount > 0
              ? { background: "#f8991d", color: "#14161c", borderColor: "rgba(0,0,0,.35)" }
              : { background: "var(--tint-solid)", color: "var(--muted, #93a5b6)", borderColor: "rgba(255,255,255,.2)" }
          }
        >
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3.5C2 2.7 2.7 2 3.5 2h9c.8 0 1.5.7 1.5 1.5v6c0 .8-.7 1.5-1.5 1.5H8l-3 3v-3H3.5C2.7 11 2 10.3 2 9.5z" fill="currentColor" />
          </svg>
          {data.commentCount > 0 && data.commentCount}
        </button>
      )}
      {data.badges.length > 0 && (
        <div className="absolute -bottom-2 right-2 flex gap-1 pointer-events-none">
          {data.badges.map((c, i) => (
            <span key={i} className="w-3 h-3 rounded-full border border-black/50" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
          ))}
        </div>
      )}
      {data.selecting && (
        <div
          className="absolute -top-2 -left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[0.65rem] font-bold pointer-events-none"
          style={{
            borderColor: data.ring ?? "#f8991d",
            background: data.ring ? data.ring : "var(--tint-ring)",
            color: data.ring ? "#0a1119" : "transparent",
          }}
        >
          {data.ring ? "✓" : ""}
        </div>
      )}
      {isStart || isEnd ? (
        <div
          className="absolute inset-0 rounded-full glass-rim"
          style={{
            border: `1.5px solid ${color}${isStart ? "80" : "b8"}`,
            background: isStart
              ? "radial-gradient(circle at 28% 28%, rgba(248,153,29,.2), var(--tint-node) 70%)"
              : "linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.03)), var(--tint-node)",
            backdropFilter: "blur(14px) saturate(125%)",
            WebkitBackdropFilter: "blur(14px) saturate(125%)",
            boxShadow: isStart
              ? "0 0 14px rgba(248,153,29,.16), inset 0 0 10px rgba(248,153,29,.1), inset 0 1px 0 rgba(255,255,255,.3)"
              : "0 2px 10px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.25)",
          }}
        />
      ) : (
        <ShapeBody kind={actor?.kind ?? null} color={color} dashed={!actor} glow={selected} />
      )}

      <div
        className="absolute inset-0 flex items-center justify-center gap-2 px-5"
        style={{ paddingLeft: isStart || isEnd ? 14 : 22, paddingRight: isStart || isEnd ? 14 : 22 }}
      >
        {isStart && <span className="text-orange text-sm flex-none">▶</span>}
        {isEnd && <span className="flex-none"><GroundSymbol size={22} /></span>}
        <div className="min-w-0 flex-1 flex flex-col items-center justify-center">
          {labelEl}
          {!isStart && !isEnd && (
            <div className="mt-1 w-full min-w-0 flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 font-mono text-[0.74rem] tracking-[0.06em] uppercase text-muted whitespace-nowrap">
                <span style={{ color }}>{info.glyph}</span>
                <span>{t(info.en, info.de)}</span>
              </div>
              {actor && (
                <div className="w-full truncate text-center text-[0.8rem] leading-none" style={{ color }} title={tx(actor.name)}>
                  <Tx text={actor.name} d={wave + 120} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {HANDLES.map((hd) => (
        <Handle
          key={hd.id}
          id={hd.id}
          type="source"
          position={hd.pos}
          className="!w-3 !h-3 !bg-orange !border-2 !border-[#0a1119] opacity-0 hover:opacity-100 group-hover:opacity-100"
          style={{ opacity: selected ? 1 : undefined }}
        />
      ))}

      <NodeToolbar position={Position.Right} offset={12} isVisible={(selected || plusVis) && !quiet && !lockN && !dragging && !editing && node.type !== "end"}>
        <button
          onMouseEnter={plusOn}
          onMouseLeave={plusOff}
          onClick={() => { setHoverNode(false); data.onAddNext(node.id); }}
          title={t("Add the next step", "Nächsten Schritt hinzufügen")}
          className="nodrag nopan w-7 h-7 rounded-full border border-orange/60 bg-orange/15 text-orange text-lg leading-none flex items-center justify-center hover:bg-orange/30 transition-colors"
        >
          +
        </button>
      </NodeToolbar>

      <NodeToolbar position={flipUp ? Position.Top : Position.Bottom} offset={14} isVisible={hoverNode && !quiet && !selected && !dragging && !editing}>
        <div className="glass glass-bright glass-dense glass-pop w-72 rounded-xl p-3 text-[0.8rem] pointer-events-none">
          <div className="font-medium text-[0.86rem] mb-1">{node.label ? tx(node.label) : t("Untitled step", "Schritt ohne Namen")}</div>
          <div className="flex gap-2"><span className="text-text/60 w-14 flex-none">{t("Type", "Typ")}</span><span>{info.glyph} {t(info.en, info.de)}</span></div>
          <div className="flex gap-2"><span className="text-text/60 w-14 flex-none">{t("Owner", "Zuständig")}</span><span style={actor?.color ? { color: actor.color } : undefined}>{actor ? tx(actor.name) : t("— no owner yet —", "— noch niemand —")}</span></div>
          {node.description && <div className="mt-2 pt-2 border-t border-white/10 text-text/80 whitespace-pre-wrap">{tx(node.description)}</div>}
        </div>
      </NodeToolbar>

      <NodeToolbar position={flipUp ? Position.Top : Position.Bottom} offset={14} isVisible={selected && !quiet && !lockN && !dragging}>
        <div
          className="nodrag nopan glass glass-bright glass-dense glass-pop w-72 max-h-[70vh] overflow-y-auto rounded-xl p-3 text-[0.8rem]"
          style={{ position: "relative", left: card.o.x, top: card.o.y }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <DragGrip bind={card.bind} />
          <div className="font-mono text-[0.62rem] tracking-[0.14em] text-muted/80 mb-1">{t("STEP NAME", "SCHRITTNAME")}</div>
          <input
            key={node.id + node.label}
            defaultValue={node.label}
            maxLength={120}
            placeholder={t("Name this step", "Schritt benennen")}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== node.label) data.onPatch(node.id, { label: v });
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={INPUT_CLS + " mb-3 !text-[0.86rem] font-medium"}
          />
          <div className="font-mono text-[0.62rem] tracking-[0.14em] text-muted/80 mb-1.5">{t("TYPE", "TYP")}</div>
          <div className="flex gap-1 mb-3">
            {NODE_TYPES.map((nt) => {
              // a workflow's Start is created with it; no other step can become one
              const locked = nt.key === "start" && node.type !== "start";
              return (
                <button
                  key={nt.key}
                  disabled={locked}
                  title={
                    locked
                      ? t("Start is created with the process — one per process", "Der Start entsteht mit dem Prozess – nur einer pro Prozess")
                      : `${t(nt.en, nt.de)} — ${t(nt.hint, nt.hintDe)}`
                  }
                  onClick={() => setErr(data.onPatch(node.id, { type: nt.key as NodeType }))}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-md border pt-1 pb-1.5 leading-none transition-colors ${
                    locked
                      ? "border-white/5 text-muted/25 cursor-not-allowed"
                      : node.type === nt.key
                        ? "border-orange/70 bg-orange/15 text-orange"
                        : "border-white/10 text-muted hover:text-text"
                  }`}
                >
                  <span className="font-mono text-[0.56rem] tracking-[0.02em] uppercase">{t(TYPE_SHORT[nt.key][0], TYPE_SHORT[nt.key][1])}</span>
                  <span className="text-[0.95rem]">{nt.glyph}</span>
                </button>
              );
            })}
          </div>
          <div className="text-[0.72rem] text-muted mb-2 -mt-1.5">
            {t(info.en, info.de)} — {t(info.hint, info.hintDe)}
          </div>

          {!isStart && !isEnd && (
            <>
              <div className="font-mono text-[0.62rem] tracking-[0.14em] text-muted/80 mb-1">{t("OWNER", "ZUSTÄNDIG")}</div>
              <select
                value={node.actor_id ?? ""}
                onChange={(e) => setErr(data.onPatch(node.id, { actor_id: e.target.value || null }))}
                className={INPUT_CLS + " mb-3"}
              >
                <option value="">{t("— no owner yet —", "— noch niemand —")}</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id} className="bg-[#0b1020]">
                    {tx(a.name)}
                    {a.role ? ` · ${tx(a.role)}` : ""}
                  </option>
                ))}
              </select>
            </>
          )}

          {!isStart && !isEnd && (
            <>
              <TimeField key={node.id + "d"} label={t("TIME IN THIS STEP", "DAUER DES SCHRITTS")} minutes={node.duration_minutes} onSave={(m) => setErr(data.onPatch(node.id, { duration_minutes: m }))} />
              <TimeField key={node.id + "w"} label={t("WAITS BEFORE IT STARTS", "WARTET VOR DEM START")} minutes={node.wait_minutes} onSave={(m) => setErr(data.onPatch(node.id, { wait_minutes: m }))} />
            </>
          )}
          <div className="font-mono text-[0.62rem] tracking-[0.14em] text-muted/80 mb-1">{t("DESCRIPTION", "BESCHREIBUNG")}</div>
          <textarea
            key={node.id + node.description + tx(node.description)}
            defaultValue={tx(node.description)}
            rows={3}
            placeholder={t("What happens here, and why does it matter?", "Was passiert hier, und warum ist es wichtig?")}
            onFocus={(e) => {
              // editing always happens on what was actually written
              e.target.value = node.description ?? "";
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (node.description ?? "")) data.onPatch(node.id, { description: v || null });
              else e.target.value = tx(node.description);
            }}
            className={INPUT_CLS + " resize-none"}
          />
          {err && <div className="mt-2 text-[0.75rem] text-red-300">{err}</div>}
          <CardFooter onDelete={() => data.onDelete(node.id)} onDone={data.onClose} />
        </div>
      </NodeToolbar>
    </div>
  );
});

/** Minutes with a small unit picker (minutes / hours / days). Saves on blur or when the unit changes. */
function TimeField({ label, minutes, onSave }: { label: string; minutes: number | null | undefined; onSave: (m: number | null) => void }) {
  const t = useT();
  const wp = waitParts(minutes);
  const [v, setV] = useState(wp.v);
  const [u, setU] = useState<(typeof WAIT_UNITS)[number]["key"]>(wp.unit.key);
  const save = (val: string, unit: string) => {
    const n = parseFloat(val.replace(",", "."));
    const mult = WAIT_UNITS.find((x) => x.key === unit)!.mult;
    const m = Number.isFinite(n) && n > 0 ? Math.round(n * mult) : null;
    if (m !== (minutes ?? null)) onSave(m);
  };
  return (
    <div className="mb-3">
      <div className="font-mono text-[0.62rem] tracking-[0.14em] text-muted/80 mb-1">{label}</div>
      <div className="flex gap-1.5">
        <input value={v} inputMode="decimal" onChange={(e) => setV(e.target.value)} onBlur={() => save(v, u)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder="0" className={INPUT_CLS + " !w-16"} />
        <select value={u} onChange={(e) => { setU(e.target.value as any); save(v, e.target.value); }} className={INPUT_CLS + " flex-1"}>
          {WAIT_UNITS.map((x) => (
            <option key={x.key} value={x.key} className="bg-[#0b1020]">{t(x.en, x.de)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function fmtWait(m: number | null | undefined, lang: (en: string, de: string) => string) {
  if (!m) return "";
  const { v, unit } = waitParts(m);
  return `${v} ${lang(unit.en, unit.de)}`;
}

const SM_LABEL = "font-mono text-[0.62rem] tracking-[0.14em] uppercase text-text/70 mb-1";
const SM_FIELD = "nodrag nopan nowheel w-full bg-black/40 border border-white/15 rounded-md text-[0.8rem] text-text px-2 py-1.5 outline-none focus:border-orange/60 placeholder:text-text/40";

/** Editor for the "smarts" on a line: what moves, how, wait, friction, note. */
function SmartsEditor({ id, data }: { id: string; data: EdgeData }) {
  const t = useT();
  const rf = useReactFlow();
  const card = useDragCard(() => rf.getZoom());
  const s = data.smarts;
  const wp = waitParts(s.wait_minutes);
  const [payload, setPayload] = useState(s.payload ?? "");
  const [channel, setChannel] = useState(s.channel ?? "");
  const [wv, setWv] = useState(wp.v);
  const [wu, setWu] = useState<(typeof WAIT_UNITS)[number]["key"]>(wp.unit.key);
  const [note, setNote] = useState(s.note ?? "");
  const saveWait = (v: string, u: string) => {
    const n = parseFloat(v.replace(",", "."));
    const mult = WAIT_UNITS.find((x) => x.key === u)!.mult;
    const m = Number.isFinite(n) && n > 0 ? Math.round(n * mult) : null;
    if (m !== (s.wait_minutes ?? null)) data.onSmarts(id, { wait_minutes: m });
  };
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 w-72 glass glass-bright glass-dense glass-pop rounded-xl p-3 text-left text-[0.8rem] space-y-3 whitespace-normal" style={{ marginLeft: card.o.x, marginTop: card.o.y }} onMouseDown={(e) => e.stopPropagation()}>
      <DragGrip bind={card.bind} />
      <div>
        <div className={SM_LABEL}>{t("What moves", "Was wird übergeben")}</div>
        <input value={payload} onChange={(e) => setPayload(e.target.value)} onBlur={() => payload.trim() !== (s.payload ?? "") && data.onSmarts(id, { payload: payload.trim() || null })} placeholder={t("e.g. signed order PDF", "z. B. unterschriebener Auftrag (PDF)")} className={SM_FIELD} />
      </div>
      <div>
        <div className={SM_LABEL}>{t("How it moves", "Wie wird es übergeben")}</div>
        <input list={`ch-${id}`} value={channel} onChange={(e) => setChannel(e.target.value)} onBlur={() => channel.trim() !== (s.channel ?? "") && data.onSmarts(id, { channel: channel.trim() || null })} placeholder={t("Email, system, phone…", "E-Mail, System, Telefon…")} className={SM_FIELD} />
        <datalist id={`ch-${id}`}>
          {CHANNELS.map((c) => (
            <option key={c.en} value={t(c.en, c.de)} />
          ))}
        </datalist>
      </div>
      <div>
        <div className={SM_LABEL}>{t("Typical wait", "Typische Wartezeit")}</div>
        <div className="flex gap-1.5">
          <input value={wv} inputMode="decimal" onChange={(e) => setWv(e.target.value)} onBlur={() => saveWait(wv, wu)} placeholder="0" className={SM_FIELD + " !w-16"} />
          <select value={wu} onChange={(e) => { setWu(e.target.value as any); saveWait(wv, e.target.value); }} className={SM_FIELD + " flex-1"}>
            {WAIT_UNITS.map((u) => (
              <option key={u.key} value={u.key}>{t(u.en, u.de)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div className={SM_LABEL}>{t("Friction", "Reibung")}</div>
        <div className="flex gap-1">
          {FRICTIONS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => data.onSmarts(id, { friction: s.friction === f.key ? null : f.key })}
              className="flex-1 rounded-full border py-0.5 text-[0.68rem] transition-colors"
              style={s.friction === f.key ? { borderColor: f.color, color: f.color, background: `${f.color}22` } : { borderColor: "rgb(var(--c-white) / .2)", color: "rgb(var(--c-text) / .75)" }}
            >
              {t(f.en, f.de)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={SM_LABEL}>{t("How much travels here", "Wie viel läuft hier durch")}</div>
        <div className="flex gap-1">
          {WEIGHTS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => data.onSmarts(id, { weight: s.weight === w.key ? null : w.key })}
              className={`flex-1 rounded-full border py-0.5 text-[0.68rem] transition-colors ${s.weight === w.key ? "border-orange text-orange bg-orange/15" : "border-white/20 text-text/75"}`}
            >
              {t(w.en, w.de)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={SM_LABEL}>{t("Note", "Notiz")}</div>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note.trim() !== (s.note ?? "") && data.onSmarts(id, { note: note.trim() || null })} placeholder={t("What happens here, and what goes wrong?", "Was passiert hier – und was geht schief?")} className={SM_FIELD + " resize-none"} />
      </div>
      <CardFooter onDelete={() => data.onDelete(id)} onDone={() => data.onSelect(null)} />
    </div>
  );
}

/** Read-only hover card. */
/** Peer mode: the process is lifted and tilted for looking only, so every editing surface stands down. */
// the "Loom is reading your process" pass plays once per process per visit (kept for the browser session)
const SCAN_STORE = "loom_scanned";
function hasScanned(key: string) {
  try {
    return (JSON.parse(sessionStorage.getItem(SCAN_STORE) || "[]") as string[]).includes(key);
  } catch {
    return false;
  }
}
function markScanned(key: string) {
  try {
    const cur = JSON.parse(sessionStorage.getItem(SCAN_STORE) || "[]") as string[];
    if (!cur.includes(key)) sessionStorage.setItem(SCAN_STORE, JSON.stringify([...cur, key]));
  } catch {
    /* storage blocked: the pass just plays each time */
  }
}

const PeerCtx = createContext(false);
const LockCtx = createContext(false); // locked process/workspace: hides editors, keeps hover cards

/** Hover explainer for toolbar buttons: wait a beat, then show what it is and how it works. */
function InfoTip({ title, body, how, side = "below", children }: { title: string; body: string; how?: string; side?: "below" | "left" | "above"; children: ReactNode }) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark";
  return (
    <div
      className="relative"
      onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOn(true), 600); }}
      onMouseLeave={() => { if (timer.current) clearTimeout(timer.current); setOn(false); }}
      onMouseDownCapture={() => { if (timer.current) clearTimeout(timer.current); setOn(false); }}
    >
      {children}
      {on && (
        <div
          className={`absolute z-50 w-60 rounded-xl p-3 text-left pointer-events-none glass glass-bright ${side === "left" ? "right-full mr-2 top-0" : side === "above" ? "right-0 bottom-full mb-2" : "left-0 top-full mt-2"}`}
          style={{ background: theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(12,16,26,0.98)" }}
        >
          <div className="font-mono text-[0.62rem] tracking-[0.14em] text-orange uppercase">{title}</div>
          <div className="mt-1 text-[0.76rem] leading-snug text-text/90 normal-case font-normal tracking-normal">{body}</div>
          {how && <div className="mt-1.5 text-[0.7rem] leading-snug text-muted normal-case font-normal tracking-normal">{how}</div>}
        </div>
      )}
    </div>
  );
}

function SmartsCard({ data, label }: { data: EdgeData; label: string | null }) {
  const t = useT();
  const tx = useTx();
  const s = data.smarts;
  const fr = FRICTIONS.find((f) => f.key === s.friction);
  const hasAny = !!(s.payload || s.channel || s.wait_minutes || s.friction || s.note);
  const rows: [string, string][] = [
    [t("What moves", "Was wird übergeben"), s.payload ? tx(s.payload) : ""],
    [t("How", "Wie"), s.channel ? tx(s.channel) : ""],
    [t("Wait", "Wartezeit"), fmtWait(s.wait_minutes, t)],
  ];
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-4 w-72 glass glass-bright glass-dense glass-pop rounded-xl p-3 text-left text-[0.8rem] whitespace-normal pointer-events-none z-10">
      {label && <div className="font-medium mb-1.5">{tx(label)}</div>}
      <div className="space-y-1">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-text/60 w-[4.6rem] flex-none">{k}</span>
            <span className="flex-1">{v}</span>
          </div>
        ))}
        {fr && (
          <div className="flex gap-2 items-center">
            <span className="text-text/60 w-[4.6rem] flex-none">{t("Friction", "Reibung")}</span>
            <span className="inline-flex items-center gap-1.5" style={{ color: fr.color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: fr.color }} />
              {t(fr.en, fr.de)}
            </span>
          </div>
        )}
      </div>
      {!hasAny && <div className="text-text/60">{t("No details yet — click the label to add what moves, how, the wait and the friction.", "Noch keine Details – Beschriftung anklicken, um Übergabe, Weg, Wartezeit und Reibung zu erfassen.")}</div>}
      {s.note && <div className="mt-2 pt-2 border-t border-white/10 text-text/80 whitespace-pre-wrap">{tx(s.note)}</div>}
    </div>
  );
}

// ------------------------------------------------------------- edge view --
const FlowEdgeView = memo(function FlowEdgeView(props: EdgeProps<RFEdge>) {
  const t = useT();
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected: selectedRaw, data, markerEnd } = props;
  const peerE = useContext(PeerCtx);
  const lockE = useContext(LockCtx);
  const selected = selectedRaw && !peerE && !lockE;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const quietEdge = useStore((st) => st.userSelectionActive);
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (edgeTimer.current) clearTimeout(edgeTimer.current); }, []);
  const zoom = useStore((st) => st.transform[2]);
  const sm = data?.smarts;
  const hasSmarts = !!sm && !!(sm.payload || sm.channel || sm.wait_minutes || sm.friction || sm.note);
  const frColor = FRICTIONS.find((f) => f.key === sm?.friction)?.color;
  const [draft, setDraft] = useState(data?.label ?? "");
  useEffect(() => setDraft(data?.label ?? ""), [data?.label]);
  const kindInfo = edgeKindInfo(data?.kind);
  const stroke = data?.color ?? kindInfo.color;

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== (data?.label ?? "")) data?.onLabel(id, draft.trim());
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: (WEIGHTS.find((w) => w.key === sm?.weight)?.px ?? 1.9) + (selectedRaw ? 0.9 : 0), filter: selectedRaw ? `drop-shadow(0 0 5px ${stroke})` : undefined, strokeDasharray: kindInfo.dash, strokeLinecap: kindInfo.dash ? "round" : "butt", opacity: data?.dim ? (data.soft ? 0.7 : 0.12) : 1, transition: "opacity .35s ease" }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          onMouseEnter={() => {
            if (edgeTimer.current) clearTimeout(edgeTimer.current);
            edgeTimer.current = setTimeout(() => setHover(true), HOVER_DELAY);
          }}
          onMouseLeave={() => {
            if (edgeTimer.current) clearTimeout(edgeTimer.current);
            setHover(false);
          }}
          onMouseDownCapture={() => { if (edgeTimer.current) clearTimeout(edgeTimer.current); setHover(false); }}
        >
          <div className="absolute left-1/2 top-1/2 w-0 h-0" style={{ transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}>
          {hover && !quietEdge && !peerE && !selected && !editing && (hasSmarts || !!data?.label) && data && <SmartsCard data={data} label={data.label} />}
          {selected && (
            <div className="absolute left-1/2 -translate-x-1/2 -top-[5.4rem] glass glass-bright glass-dense glass-pop flex flex-col items-center gap-1.5 rounded-2xl p-1.5 whitespace-nowrap">
             <div className="flex gap-1">
              {EDGE_KINDS.map((k) => (
                <button
                  key={k.key}
                  title={`${t(k.en, k.de)} — ${t(k.hint, k.hintDe)}`}
                  onClick={() => data?.onKind(id, k.key)}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] ${
                    (data?.kind ?? "flow") === k.key ? "bg-orange/20 text-orange" : "text-muted hover:text-text"
                  }`}
                >
                  <svg width="22" height="6" aria-hidden>
                    <line x1="1" y1="3" x2="21" y2="3" stroke={k.color} strokeWidth="2" strokeDasharray={k.dash} strokeLinecap={k.dash ? "round" : "butt"} />
                  </svg>
                  {t(k.en, k.de)}
                </button>
              ))}
             </div>
             <div className="flex items-center gap-1.5 px-1 pb-0.5">
              <button
                title={t("Automatic color (by line type)", "Automatische Farbe (nach Linienart)")}
                onClick={() => data?.onColor(id, null)}
                className="w-[18px] h-[18px] rounded-full border-2 text-[0.55rem] leading-none text-muted"
                style={{ borderColor: !data?.color ? "#fff" : "rgba(255,255,255,.25)" }}
              >
                A
              </button>
              {PALETTE.map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => data?.onColor(id, c)}
                  className="w-[18px] h-[18px] rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: data?.color === c ? "#fff" : "transparent" }}
                />
              ))}
             </div>
            </div>
          )}
          {selected && data && <SmartsEditor id={id} data={data} />}
          </div>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={t("e.g. approved", "z. B. genehmigt")}
              className="glass w-28 rounded-full !border-orange/60 px-2.5 py-1 text-[0.78rem] text-center outline-none"
            />
          ) : data?.label ? (
            <button
              onClick={() => data?.onSelect(id)}
              onDoubleClick={() => setEditing(true)}
              className="glass rounded-full px-2.5 py-0.5 text-[0.78rem] text-text inline-flex items-center gap-1.5"
            >
              {frColor && <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: frColor }} />}
              <Tx text={data.label} d={400} />
              {hasSmarts && !frColor && <span className="w-1 h-1 rounded-full bg-orange/70 flex-none" />}
            </button>
          ) : selected ? (
            <button
              onClick={() => setEditing(true)}
              className="glass rounded-full !border-orange/50 px-2.5 py-0.5 text-[0.75rem] text-orange"
            >
              + {t("label", "Beschriftung")}
            </button>
          ) : hasSmarts ? (
            <span className="block w-2.5 h-2.5 rounded-full border border-white/40" style={{ background: frColor ?? "rgb(var(--c-muted))" }} />
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

// invisible anchor at the canvas origin so "fit view" keeps the lane labels in frame
const BoundsNode = () => null;
const BOUNDS_NODE = { id: "__bounds", type: "bounds", position: { x: 0, y: 0 }, data: {}, width: 1, height: 1, selectable: false, draggable: false, focusable: false, connectable: false, deletable: false, style: { pointerEvents: "none", opacity: 0 } } as unknown as RFNode;
const nodeTypes = { flow: FlowNodeView, bounds: BoundsNode };
const edgeTypes = { flow: FlowEdgeView };

// ---------------------------------------------------------------- canvas --
export type CanvasProps = {
  lanes: Lane[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  actors: Actor[];
  onAddNode: (x: number, laneId: string, yOffset: number, label?: string) => Promise<string | null>;
  onMoveNode: (id: string, x: number, laneId: string, yOffset: number) => void;
  onPatchNode: (id: string, patch: Partial<FlowNode>) => string | null;
  onDeleteNodes: (ids: string[]) => void;
  onConnect: (from: string, to: string, sourceHandle: string | null, targetHandle: string | null) => Promise<string | null | void> | void;
  onPatchEdge: (id: string, patch: EdgePatch) => void;
  onNotice: (msg: string, kind?: "error" | "info") => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteEdges: (ids: string[]) => void;
  focus: Focus | null;
  onFocusToggle: (nodeId: string) => void;
  processName?: string;
  commentCounts: Record<string, number>;
  onOpenComments: (nodeId: string) => void;
  onCopyNodes: (ids: string[]) => void;
  onGuide?: () => void;
  /** View-only: the process (or its whole workspace) is locked. */
  locked?: boolean;
  lockSource?: "process" | "workspace" | null;
  canLock?: boolean; // owners and admins
  onToggleLock?: () => void;
  onPasteNodes: () => void;
  pins: FlowPin[];
  plans: { roadmaps: Roadmap[]; phases: RoadmapPhase[]; phaseNodes: PhaseNode[] };
  focusPin?: { id: string; n: number } | null; // set by the Pursuits list: open Insights and jump to this pin
  onAddPin: (a: { node_id?: string | null; edge_id?: string | null; kind: PinKind; body?: string; parent_id?: string | null; origin?: string | null; status?: FlowPin["status"] }) => Promise<FlowPin | null>;
  onPatchPin: (id: string, patch: Partial<FlowPin>) => void;
  onDeletePin: (id: string) => void;
  canProbe?: boolean; // facilitator-only: shift-click two steps to light the circuit between them
};

function Inner(props: CanvasProps) {
  const t = useT();
  const tx = useTx();
  const theme = useTheme();
  const { lanes, nodes, edges, actors } = props;
  const focusProp = props.focus;
  const { screenToFlowPosition, flowToScreenPosition, zoomTo, zoomIn, zoomOut, fitView, fitBounds, getViewport, setCenter } = useReactFlow();
  const boxRef = useRef<HTMLDivElement>(null);
  const addNextRef = useRef<(id: string) => void>(() => {});
  const closeRef = useRef<() => void>(() => {});
  const selIdsRef = useRef<string[]>([]);
  const dragBoxRef = useRef(false);
  const boxEndRef = useRef(0);

  // ---- circuit probe: two probes (A, B) light every step and line on any route between them ----
  const [probe, setProbe] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });
  const [tallyOn, setTallyOn] = useState(false); // Selection Totals tool
  const [gapsOn, setGapsOn] = useState(false); // Time Gaps tool
  const [selMode, setSelMode] = useState(false); // false = hand (drag pans), true = select (drag draws a box)
  const [peerOn, setPeerOn] = useState(false); // Peer mode: look behind the process (-Z), editing paused
  const peerRef = useRef(false);
  const [pinOpen, setPinOpen] = useState<string | null>(null); // which pin / signal card is open in Insights
  const pinOpenRef = useRef<string | null>(null);
  pinOpenRef.current = pinOpen;
  const [probeOn, setProbeOn] = useState(false); // Circuit Tester switched on from the tools drawer
  const [drawer, setDrawer] = useState<null | "inquiry" | "intelligence" | "innovation">(null);
  const circuitRaw = useMemo(() => {
    if (!probe.a) return null;
    const ring = "#f8991d";
    if (!probe.b) return { none: false as const, pending: true as const, focus: { ids: new Set([probe.a]), ring, badges: new Map<string, string[]>(), selecting: false } as Focus };
    const flowEdges = edges.filter((e) => e.kind !== "info");
    const reach = (start: string, forward: boolean) => {
      const seen = new Set([start]);
      const stack = [start];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const e of flowEdges) {
          const [from, to] = forward ? [e.from_node_id, e.to_node_id] : [e.to_node_id, e.from_node_id];
          if (from === cur && !seen.has(to)) { seen.add(to); stack.push(to); }
        }
      }
      return seen;
    };
    let a = probe.a, b = probe.b;
    let fwd = reach(a, true);
    if (!fwd.has(b)) {
      const back = reach(b, true); // maybe the probes were placed end-first
      if (back.has(a)) { [a, b] = [b, a]; fwd = back; }
      else return { none: true as const, pending: false as const, focus: { ids: new Set([probe.a, probe.b]), ring, badges: new Map<string, string[]>(), selecting: false } as Focus };
    }
    const bwd = reach(b, false);
    const ids = new Set([...fwd].filter((id) => bwd.has(id)));
    const ce = flowEdges.filter((e) => ids.has(e.from_node_id) && ids.has(e.to_node_id));
    const nmap = new Map(nodes.map((n) => [n.id, n]));
    let inSteps = 0, stepWait = 0, lineWait = 0, handoffs = 0, rework = 0;
    ids.forEach((id) => { const n = nmap.get(id); inSteps += n?.duration_minutes ?? 0; stepWait += n?.wait_minutes ?? 0; });
    ce.forEach((e) => {
      lineWait += e.wait_minutes ?? 0;
      if (e.kind === "exception") rework++;
      if (nmap.get(e.from_node_id)?.lane_id !== nmap.get(e.to_node_id)?.lane_id) handoffs++;
    });
    const lanesTouched = new Set([...ids].map((id) => nmap.get(id)?.lane_id)).size;
    return { none: false as const, pending: false as const, steps: ids.size, lines: ce.length, handoffs, rework, lanes: lanesTouched, inSteps, waiting: stepWait + lineWait, total: inSteps + stepWait + lineWait, focus: { ids, ring, badges: new Map<string, string[]>(), selecting: false } as Focus };
  }, [probe, nodes, edges]);
  // a little drama: tracing a route takes a moment, longer for a longer route
  const [travKey, setTravKey] = useState("");
  const [trav, setTrav] = useState<number | null>(null);
  const pairKey = probe.a && probe.b ? `${probe.a}>${probe.b}` : "";
  const routeSize = circuitRaw && !circuitRaw.pending && !circuitRaw.none ? circuitRaw.steps : 0;
  const routeSizeRef = useRef(0);
  routeSizeRef.current = routeSize;
  useEffect(() => {
    if (!pairKey) { setTravKey(""); setTrav(null); return; }
    const ms = Math.min(6400, 1800 + routeSizeRef.current * 140);
    const start = Date.now();
    setTrav(0);
    const iv = setInterval(() => {
      const pc = Math.min(100, Math.round(((Date.now() - start) / ms) * 100));
      setTrav(pc);
      if (pc >= 100) { clearInterval(iv); setTravKey(pairKey); setTrav(null); }
    }, 60);
    return () => clearInterval(iv);
  }, [pairKey]);
  // the route's steps in the order a token would meet them: the trace lights them one after another
  const routeOrder = useMemo(() => {
    if (!circuitRaw || circuitRaw.pending || circuitRaw.none) return [] as string[];
    const ids = circuitRaw.focus.ids;
    const xOf = new Map(nodes.map((n) => [n.id, n.x]));
    // forward lines only: rework loops point backwards and would scramble the order
    const fe = edges.filter((e) => e.kind !== "info" && e.kind !== "exception" && ids.has(e.from_node_id) && ids.has(e.to_node_id));
    // a step lights only after every step that feeds it, so the trace never jumps ahead and leaves a gap behind
    const indeg = new Map<string, number>([...ids].map((id) => [id, 0]));
    fe.forEach((e) => indeg.set(e.to_node_id, (indeg.get(e.to_node_id) ?? 0) + 1));
    const depth = new Map<string, number>([...ids].map((id) => [id, 0]));
    const ready = [...ids].filter((id) => (indeg.get(id) ?? 0) === 0);
    const done = new Set<string>();
    while (ready.length) {
      const cur = ready.shift()!;
      done.add(cur);
      for (const e of fe) {
        if (e.from_node_id !== cur) continue;
        depth.set(e.to_node_id, Math.max(depth.get(e.to_node_id) ?? 0, (depth.get(cur) ?? 0) + 1));
        indeg.set(e.to_node_id, (indeg.get(e.to_node_id) ?? 1) - 1);
        if ((indeg.get(e.to_node_id) ?? 0) === 0) ready.push(e.to_node_id);
      }
    }
    // anything left sits in a loop of forward lines: place it by position
    const byPos = (u: string, v: string) => (depth.get(u) ?? 0) - (depth.get(v) ?? 0) || (xOf.get(u) ?? 0) - (xOf.get(v) ?? 0);
    const main = [...done].sort(byPos);
    const rest = [...ids].filter((id) => !done.has(id)).sort((u, v) => (xOf.get(u) ?? 0) - (xOf.get(v) ?? 0));
    return [...main, ...rest];
  }, [circuitRaw, edges, nodes]);
  const circuit = useMemo(() => {
    if (circuitRaw && pairKey && travKey !== pairKey && probe.a && probe.b) {
      const n = routeOrder.length;
      const k = n ? Math.max(1, Math.round((n * (trav ?? 0)) / 100)) : 0;
      const ids = n ? new Set(routeOrder.slice(0, k)) : new Set([probe.a, probe.b]);
      return { none: false as const, pending: true as const, focus: { ids, ring: "#f8991d", badges: new Map<string, string[]>(), selecting: false } as Focus };
    }
    return circuitRaw;
  }, [circuitRaw, pairKey, travKey, probe.a, probe.b, routeOrder, trav]);
  useEffect(() => {
    if (peerOn) { setProbeOn(false); setTallyOn(false); setGapsOn(false); setProbe({ a: null, b: null }); }
  }, [peerOn]);
  // Circuit Tester and Selection Totals are about picking steps: switch to the select cursor while they're in use, then hand the cursor back
  const pickTool = (probeOn || tallyOn) && drawer === "inquiry";
  const modeBefore = useRef<boolean | null>(null);
  useEffect(() => {
    if (pickTool) {
      if (modeBefore.current === null) { modeBefore.current = selMode; setSelMode(true); }
    } else if (modeBefore.current !== null) {
      setSelMode(modeBefore.current);
      modeBefore.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickTool]);
  const gaps = useMemo(() => (gapsOn ? nodes.filter((n) => n.type !== "start" && n.type !== "end" && !n.duration_minutes) : null), [gapsOn, nodes]);
  const gapFocus = useMemo(() => (gaps && gaps.length ? ({ ids: new Set(gaps.map((n) => n.id)), ring: "#f8991d", badges: new Map<string, string[]>(), selecting: false } as Focus) : null), [gaps]);
  const focus = circuit?.focus ?? gapFocus ?? focusProp;
  const fmtDur = (m: number) => {
    if (!m) return "0";
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
    const parts = [d && `${d}${t("d", "T")}`, h && `${h}${t("h", "Std")}`, !d && mi && `${mi}${t("min", "Min")}`].filter(Boolean);
    return parts.slice(0, 2).join(" ");
  };
  const zoom = useStore((st) => st.transform[2]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [grid, setGrid] = useState(false);
  const pendingSelect = useRef<string | null>(null);
  const [pending, setPending] = useState<{ x: number; laneId: string; yOffset: number; px: number; py: number; fromId?: string } | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  useEffect(() => {
    try { setGrid(localStorage.getItem("loom_grid") === "1"); } catch {}
  }, []);

  // Export the whole map (not just what is on screen) as a sharp PNG: lanes, steps and lines.
  const [exporting, setExporting] = useState(false);
  async function exportPng() {
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el || props.lanes.length === 0 || exporting) return;
    setExporting(true);
    props.onNotice(t("One second… downloading for you", "Einen Moment … der Download wird vorbereitet"), "info");
    // let the toast paint before the heavy image work blocks the main thread
    await new Promise((r) => setTimeout(r, 120));
    try {
      const maxRight = props.nodes.reduce((m, n) => Math.max(m, n.x + NODE_W), LANE_LABEL_W + NODE_W);
      const w = Math.min(laneW, Math.round(maxRight + 120));
      const h = props.lanes.length * LANE_H;
      const dataUrl = await toPng(el, {
        backgroundColor: theme === "light" ? "#eef2f7" : "#0a1119",
        width: w,
        height: h,
        pixelRatio: 2,
        cacheBust: true,
        fontEmbedCSS: "", // skip fetching cross-origin web-font CSS (it logs errors and slows the export)
        style: { width: `${w}px`, height: `${h}px`, transform: "translate(0px, 0px) scale(1)" },
      });
      const base = (props.processName || "process").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "process";
      const a = document.createElement("a");
      a.download = `loom-${base}.png`;
      a.href = dataUrl;
      a.click();
    } catch {
      props.onNotice(t("Could not export the image. Please try again.", "Das Bild konnte nicht exportiert werden. Bitte erneut versuchen."));
    } finally {
      setExporting(false);
    }
  }

  const toggleGrid = () =>
    setGrid((g) => {
      try { localStorage.setItem("loom_grid", g ? "0" : "1"); } catch {}
      return !g;
    });
  const actorMap = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);
  const laneIdx = useMemo(() => new Map(lanes.map((l, i) => [l.id, i])), [lanes]);
  // lane bands run at least LANE_W, and always reach past the right-most step
  const laneW = useMemo(() => Math.max(LANE_W, props.nodes.reduce((m, n) => Math.max(m, n.x + NODE_W), 0) + 400), [props.nodes]);

  const propsRef = useRef(props);
  propsRef.current = props;

  const commitLabel = useCallback((id: string, label: string) => {
    setEditingId(null);
    const n = propsRef.current.nodes.find((x) => x.id === id);
    if (n && n.label !== label) propsRef.current.onPatchNode(id, { label: label || "" });
  }, []);

  // ---- find a step: highlight matches, dim the rest ----
  const [query, setQuery] = useState("");
  const [matchPos, setMatchPos] = useState(0);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as FlowNode[];
    return nodes.filter((n) => {
      const hay = `${n.label ?? ""} ${n.description ?? ""} ${n.actor_id ? (actorMap.get(n.actor_id)?.name ?? "") : ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, nodes, actorMap]);
  const matchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);
  const searching = query.trim().length > 0;
  const jumpTo = useCallback(
    (i: number) => {
      if (!matches.length) return;
      const k = ((i % matches.length) + matches.length) % matches.length;
      setMatchPos(k);
      const n = matches[k];
      const y = (laneIdx.get(n.lane_id ?? "") ?? 0) * LANE_H + n.y_offset;
      setCenter(n.x + NODE_W / 2, y + NODE_H / 2, { zoom: Math.max(getViewport().zoom, 0.8), duration: 300 });
    },
    [matches, laneIdx, setCenter, getViewport]
  );
  const jumpedRef = useRef(false);
  useEffect(() => {
    setMatchPos(0);
    jumpedRef.current = false;
  }, [query]);

  const derived = useMemo<RFNode[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "flow",
        position: { x: n.x, y: (laneIdx.get(n.lane_id ?? "") ?? 0) * LANE_H + n.y_offset },
        data: {
          node: n,
          actor: n.actor_id ? (actorMap.get(n.actor_id) ?? null) : null,
          actors,
          editing: editingId === n.id,
          onStartEdit: setEditingId,
          onCommitLabel: commitLabel,
          onCancelEdit: () => setEditingId(null),
          onPatch: (id, patch) => propsRef.current.onPatchNode(id, patch),
          onDelete: (id) => propsRef.current.onDeleteNodes([id]),
          onClose: () => closeRef.current(),
          onAddNext: (id) => addNextRef.current(id),
          dim: (!!focus && !focus.selecting && !focus.ids.has(n.id)) || (searching && !matchIds.has(n.id)), // while picking steps, nothing is hidden
          ring: focus && focus.ids.has(n.id) ? focus.ring : searching && matchIds.has(n.id) ? "#f8991d" : null,
          badges: focus?.badges.get(n.id) ?? [],
          selecting: !!focus?.selecting,
          soft: !!circuit?.pending, // first probe placed: keep everything pickable
          commentCount: props.commentCounts[n.id] ?? 0,
          onOpenComments: (id) => propsRef.current.onOpenComments(id),
        },
      })),
    [nodes, laneIdx, actorMap, actors, editingId, commitLabel, focus, circuit, searching, matchIds, props.commentCounts]
  );

  const [rfNodes, setRfNodes] = useState<RFNode[]>(derived);
  const locked = !!props.locked;
  const frozen = peerOn || locked;
  peerRef.current = frozen;
  selIdsRef.current = rfNodes.filter((n) => n.selected && n.id !== "__bounds").map((n) => n.id);
  const peerTargets = useMemo(() => {
    if (!peerOn) return [] as { id: string; x: number; y: number; label: string | null }[];
    const nmap = new Map(nodes.map((n) => [n.id, n]));
    const center = (id: string) => {
      const n = nmap.get(id);
      return n ? { x: n.x + NODE_W / 2, y: (laneIdx.get(n.lane_id ?? "") ?? 0) * LANE_H + n.y_offset + NODE_H / 2 } : null;
    };
    const out: { id: string; x: number; y: number; label: string | null }[] = [];
    rfNodes.forEach((rn) => {
      if (!rn.selected || rn.id === "__bounds") return;
      const c = center(rn.id);
      if (c) out.push({ id: rn.id, x: c.x + NODE_W / 2, y: c.y, label: nmap.get(rn.id)?.label ?? null }); // right edge of the step
    });
    if (selEdge) {
      const e = edges.find((x) => x.id === selEdge);
      const b = e && center(e.to_node_id);
      if (e && b) out.push({ id: e.id, x: b.x - NODE_W / 2, y: b.y, label: e.label ?? null }); // arrowhead end of the line
    }
    return out;
  }, [peerOn, rfNodes, selEdge, nodes, edges, laneIdx]);
  const peerFocusKey = peerTargets.length ? peerTargets.map((x) => x.id).join(",") : "";
  useEffect(() => {
    if (!peerOn || !peerTargets.length) return;
    const tg = peerTargets[0];
    setCenter(tg.x + 190, tg.y, { zoom: 0.8, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerOn, peerFocusKey]);
  const allSignals = useMemo(() => computeSignals(nodes, edges), [nodes, edges]);
  // A little theatre: Loom "reads" the process for a few seconds when the layer opens, and the signals surface one by one.
  const [scan, setScan] = useState<number | null>(null);
  const [scanReq, setScanReq] = useState(0); // "Scan again" bumps this
  const scanKey = nodes[0]?.workflow_id ?? props.processName ?? "process";
  const scanHandled = useRef(0);
  useEffect(() => {
    if (!peerOn) { setScan(null); return; }
    // the reading is shown once per process per visit; after that the layer simply opens (Scan again repeats it)
    const forced = scanReq !== scanHandled.current;
    scanHandled.current = scanReq;
    if (!forced && hasScanned(scanKey)) { setScan(null); return; }
    const start = Date.now();
    const total = 3600;
    setScan(0);
    const iv = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - start) / total) * 100));
      setScan(p);
      if (p >= 100) { clearInterval(iv); markScanned(scanKey); setTimeout(() => setScan(null), 500); }
    }, 80);
    return () => clearInterval(iv);
  }, [peerOn, scanReq]);
  const signals = useMemo(() => (scan === null ? allSignals : allSignals.slice(0, Math.floor((allSignals.length * Math.max(0, scan - 20)) / 80))), [allSignals, scan]);
  const pinAnchor = useCallback(
    (tg: { node_id?: string | null; edge_id?: string | null }) => {
      const cen = (id: string) => {
        const n = nodes.find((x) => x.id === id);
        return n ? { x: n.x + NODE_W / 2, y: (laneIdx.get(n.lane_id ?? "") ?? 0) * LANE_H + n.y_offset + NODE_H / 2 } : null;
      };
      if (tg.node_id) {
        const a = cen(tg.node_id);
        return a ? { x: a.x + NODE_W / 2, y: a.y } : null; // right edge of the step
      }
      const e = edges.find((x) => x.id === tg.edge_id);
      const a = e && cen(e.from_node_id);
      const b = e && cen(e.to_node_id);
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null; // middle of the line
    },
    [nodes, edges, laneIdx]
  );
  const selNodeIds = useMemo(() => peerTargets.filter((x) => nodes.some((n) => n.id === x.id)).map((x) => x.id), [peerTargets, nodes]);
  useEffect(() => { if (!peerOn) setPinOpen(null); }, [peerOn]);
  const [eyeBig, setEyeBig] = useState(false); // bird's-eye map enlarged over the canvas
  const [hoverId, setHoverIdRaw] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHover = useCallback((id: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (id) setHoverIdRaw(id);
    else hoverTimer.current = setTimeout(() => setHoverIdRaw(null), 600);
  }, []);
  const describeSignal = useCallback(
    (s: Signal) => {
      const nm = (id: string) => nodes.find((n) => n.id === id);
      const laneName = (id?: string | null) => lanes.find((l) => l.id === id)?.name ?? "";
      const actorName = (id?: string | null) => actors.find((x) => x.id === id)?.name ?? "";
      if (s.node_id) {
        const n = nm(s.node_id);
        const ins = edges.filter((e) => e.to_node_id === s.node_id).map((e) => nm(e.from_node_id)?.label).filter(Boolean).join("; ");
        const outs = edges.filter((e) => e.from_node_id === s.node_id).map((e) => nm(e.to_node_id)?.label).filter(Boolean).join("; ");
        return { target: n?.label ?? "", lane: laneName(n?.lane_id), before: ins, after: outs, actor: actorName(n?.actor_id) };
      }
      const e = edges.find((x) => x.id === s.edge_id);
      const a = e && nm(e.from_node_id);
      const b = e && nm(e.to_node_id);
      return { target: `${a?.label ?? ""} → ${b?.label ?? ""}`, lane: laneName(a?.lane_id), before: a?.label ?? "", after: b?.label ?? "", actor: actorName(a?.actor_id) };
    },
    [nodes, edges, lanes, actors]
  );
  // every insight on the map, left to right: the bird's-eye markers and the hop buttons share this list
  const hopItems = useMemo(() => {
    const usedOrigins = new Set(props.pins.map((p) => p.origin).filter(Boolean) as string[]);
    const out: { key: string; x: number; y: number; color: string; dashed?: boolean; label: string }[] = [];
    for (const s of signals) {
      if (usedOrigins.has(s.key)) continue;
      const a = pinAnchor(s);
      if (a) out.push({ key: `sig:${s.key}`, x: a.x, y: a.y, color: s.level === "high" ? "#f97316" : "#fbbf24", dashed: true, label: t(s.en, s.de) });
    }
    for (const p of props.pins) {
      if (p.status === "dismissed") continue;
      const a = pinAnchor(p);
      if (a) out.push({ key: `pin:${p.id}`, x: a.x, y: a.y, color: PIN_KINDS[p.kind].color, label: p.body || t(PIN_KINDS[p.kind].en, PIN_KINDS[p.kind].de) });
    }
    return out.sort((u, v) => u.x - v.x || u.y - v.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, props.pins, pinAnchor]);
  const hopTo = useCallback(
    (key: string) => {
      const it = hopItems.find((h) => h.key === key);
      if (!it) return;
      setPinOpen(key);
      setCenter(it.x + 150, it.y + 60, { zoom: Math.max(getViewport().zoom, 0.8), duration: 500 });
    },
    [hopItems, setCenter, getViewport]
  );
  const hopToRef = useRef(hopTo);
  hopToRef.current = hopTo;
  const focusWasOn = useRef(false);
  focusWasOn.current = peerOn;
  useEffect(() => {
    const f = props.focusPin;
    if (!f) return;
    const wasOn = focusWasOn.current;
    markScanned(scanKey); // jumping to a pursuit goes straight to it, without the reading
    setPeerOn(true);
    const id = setTimeout(() => hopToRef.current(`pin:${f.id}`), wasOn ? 30 : 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focusPin?.n]);
  // the whole process in view: lane labels at the left edge to the last step at the right, with a small margin all round
  const fitAll = useCallback(() => {
    const right = nodes.reduce((m, n) => Math.max(m, n.x + NODE_W), 0);
    const width = Math.max(right + 40, 480);
    const height = Math.max(lanes.length, 1) * LANE_H;
    fitBounds({ x: 0, y: 0, width, height }, { padding: 0.03, duration: 300 });
  }, [nodes, lanes, fitBounds]);
  const eyeMap = (w: number, maxH: number) => (
    <BirdsEye
      boxes={nodes.map((n) => ({ id: n.id, x: n.x, y: (laneIdx.get(n.lane_id ?? "") ?? 0) * LANE_H + n.y_offset, w: NODE_W, h: NODE_H }))}
      bands={lanes.map((l, i) => ({ y: i * LANE_H, h: LANE_H, color: l.color }))}
      markers={hopItems}
      width={w}
      maxH={maxH}
      activeKey={pinOpen}
      onMarker={hopTo}
      onBackground={(x, y) => setCenter(x, y, { zoom: Math.max(getViewport().zoom, 0.6), duration: 500 })}
    />
  );
  const tally = useMemo(() => {
    if (!tallyOn) return null;
    const ids = new Set(rfNodes.filter((n) => n.selected && n.id !== "__bounds").map((n) => n.id));
    if (!ids.size) return { empty: true as const };
    const nmap = new Map(nodes.map((n) => [n.id, n]));
    let inSteps = 0, stepWait = 0, untimed = 0;
    ids.forEach((id) => { const n = nmap.get(id); const d = n?.duration_minutes ?? 0; inSteps += d; stepWait += n?.wait_minutes ?? 0; if (n && n.type !== "start" && n.type !== "end" && !d) untimed++; });
    const between = edges.filter((e) => e.kind !== "info" && ids.has(e.from_node_id) && ids.has(e.to_node_id));
    const lineWait = between.reduce((a, e) => a + (e.wait_minutes ?? 0), 0);
    const lanesTouched = new Set([...ids].map((id) => nmap.get(id)?.lane_id)).size;
    return { empty: false as const, steps: ids.size, lines: between.length, lanes: lanesTouched, inSteps, waiting: stepWait + lineWait, total: inSteps + stepWait + lineWait, untimed };
  }, [tallyOn, rfNodes, nodes, edges]);
  useEffect(() => {
    // keep xyflow's selection while data refreshes underneath it
    setRfNodes((prev) => {
      const sel = new Set(prev.filter((p) => p.selected).map((p) => p.id));
      const fresh = pendingSelect.current;
      if (fresh && derived.some((d) => d.id === fresh)) {
        // a step the person just named: select it so its editor opens right away
        sel.clear();
        sel.add(fresh);
        pendingSelect.current = null;
      }
      return [...derived.map((d) => (sel.has(d.id) ? { ...d, selected: true } : d)), BOUNDS_NODE];
    });
  }, [derived]);

  // Ctrl/Cmd+C copies the selected steps (and the lines between them), Ctrl/Cmd+V pastes, Ctrl/Cmd+D duplicates
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (peerRef.current || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "c" && selIdsRef.current.length) {
        propsRef.current.onCopyNodes(selIdsRef.current);
      } else if (k === "v") {
        e.preventDefault();
        propsRef.current.onPasteNodes();
      } else if (k === "d" && selIdsRef.current.length) {
        e.preventDefault();
        propsRef.current.onCopyNodes(selIdsRef.current);
        propsRef.current.onPasteNodes();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // V = select tool, H = hand tool
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "v") setSelMode(true);
      else if (k === "h") setSelMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Esc closes the open step / line card (they show while something is selected)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pinOpenRef.current) return; // first Esc just closes the open pin card
      setPeerOn(false);
      setProbe({ a: null, b: null });
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) (el as HTMLElement).blur();
      setSelEdge(null);
      setRfNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => (n.selected ? { ...n, selected: false } : n)) : nds));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onNodesChange: OnNodesChange<RFNode> = useCallback(
    (changes) => setRfNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const rfEdges = useMemo<RFEdge[]>(
    () =>
      edges.map((e) => ({
        id: e.id,
        type: "flow",
        source: e.from_node_id,
        target: e.to_node_id,
        sourceHandle: e.source_handle,
        targetHandle: e.target_handle,
        selected: e.id === selEdge,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: e.color ?? edgeKindInfo(e.kind).color },
        data: {
          label: e.label,
          color: e.color ?? null,
          onColor: (id, color) => propsRef.current.onPatchEdge(id, { color }),
          kind: e.kind ?? "flow",
          onLabel: (id, label) => propsRef.current.onPatchEdge(id, { label: label || null }),
          onKind: (id, kind) => propsRef.current.onPatchEdge(id, { kind }),
          onSelect: (id) => setSelEdge(id),
          onDelete: (id) => propsRef.current.onDeleteEdges([id]),
          smarts: { payload: e.payload ?? null, channel: e.channel ?? null, wait_minutes: e.wait_minutes ?? null, friction: e.friction ?? null, weight: e.weight ?? null, note: e.note ?? null },
          onSmarts: (id, patch) => propsRef.current.onPatchEdge(id, patch),
          dim: !!focus && !focus.selecting && !(focus.ids.has(e.from_node_id) && focus.ids.has(e.to_node_id)),
          soft: !!circuit?.pending,
        },
      })),
    [edges, focus, circuit, selEdge]
  );
  const onEdgesChange = useCallback((changes: any[]) => {
    // a box / multi selection must not pop a line card: only a lone edge click selects an edge
    const picks = changes.filter((c) => c.type === "select" && c.selected).length;
    for (const c of changes) {
      if (c.type !== "select") continue;
      if (c.selected && (dragBoxRef.current || Date.now() - boxEndRef.current < 700 || picks > 1)) continue;
      setSelEdge((cur) => (c.selected ? c.id : cur === c.id ? null : cur));
    }
  }, []);

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const { nodes: ns, edges: es } = propsRef.current;
      if (!c.source || !c.target || c.source === c.target) return false;
      const s = ns.find((n) => n.id === c.source);
      const tg = ns.find((n) => n.id === c.target);
      if (!s || !tg) return false;
      if (s.type === "end" || tg.type === "start") return false; // no ground-outs, no start-ins
      return !es.some((e) => e.from_node_id === c.source && e.to_node_id === c.target);
    },
    []
  );

  // dragging a line out of an End step (valid or not) never connects: say why
  const onConnectEnd = useCallback(
    (_: unknown, state: { fromNode?: { id: string } | null; isValid?: boolean | null }) => {
      const from = propsRef.current.nodes.find((n) => n.id === state.fromNode?.id);
      if (from?.type === "end" && !state.isValid)
        propsRef.current.onNotice(t("End steps cannot be upstream from another step.", "End-Schritte können keinem anderen Schritt vorausgehen."));
    },
    [t]
  );

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target) Promise.resolve(propsRef.current.onConnect(c.source, c.target, c.sourceHandle, c.targetHandle)).then((eid) => eid && setSelEdge(eid));
  }, []);

  const onNodeDragStop = useCallback(
    (_: unknown, node: RFNode) => {
      const ls = propsRef.current.lanes;
      if (ls.length === 0) return;
      const centerY = node.position.y + NODE_H / 2;
      const idx = Math.max(0, Math.min(ls.length - 1, Math.floor(centerY / LANE_H)));
      const yOffset = Math.max(10, Math.min(LANE_H - NODE_H - 10, node.position.y - idx * LANE_H));
      propsRef.current.onMoveNode(node.id, Math.max(MIN_X, Math.round(node.position.x)), ls[idx].id, Math.round(yOffset));
    },
    []
  );

  const onPaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.classList.contains("react-flow__pane")) return;
      const ls = propsRef.current.lanes;
      if (ls.length === 0) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const idx = Math.max(0, Math.min(ls.length - 1, Math.floor(p.y / LANE_H)));
      const yOffset = Math.max(10, Math.min(LANE_H - NODE_H - 10, p.y - NODE_H / 2 - idx * LANE_H));
      const box = e.currentTarget.getBoundingClientRect();
      setPending({
        x: Math.max(MIN_X, Math.round(p.x - NODE_W / 2)),
        laneId: ls[idx].id,
        yOffset: Math.round(yOffset),
        px: Math.max(8, Math.min(box.width - 280, e.clientX - box.left - 128)),
        py: Math.max(8, Math.min(box.height - 110, e.clientY - box.top + 14)),
      });
    },
    [screenToFlowPosition]
  );

  const createPending = async (label: string) => {
    const pd = pending;
    setPending(null);
    if (!pd || !label.trim()) return;
    const id = await propsRef.current.onAddNode(pd.x, pd.laneId, pd.yOffset, label.trim());
    if (id) {
      pendingSelect.current = id;
      // only the new step's card opens (not the line's too) so the two cards never overlap
      if (pd.fromId) void propsRef.current.onConnect(pd.fromId, id, "r", "l");
    }
  };

  // first free x in a lane, scanning right so new steps never land on top of old ones
  const freeX = (laneId: string, x: number) => {
    const ns = propsRef.current.nodes.filter((n) => n.lane_id === laneId);
    let nx = Math.max(MIN_X, x);
    while (ns.some((n) => Math.abs(n.x - nx) < NODE_W + 24)) nx += NODE_W + 60;
    return Math.round(nx);
  };

  const openPromptAt = (x: number, laneId: string, yOffset: number, fromId?: string) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const sp = flowToScreenPosition({ x, y: LANE_H * (laneIdx.get(laneId) ?? 0) + yOffset + NODE_H });
    setPending({
      x,
      laneId,
      yOffset,
      fromId,
      px: Math.max(8, Math.min(box.width - 280, sp.x - box.left - 28)),
      py: Math.max(8, Math.min(box.height - 110, sp.y - box.top + 10)),
    });
  };

  const addFromButton = () => {
    const ls = propsRef.current.lanes;
    const box = boxRef.current?.getBoundingClientRect();
    if (!ls.length || !box) return;
    const c = screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    const idx = Math.max(0, Math.min(ls.length - 1, Math.floor(c.y / LANE_H)));
    const yOffset = Math.round((LANE_H - NODE_H) / 2);
    openPromptAt(freeX(ls[idx].id, Math.round(c.x - NODE_W / 2)), ls[idx].id, yOffset);
    // keep the prompt right under the button that opened it
    setPending((p) => (p ? { ...p, px: LANE_LABEL_W + 40, py: 52 } : p));
  };

  closeRef.current = () => {
    setSelEdge(null);
    setRfNodes((nds) => (nds.some((x) => x.selected) ? nds.map((x) => (x.selected ? { ...x, selected: false } : x)) : nds));
  };

  addNextRef.current = (id: string) => {
    const n = propsRef.current.nodes.find((x) => x.id === id);
    if (!n || !n.lane_id) return;
    // close any open step / line card first so cards don't stack up
    setSelEdge(null);
    setRfNodes((nds) => (nds.some((x) => x.selected) ? nds.map((x) => (x.selected ? { ...x, selected: false } : x)) : nds));
    openPromptAt(n.x + NODE_W + 60, n.lane_id, n.y_offset, id); // drop right beside the + (user can drag it elsewhere)
  };

  const showCoach = nodes.filter((n) => n.type !== "start").length === 0;

  return (
    <PeerCtx.Provider value={peerOn}>
    <LockCtx.Provider value={locked}>
    <div ref={boxRef} className={`relative w-full h-full ${peerOn ? "loom-peer" : ""} ${pickTool ? "loom-pick" : ""}`} onDoubleClick={frozen ? undefined : onPaneDoubleClick}>
      {props.canProbe && (
        <div className="absolute top-3 right-3 z-30 flex items-start gap-2">
          {drawer && (
            <div className="glass glass-bright rounded-xl p-3 w-[17rem] text-[0.76rem]" style={{ background: theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(12,16,26,0.98)" }}>
              <div className="font-mono text-[0.6rem] tracking-[0.16em] text-orange mb-2">
                {drawer === "inquiry" ? t("INQUIRY", "UNTERSUCHUNG") : drawer === "intelligence" ? t("INTELLIGENCE", "INTELLIGENZ") : t("INNOVATION", "INNOVATION")}
              </div>
              {drawer === "inquiry" ? (
                <div className="flex flex-col gap-2">
                  {/* Circuit Tester: its readout sits right under it */}
                  <div className="transition-opacity" style={{ opacity: (tallyOn || gapsOn) && !probeOn ? 0.4 : 1 }}>
                    <button
                      onClick={() => { const on = !probeOn; setProbeOn(on); if (on) { setTallyOn(false); setGapsOn(false); } else setProbe({ a: null, b: null }); }}
                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 border text-left transition-colors ${probeOn ? "border-orange/60 bg-orange/10 text-orange" : "border-white/10 hover:border-orange/40 text-text/90"}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-none"><circle cx="3" cy="8" r="2" fill="currentColor" /><circle cx="13" cy="8" r="2" fill="currentColor" /><path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5" /></svg>
                      <span className="flex-1">
                        <span className="block font-medium">{t("Circuit Tester", "Schaltkreis-Prüfer")}</span>
                        <span className="block text-muted text-[0.68rem]">{t("Pick two steps to light the route between them.", "Zwei Schritte wählen, um den Weg dazwischen zu zeigen.")}</span>
                      </span>
                      <HelpTip title={t("Circuit Tester", "Schaltkreis-Prüfer")} body={t("Pick any two steps and Loom lights the route between them, then adds up the steps, hand-offs, lanes and time along it.", "Wählen Sie zwei Schritte, und Loom zeigt den Weg dazwischen samt Schritten, Übergaben, Bahnen und Zeit.")} how={t("Use it to answer “how long does it really take from here to there?”", "Beantwortet: „Wie lange dauert es wirklich von hier bis dort?“")} />
                      <span className="text-[0.6rem] font-mono">{probeOn ? t("ON", "AN") : t("OFF", "AUS")}</span>
                    </button>
                    {probeOn && (
                      <div className="mt-2 px-1 text-text/85">
                        {!circuit
                          ? t("Select the first step.", "Ersten Schritt auswählen.")
                          : trav !== null
                            ? t("Tracing the route…", "Der Weg wird verfolgt …")
                          : circuit.pending
                            ? t("First step set. Select the second step.", "Erster Schritt gesetzt. Zweiten Schritt auswählen.")
                            : circuit.none
                              ? t("No circuit: no route between those two steps.", "Kein Schaltkreis: keine Verbindung zwischen den beiden Schritten.")
                              : (
                                <>
                                  <div>{`${circuit.steps} ${t("steps", "Schritte")} · ${circuit.lines} ${t("lines", "Linien")} · ${circuit.handoffs} ${t("hand-offs", "Übergaben")} · ${circuit.lanes} ${t("lanes", "Bahnen")}`}</div>
                                  <div className="mt-1 text-muted">
                                    {t("In steps", "In Schritten")} <span className="text-text">{fmtDur(circuit.inSteps)}</span> · {t("Waiting", "Wartezeit")} <span className="text-text">{fmtDur(circuit.waiting)}</span> · {t("Total", "Gesamt")} <span className="text-orange">{fmtDur(circuit.total)}</span>
                                    {circuit.rework > 0 && <span> · {circuit.rework} {t("rework", "Nacharbeit")}</span>}
                                  </div>
                                </>
                              )}
                        {circuit && <button onClick={() => setProbe({ a: null, b: null })} className="mt-1.5 block text-[0.68rem] text-muted hover:text-orange">{t("Reset probes", "Sonden zurücksetzen")}</button>}
                      </div>
                    )}
                  </div>
                  {/* Selection Totals: its readout sits right under it */}
                  <div className="transition-opacity" style={{ opacity: (probeOn || gapsOn) && !tallyOn ? 0.4 : 1 }}>
                    <button
                      onClick={() => { const on = !tallyOn; setTallyOn(on); if (on) { setProbeOn(false); setGapsOn(false); setProbe({ a: null, b: null }); } }}
                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 border text-left transition-colors ${tallyOn ? "border-orange/60 bg-orange/10 text-orange" : "border-white/10 hover:border-orange/40 text-text/90"}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-none"><rect x="1.5" y="3" width="13" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 1.5" /><path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                      <span className="flex-1">
                        <span className="block font-medium">{t("Selection Totals", "Auswahl-Summen")}</span>
                        <span className="block text-muted text-[0.68rem]">{t("Add up the time in whatever you select.", "Die Zeit in der Auswahl zusammenzählen.")}</span>
                      </span>
                      <HelpTip title={t("Selection Totals", "Auswahl-Summen")} body={t("Select several steps and Loom totals the time in them: working time, waiting time and the overall total.", "Mehrere Schritte wählen, und Loom summiert die Zeit: Arbeitszeit, Wartezeit und Gesamtzeit.")} how={t("Drag a box on the canvas, or Ctrl-click steps to add them to the selection.", "Rechteck auf der Fläche ziehen oder Schritte mit Strg anklicken.")} />
                      <span className="text-[0.6rem] font-mono">{tallyOn ? t("ON", "AN") : t("OFF", "AUS")}</span>
                    </button>
                    {tallyOn && tally && (
                      <div className="mt-2 px-1 text-text/85">
                        {tally.empty ? (
                          t("Drag a box, or Ctrl-click steps, to total them.", "Rechteck ziehen oder Schritte mit Strg anklicken, um sie zu summieren.")
                        ) : (
                          <>
                            <div>{`${tally.steps} ${t("steps", "Schritte")} · ${tally.lines} ${t("lines", "Linien")} · ${tally.lanes} ${t("lanes", "Bahnen")}`}</div>
                            <div className="mt-1 text-muted">
                              {t("In steps", "In Schritten")} <span className="text-text">{fmtDur(tally.inSteps)}</span> · {t("Waiting", "Wartezeit")} <span className="text-text">{fmtDur(tally.waiting)}</span> · {t("Total", "Gesamt")} <span className="text-orange">{fmtDur(tally.total)}</span>
                            </div>
                            {tally.untimed > 0 && <div className="mt-1 text-[0.68rem] text-muted">{tally.untimed} {t("steps have no time entered.", "Schritte ohne Zeitangabe.")}</div>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Time Gaps: lists the steps with no time entered, and lights them on the canvas */}
                  <div className="transition-opacity" style={{ opacity: (probeOn || tallyOn) && !gapsOn ? 0.4 : 1 }}>
                    <button
                      onClick={() => { const on = !gapsOn; setGapsOn(on); if (on) { setProbeOn(false); setTallyOn(false); setProbe({ a: null, b: null }); } }}
                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 border text-left transition-colors ${gapsOn ? "border-orange/60 bg-orange/10 text-orange" : "border-white/10 hover:border-orange/40 text-text/90"}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-none"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 2" /><path d="M8 4.5V8l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                      <span className="flex-1">
                        <span className="block font-medium">{t("Time Gaps", "Zeitlücken")}</span>
                        <span className="block text-muted text-[0.68rem]">{t("Find the steps with no time entered.", "Schritte ohne Zeitangabe finden.")}</span>
                      </span>
                      <HelpTip title={t("Time Gaps", "Zeitlücken")} body={t("Lists the steps that have no time entered, so your totals aren't quietly missing something.", "Listet Schritte ohne Zeitangabe, damit Ihre Summen nichts Wichtiges verschweigen.")} how={t("Click a step in the list to jump to it and add its time.", "Einen Schritt in der Liste anklicken, um hinzuspringen und die Zeit zu ergänzen.")} />
                      <span className="text-[0.6rem] font-mono">{gapsOn ? t("ON", "AN") : t("OFF", "AUS")}</span>
                    </button>
                    {gapsOn && gaps && (
                      <div className="mt-2 px-1 text-text/85">
                        {gaps.length === 0 ? (
                          t("Every step has a time. Nice.", "Jeder Schritt hat eine Zeitangabe. Sehr gut.")
                        ) : (
                          <>
                            <div>{`${gaps.length} ${t("of", "von")} ${nodes.filter((n) => n.type !== "start" && n.type !== "end").length} ${t("steps have no time.", "Schritten ohne Zeit.")}`}</div>
                            <ul className="mt-1.5 max-h-40 overflow-y-auto pr-1 flex flex-col gap-0.5">
                              {gaps.map((n) => (
                                <li key={n.id}>
                                  <button
                                    onClick={() => setCenter(n.x + NODE_W / 2, (laneIdx.get(n.lane_id ?? "") ?? 0) * LANE_H + n.y_offset + NODE_H / 2, { zoom: Math.max(getViewport().zoom, 0.8), duration: 300 })}
                                    className="w-full truncate text-left text-[0.72rem] text-muted hover:text-orange"
                                  >
                                    {n.label || t("(unnamed step)", "(unbenannter Schritt)")}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : drawer === "intelligence" ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setPeerOn((v) => !v)}
                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 border text-left transition-colors ${peerOn ? "border-orange/60 bg-orange/10 text-orange" : "border-white/10 hover:border-orange/40 text-text/90"}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-none"><path d="M2 5l6-3 6 3-6 3-6-3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M2 9l6 3 6-3M2 12l6 3 6-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity=".6" /></svg>
                    <span className="flex-1">
                      <span className="block font-medium">{t("Insights", "Erkenntnisse")}</span>
                      <span className="block text-muted text-[0.68rem]">{t("Loom reads your process and flags what looks off. Pin your own questions and ideas. Editing pauses.", "Loom liest Ihren Prozess und markiert Auffälliges. Heften Sie eigene Fragen und Ideen an. Bearbeiten pausiert.")}</span>
                    </span>
                    <HelpTip title={t("Insights", "Erkenntnisse")} body={t("Look behind your process. Loom flags what looks off (signals); you pin questions, findings and ideas, and pursue the ones worth chasing.", "Der Blick hinter den Prozess. Loom markiert Auffälliges (Signale); Sie heften Fragen, Befunde und Ideen an und verfolgen, was sich lohnt.")} how={t("Editing pauses while Insights is on. Press Esc to return.", "Bearbeiten pausiert, solange Erkenntnisse an ist. Esc zum Zurückkehren.")} />
                    <span className="text-[0.6rem] font-mono">{peerOn ? t("ON", "AN") : t("OFF", "AUS")}</span>
                  </button>
                  {peerOn && (
                    <>
                      <LayerLegend pins={props.pins} signals={signals} />
                      <button
                        onClick={() => setScanReq((n) => n + 1)}
                        disabled={scan !== null}
                        title={t("Have Loom read the process again", "Loom den Prozess erneut lesen lassen")}
                        className="self-start text-[0.7rem] text-muted hover:text-orange disabled:opacity-40 disabled:hover:text-muted px-1"
                      >
                        ↻ {t("Scan again", "Erneut scannen")}
                      </button>
                      <div className="relative">
                        {eyeMap(224, 220)}
                        <button onClick={() => setEyeBig(true)} title={t("Enlarge the map", "Karte vergrößern")} className="absolute top-1 right-1 w-5 h-5 rounded bg-black/50 text-text/80 hover:text-orange text-[0.7rem] leading-none">⤢</button>
                      </div>
                      <HopBar
                        index={hopItems.findIndex((h) => h.key === pinOpen)}
                        total={hopItems.length}
                        label={hopItems.find((h) => h.key === pinOpen)?.label ?? t("Hop between insights", "Zwischen Erkenntnissen springen")}
                        onPrev={() => { const i = hopItems.findIndex((h) => h.key === pinOpen); hopTo(hopItems[(i <= 0 ? hopItems.length : i) - 1].key); }}
                        onNext={() => { const i = hopItems.findIndex((h) => h.key === pinOpen); hopTo(hopItems[(i + 1) % hopItems.length].key); }}
                      />
                    </>
                  )}
                </div>
              ) : (
                <div className="text-muted">{t("Coming soon.", "Demnächst.")}</div>
              )}
            </div>
          )}
          <div className="glass rounded-full flex flex-col gap-1 p-1">
            {([
              { k: "inquiry", tt: t("Inquiry", "Untersuchung"), svg: <><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10.5 10.5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></> },
              { k: "intelligence", tt: t("Intelligence", "Intelligenz"), svg: <path d="M8 1.5l1.7 4.6 4.8.4-3.7 3.1 1.2 4.7L8 11.7l-4 2.6 1.2-4.7L1.5 6.5l4.8-.4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /> },
              { k: "innovation", tt: t("Innovation", "Innovation"), svg: <><path d="M5.5 11.5h5M6 14h4M8 1.5a4.5 4.5 0 0 0-2.5 8.2c.4.3.5.7.5 1.3h4c0-.6.1-1 .5-1.3A4.5 4.5 0 0 0 8 1.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></> },
            ] as const).map((b) => (
              <InfoTip
                key={b.k}
                side="left"
                title={b.tt}
                body={b.k === "inquiry" ? t("Tools that measure and question your process.", "Werkzeuge, die Ihren Prozess messen und hinterfragen.") : b.k === "intelligence" ? t("Insights: Loom reads your process, flags what looks off, and helps you turn it into questions.", "Erkenntnisse: Loom liest Ihren Prozess, markiert Auffälliges und hilft, daraus Fragen zu machen.") : t("Works your pursuits with innovation techniques. Coming soon.", "Bearbeitet Ihre Vorhaben mit Innovationstechniken. Demnächst.")}
              >
              <button
                onClick={() => setDrawer((d) => (d === b.k ? null : b.k))}
                aria-label={b.tt}
                className={`rounded-full w-8 h-8 flex items-center justify-center transition-colors ${drawer === b.k ? "text-orange bg-orange/10" : "text-text/70 hover:text-orange"}`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{b.svg}</svg>
              </button>
              </InfoTip>
            ))}
          </div>
        </div>
      )}
      {peerOn && eyeBig && (
        <div className="absolute left-4 bottom-4 z-40 glass glass-bright rounded-xl p-2.5" style={{ background: "var(--tint-solid)" }}>
          <div className="flex items-center mb-1.5">
            <span className="font-mono text-[0.6rem] tracking-[0.14em] text-orange">{t("BIRD'S-EYE VIEW", "VOGELPERSPEKTIVE")}</span>
            <button onClick={() => setEyeBig(false)} className="ml-auto text-muted hover:text-text text-sm leading-none" aria-label="Close">×</button>
          </div>
          {eyeMap(Math.min(760, Math.max(420, (boxRef.current?.clientWidth ?? 900) - 120)), 360)}
        </div>
      )}
      {peerOn && scan === null && props.pins.length === 0 && selNodeIds.length === 0 && !selEdge && (
        <div className="absolute left-1/2 -translate-x-1/2 top-4 z-30 glass glass-bright rounded-full px-4 py-2 text-[0.78rem] text-text/90 pointer-events-none" style={{ background: "var(--tint-solid)" }}>
          {t("Click a step or line, then press ", "Schritt oder Linie anklicken, dann ")}<span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-orange/70 text-orange align-middle mx-0.5">+</span>{t(" to pin a Question, Finding or Idea.", " drücken, um eine Frage, einen Befund oder eine Idee anzuheften.")}
        </div>
      )}
      {trav !== null && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] glass glass-bright glass-pop rounded-full px-4 py-2 text-[0.8rem] flex items-center gap-2.5 pointer-events-none" style={{ background: "var(--tint-solid)" }}>
          <span className="inline-block w-3 h-3 rounded-full border-2 border-orange/30 border-t-orange animate-spin" aria-hidden />
          {t("Traversing the process…", "Der Prozess wird durchlaufen …")}
          <span className="font-mono text-muted">{trav}%</span>
        </div>
      )}
      {peerOn && scan !== null && (
        <>
          <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${scan}%`, width: 140, transform: "translateX(-100%)", zIndex: 30, background: "linear-gradient(90deg, rgba(248,153,29,0), rgba(248,153,29,.16))", borderRight: "2px solid rgba(248,153,29,.55)" }} />
          <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] glass glass-bright glass-pop rounded-full px-4 py-2 text-[0.8rem] flex items-center gap-2.5 pointer-events-none" style={{ background: "var(--tint-solid)" }}>
            <span className="inline-block w-3 h-3 rounded-full border-2 border-orange/30 border-t-orange animate-spin" aria-hidden />
            {scan < 25 ? t("Reading your steps…", "Ihre Schritte werden gelesen …") : scan < 50 ? t("Measuring waits and handoffs…", "Wartezeiten und Übergaben werden gemessen …") : scan < 75 ? t("Looking for rework and bounces…", "Nacharbeit und Rückläufe werden gesucht …") : t("Weighing what matters…", "Das Wesentliche wird gewichtet …")}
            <span className="font-mono text-muted">{scan}%</span>
          </div>
        </>
      )}
      <style>{`.loom-peer .react-flow__node { opacity: .5; transition: opacity .4s ease; } .loom-peer .react-flow__node.selected, .loom-peer .react-flow__node:hover { opacity: 1; } .loom-peer .react-flow__edgelabel-renderer { opacity: .3; } .loom-peer .react-flow__edge { opacity: .4; transition: opacity .4s ease; } .loom-peer .react-flow__edge.selected, .loom-peer .react-flow__edge:hover { opacity: 1; } .react-flow__pane, .react-flow__pane.draggable, .react-flow__pane.dragging, .react-flow__pane.selection { cursor: default !important; } .loom-pick .react-flow__pane, .loom-pick .react-flow__pane.draggable, .loom-pick .react-flow__node, .loom-pick .react-flow__node.draggable, .loom-pick .react-flow__node * { cursor: default !important; }`}</style>
      <ReactFlow<RFNode, RFEdge>
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={() => { setSelEdge(null); setPinOpen(null); }}
        onSelectionStart={() => { dragBoxRef.current = true; setSelEdge(null); }}
        onSelectionEnd={() => { dragBoxRef.current = false; boxEndRef.current = Date.now(); setSelEdge(null); setTimeout(() => setSelEdge(null), 120); }}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onConnectEnd={onConnectEnd as any}
        onNodeDragStop={onNodeDragStop}
        onNodeMouseEnter={(_, n) => { if (peerOn && n.id !== "__bounds") setHover(n.id); }}
        onNodeMouseLeave={() => { if (peerOn) setHover(null); }}
        onNodeClick={(ev, n) => {
          if (focus?.selecting) return propsRef.current.onFocusToggle(n.id);
          if (props.canProbe && (ev.shiftKey || probeOn)) {
            setProbe((p) => (!p.a || (p.a && p.b) ? { a: n.id, b: null } : p.a === n.id ? { a: null, b: null } : { a: p.a, b: n.id }));
            closeRef.current(); // don't open the step card
          }
        }}
        elementsSelectable={!focus?.selecting}
        nodesDraggable={!focus?.selecting && !frozen}
        nodesConnectable={!focus?.selecting && !frozen}
        onNodesDelete={(ns) => propsRef.current.onDeleteNodes(ns.map((n) => n.id))}
        onEdgesDelete={(es) => propsRef.current.onDeleteEdges(es.map((e) => e.id))}
        connectionMode={ConnectionMode.Loose}
        zoomOnDoubleClick={false}
        deleteKeyCode={frozen ? null : ["Backspace", "Delete"]}
        selectionOnDrag={selMode && !peerOn}
        selectionKeyCode="Shift"
        panOnDrag={selMode ? [1, 2] : true}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={["Meta", "Control"]}
        minZoom={0.06}
        maxZoom={1.6}
        defaultViewport={{ x: 30, y: 70, zoom: 0.9 }}
        proOptions={{ hideAttribution: true }}
        snapToGrid={grid}
        snapGrid={[NODE_W / 4, NODE_W / 4]}
      >
        {grid ? (
          // one square = a quarter of a node's width, so ~4 lines cross a typical step
          <Background key="grid" variant={BackgroundVariant.Lines} gap={NODE_W / 4} lineWidth={1} color={theme === "light" ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.035)"} />
        ) : (
          <Background key="dots" variant={BackgroundVariant.Dots} gap={28} size={1.2} color={theme === "light" ? "rgba(15,23,42,0.16)" : "rgba(255,255,255,0.07)"} />
        )}
        {lanes.length > 0 && (
          <Panel position="top-left" style={{ margin: 0, left: LANE_LABEL_W + 40, top: 12, opacity: peerOn ? 0.3 : 1, pointerEvents: peerOn ? "none" : "auto", transition: "opacity .4s" }}>
            <div className="flex items-center gap-2">
            <InfoTip title={t("Hand and Select","Hand und Auswahl")} body={t("Hand: drag the canvas to move around. Select: drag a box to pick several steps.","Hand: Fläche ziehen, um sich zu bewegen. Auswahl: Rechteck ziehen, um mehrere Schritte zu wählen.")} how={t("Keys: H for hand, V for select. Or hold Shift and drag in hand mode.","Tasten: H für Hand, V für Auswahl. Oder im Hand-Modus Umschalt halten und ziehen.")}>
              <div className="glass rounded-full flex items-center p-0.5 gap-0.5">
                {([
                  { sel: false, label: t("Hand", "Hand"), icon: <HandIcon size={14} /> },
                  { sel: true, label: t("Select", "Auswahl"), icon: <PointerIcon size={14} /> },
                ] as const).map((m) => (
                  <button
                    key={String(m.sel)}
                    onClick={() => setSelMode(m.sel)}
                    aria-label={m.label}
                    aria-pressed={selMode === m.sel}
                    className={`rounded-full w-7 h-7 flex items-center justify-center transition-colors ${selMode === m.sel ? "bg-orange/20 text-orange" : "text-text/70 hover:text-orange"}`}
                  >
                    {m.icon}
                  </button>
                ))}
              </div>
            </InfoTip>
            <span className="w-px h-5 bg-white/15 mx-0.5" aria-hidden="true" />
            <InfoTip title={t("Add a step","Schritt hinzufügen")} body={t("Drops a new step into the process.","Fügt dem Prozess einen neuen Schritt hinzu.")} how={t("Or double-click empty canvas, or press + beside a step to add the next one.","Oder Doppelklick auf die freie Fläche, oder + neben einem Schritt für den nächsten.")}>
<button
              onClick={addFromButton}
              disabled={locked}
              aria-label={t("Add a step", "Schritt hinzufügen")}
              className="glass rounded-full w-8 h-8 flex items-center justify-center text-orange border !border-orange/50 hover:bg-orange/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            </InfoTip>
            <span className="w-px h-5 bg-white/15 mx-0.5" aria-hidden="true" />
            {([
              { k: "undo", g: "↶", on: props.canUndo && !locked, fn: props.onUndo, tt: t("Undo (Ctrl+Z)", "Rückgängig (Strg+Z)") },
              { k: "redo", g: "↷", on: props.canRedo && !locked, fn: props.onRedo, tt: t("Redo (Ctrl+Shift+Z)", "Wiederholen (Strg+Umschalt+Z)") },
            ] as const).map((b) => (
              <InfoTip
                key={b.k}
                title={b.k === "undo" ? t("Undo", "Rückgängig") : t("Redo", "Wiederholen")}
                body={b.k === "undo" ? t("Takes back your last change.", "Nimmt Ihre letzte Änderung zurück.") : t("Puts back what you just undid.", "Stellt wieder her, was Sie gerade rückgängig gemacht haben.")}
                how={b.k === "undo" ? t("Ctrl+Z. Works for adds, moves, deletes and pastes.", "Strg+Z. Gilt für Hinzufügen, Verschieben, Löschen und Einfügen.") : t("Ctrl+Shift+Z.", "Strg+Umschalt+Z.")}
              >
              <button
                onClick={b.fn}
                disabled={!b.on}
                aria-label={b.tt}
                className="glass rounded-full w-8 h-8 text-base leading-none text-text/80 hover:text-orange disabled:opacity-30 disabled:hover:text-text/80 transition-colors"
              >
                {b.g}
              </button>
              </InfoTip>
            ))}
            <span className="w-px h-5 bg-white/15 mx-0.5" aria-hidden="true" />
            <InfoTip title={t("Copy","Kopieren")} body={t("Copies the selected steps and the lines between them.","Kopiert die ausgewählten Schritte und die Linien dazwischen.")} how={t("Switch to Select (V) and drag a box, hold Shift and drag, or Ctrl-click steps one by one. Ctrl+C also works.","Auf Auswahl (V) wechseln und ein Rechteck ziehen, Umschalt halten und ziehen, oder Strg-Klick auf einzelne Schritte. Strg+C geht auch.")}>
<button
              onClick={() => { if (selIdsRef.current.length) props.onCopyNodes(selIdsRef.current); }}
              aria-label={t("Copy selected steps", "Ausgewählte Schritte kopieren")}
              className="glass rounded-full w-8 h-8 flex items-center justify-center text-text/80 hover:text-orange transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3v5.5A1.5 1.5 0 0 0 3.5 10H4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
            </InfoTip>
            <InfoTip title={t("Paste","Einfügen")} body={t("Drops the copied steps next to the originals, or into another process.","Fügt die kopierten Schritte neben den Originalen oder in einem anderen Prozess ein.")} how={t("Ctrl+V. Ctrl+D copies and pastes in one move.","Strg+V. Strg+D kopiert und fügt in einem Zug ein.")}>
<button
              onClick={() => props.onPasteNodes()}
              disabled={locked}
              aria-label={t("Paste", "Einfügen")}
              className="glass rounded-full w-8 h-8 flex items-center justify-center text-text/80 hover:text-orange disabled:opacity-30 disabled:hover:text-text/80 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="11.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="5.8" y="1.2" width="4.4" height="3" rx="1" fill="currentColor" /></svg>
            </button>
            </InfoTip>
            <span className="w-px h-5 bg-white/15 mx-0.5" aria-hidden="true" />
            <InfoTip title={t("Find","Suchen")} body={t("Finds steps by name and jumps to them.","Findet Schritte nach Namen und springt dorthin.")} how={t("Type, then Enter for the next match, Shift+Enter for the previous.","Tippen, Enter für den nächsten Treffer, Umschalt+Enter für den vorherigen.")}>
            <div className="glass rounded-full flex items-center pl-3 pr-1.5 h-8 gap-1.5">
              <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" className="text-muted flex-none">
                <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 10l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    jumpTo(jumpedRef.current ? matchPos + (e.shiftKey ? -1 : 1) : matchPos);
                    jumpedRef.current = true;
                  }
                  if (e.key === "Escape") setQuery("");
                }}
                placeholder={t("Find a step…", "Schritt suchen …")}
                aria-label={t("Find a step", "Schritt suchen")}
                className="nodrag nopan bg-transparent outline-none text-[0.8rem] font-normal w-32 placeholder:text-muted/70"
              />
              {searching && (
                <>
                  <span className="font-mono text-[0.68rem] text-muted whitespace-nowrap">
                    {matches.length ? `${matchPos + 1}/${matches.length}` : t("none", "keine")}
                  </span>
                  <button onClick={() => setQuery("")} aria-label={t("Clear search", "Suche löschen")} className="w-5 h-5 text-muted hover:text-text leading-none">✕</button>
                </>
              )}
            </div>
            </InfoTip>
            <span className="w-px h-5 bg-white/15 mx-0.5" aria-hidden="true" />
            <InfoTip
              title={locked ? t("Locked", "Gesperrt") : t("Lock", "Sperren")}
              body={
                props.lockSource === "workspace"
                  ? t("The whole workspace is locked, so everything is view only. Hover cards and comments still work.", "Der ganze Arbeitsbereich ist gesperrt, daher ist alles nur ansehbar. Hover-Karten und Kommentare funktionieren weiter.")
                  : locked
                    ? t("This process is locked: view only. Hover cards, search, copy and comments still work.", "Dieser Prozess ist gesperrt: nur Ansicht. Hover-Karten, Suche, Kopieren und Kommentare funktionieren weiter.")
                    : t("Locks this process so nobody can change it by accident. Great once a process is signed off.", "Sperrt diesen Prozess, damit ihn niemand versehentlich ändert. Ideal, wenn ein Prozess abgenommen ist.")
              }
              how={
                props.lockSource === "workspace"
                  ? t("Owners and admins unlock it from the workspace menu at the top.", "Eigentümer und Admins entsperren ihn im Arbeitsbereich-Menü oben.")
                  : props.canLock
                    ? locked ? t("Click to unlock.", "Zum Entsperren klicken.") : t("Click to lock. You can unlock it any time.", "Zum Sperren klicken. Entsperren ist jederzeit möglich.")
                    : t("Only owners and admins can lock or unlock.", "Nur Eigentümer und Admins können sperren oder entsperren.")
              }
            >
              <button
                onClick={() => props.canLock && props.onToggleLock?.()}
                disabled={!props.canLock}
                aria-label={locked ? t("Locked", "Gesperrt") : t("Lock this process", "Prozess sperren")}
                aria-pressed={locked}
                className={`glass rounded-full h-8 flex items-center justify-center gap-1.5 transition-colors disabled:cursor-default ${locked ? "px-3 text-orange border !border-orange/50 bg-orange/10" : "w-8 text-text/80 hover:text-orange disabled:opacity-40 disabled:hover:text-text/80"}`}
              >
                {locked ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
                {locked && <span className="font-mono text-[0.62rem] tracking-wider">{t("LOCKED", "GESPERRT")}</span>}
              </button>
            </InfoTip>
            <InfoTip title={t("Help","Hilfe")} body={t("How Loom works, with a quick tour of every tool.","So funktioniert Loom, mit einer kurzen Tour durch alle Werkzeuge.")} how={t("Shortcuts: H hand, V select, Ctrl+C / V / D copy, paste, duplicate. Ctrl+Z undo. Ctrl-click adds to a selection.","Kürzel: H Hand, V Auswahl, Strg+C / V / D kopieren, einfügen, duplizieren. Strg+Z rückgängig. Strg-Klick erweitert die Auswahl.")}>
              <button
                onClick={() => props.onGuide?.()}
                aria-label={t("Help","Hilfe")}
                className="glass rounded-full w-8 h-8 flex items-center justify-center text-[0.9rem] font-medium leading-none text-text/80 hover:text-orange transition-colors"
              >
                ?
              </button>
            </InfoTip>
            </div>
          </Panel>
        )}
        <Panel position="bottom-right" style={{ margin: 0, right: 15, bottom: 16 }}>
          <div className="glass rounded-full flex items-center gap-0.5 p-1">
            <InfoTip side="above" title={t("Zoom out","Verkleinern")} body={t("Step back to see more of the process.","Zurücktreten, um mehr vom Prozess zu sehen.")} how={t("Or scroll the mouse wheel.","Oder das Mausrad drehen.")}>
              <button onClick={() => zoomOut({ duration: 150 })} aria-label={t("Zoom out","Verkleinern")} className="rounded-full w-8 h-8 flex items-center justify-center text-text/80 hover:text-orange transition-colors">
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </InfoTip>
            <InfoTip side="above" title={t("Zoom level","Zoomstufe")} body={t("Click to jump back to 100%.","Klicken, um auf 100 % zurückzukehren.")}>
              <button onClick={() => zoomTo(1, { duration: 200 })} aria-label={t("Reset zoom","Zoom zurücksetzen")} className="rounded-full h-8 px-2 font-mono text-[0.68rem] text-muted hover:text-orange transition-colors">
                {Math.round(zoom * 100)}%
              </button>
            </InfoTip>
            <InfoTip side="above" title={t("Zoom in","Vergrößern")} body={t("Move closer to read the detail.","Näher heran, um Details zu lesen.")} how={t("Or scroll the mouse wheel.","Oder das Mausrad drehen.")}>
              <button onClick={() => zoomIn({ duration: 150 })} aria-label={t("Zoom in","Vergrößern")} className="rounded-full w-8 h-8 flex items-center justify-center text-text/80 hover:text-orange transition-colors">
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </InfoTip>
            <InfoTip side="above" title={t("Fit to screen","Einpassen")} body={t("Shows the whole process at once.","Zeigt den ganzen Prozess auf einmal.")}>
              <button onClick={fitAll} aria-label={t("Fit to screen","Einpassen")} className="rounded-full w-8 h-8 flex items-center justify-center text-text/80 hover:text-orange transition-colors">
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </InfoTip>
            <span className="w-px h-5 bg-white/15 mx-0.5" aria-hidden="true" />
            <InfoTip side="above" title={t("Grid","Raster")} body={t("Shows a grid and snaps steps to it so everything lines up.","Zeigt ein Raster, an dem Schritte einrasten, damit alles bündig ist.")} how={t("Click again to go back to free placement.","Erneut klicken für freie Platzierung.")}>
<button
              onClick={toggleGrid}
              aria-label={t("Toggle grid", "Raster ein/aus")}
              className="glass rounded-full w-8 h-8 text-[0.95rem] leading-none text-text/80 hover:text-orange transition-colors"
              style={{ opacity: grid ? 1 : 0.6 }}
            >
              ▦
            </button>
            </InfoTip>
            <InfoTip side="above" title={t("Download","Herunterladen")} body={t("Saves the whole process as a picture (PNG).","Speichert den ganzen Prozess als Bild (PNG).")} how={t("Good for slides and emails.","Gut für Folien und E-Mails.")}>
<button
              onClick={exportPng}
              disabled={exporting || lanes.length === 0}
              aria-label={t("Export as image (PNG)", "Als Bild exportieren (PNG)")}
              className="glass rounded-full w-8 h-8 text-[0.95rem] leading-none text-text/80 hover:text-orange disabled:opacity-40 transition-colors"
            >
              {exporting ? "…" : "⤓"}
            </button>
            </InfoTip>
          </div>
        </Panel>

        {peerOn && (
          <ViewportPortal>
            <PinLayer
              nodes={nodes}
              edges={edges}
              pins={props.pins}
              signals={signals}
              anchor={pinAnchor}
              selNodeIds={selNodeIds}
              selEdgeId={selEdge}
              hoverNodeId={hoverId}
              onHoverNode={setHover}
              describe={describeSignal}
              openKey={pinOpen}
              setOpenKey={setPinOpen}
              onAdd={props.onAddPin}
              onPatch={props.onPatchPin}
              onDelete={props.onDeletePin}
              onReveal={(x, y) => setCenter(x + 150, y + 60, { zoom: Math.max(getViewport().zoom, 0.8), duration: 400 })}
            />
          </ViewportPortal>
        )}
        <ViewportPortal>
          {lanes.map((l, i) => {
            const c = l.color ?? NEUTRAL;
            return (
              <div
                key={l.id}
                style={{
                  position: "absolute",
                  left: 0,
                  top: i * LANE_H,
                  width: laneW,
                  height: LANE_H,
                  pointerEvents: "none",
                  background: `${c}0d`,
                  borderTop: "2px dashed rgba(255,255,255,0.22)",
                  borderBottom: i === lanes.length - 1 ? "2px dashed rgba(255,255,255,0.22)" : undefined,
                  zIndex: -1,
                }}
              >
                <div style={{ width: LANE_LABEL_W, height: "100%", position: "relative", display: "flex", alignItems: "center" }}>
                  <span
                    title={tx(l.name)}
                    className="ink-text font-mono tracking-[0.1em] uppercase text-[0.82rem] leading-snug text-right"
                    style={{ color: `color-mix(in srgb, ${c} 58%, rgb(var(--c-text)))`, position: "absolute", width: 136, left: LANE_LABEL_W - 40 - 136, top: "50%", transform: "translateY(-50%) rotate(-45deg)", transformOrigin: "100% 50%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "auto" }}
                  >
                    <Tx text={l.name} d={0} />
                  </span>
                  {/* curly brace "{" — the lane's left end cap; every brace sits at the same x */}
                  <svg
                    width="20"
                    viewBox="0 0 20 100"
                    preserveAspectRatio="none"
                    style={{ position: "absolute", left: LANE_LABEL_W - 28, top: 0, height: "100%", overflow: "visible", filter: `drop-shadow(0 0 5px ${c}66)` }}
                  >
                    <path
                      d="M18 2 C10 2 10 7 10 15 L10 37 C10 45 6 50 2 50 C6 50 10 55 10 63 L10 85 C10 93 10 98 18 98"
                      fill="none"
                      stroke={c}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </ViewportPortal>
      </ReactFlow>

      {pending && (
        <div className="absolute z-40 w-64 glass glass-bright glass-dense glass-pop rounded-xl p-3" style={{ left: pending.px, top: pending.py }} onDoubleClick={(e) => e.stopPropagation()}>
          <div className="font-mono text-[0.62rem] tracking-[0.14em] text-muted/80 mb-1.5">{t("NEW STEP — NAME IT", "NEUER SCHRITT – BENENNEN")}</div>
          <input
            autoFocus
            maxLength={120}
            placeholder={t("e.g. Bill client", "z. B. Kunde abrechnen")}
            className={INPUT_CLS}
            onKeyDown={(e) => {
              if (e.key === "Enter") createPending((e.target as HTMLInputElement).value);
              if (e.key === "Escape") setPending(null);
            }}
            onBlur={(e) => (e.target.value.trim() ? createPending(e.target.value) : setPending(null))}
          />
          <div className="mt-1.5 text-[0.68rem] text-muted/70">{t("Enter to add · Esc to cancel", "Enter zum Hinzufügen · Esc zum Abbrechen")}</div>
        </div>
      )}

      {lanes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="glass glass-bright rounded-2xl px-6 py-5 text-center max-w-sm">
            <div className="text-base mb-1">{t("Add a lane to begin", "Fügen Sie eine Bahn hinzu")}</div>
            <div className="text-[0.85rem] text-muted">
              {t("Lanes group related steps. Add one from the menu on the left.", "Bahnen gruppieren zusammengehörige Schritte. Fügen Sie links im Menü eine hinzu.")}
            </div>
          </div>
        </div>
      )}

      {lanes.length > 0 && showCoach && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass glass-bright rounded-2xl px-5 py-3.5 text-[0.88rem] max-w-xl pointer-events-none">
          <div className="font-mono text-[0.68rem] tracking-[0.14em] text-orange mb-1.5">{t("HOW THIS WORKS", "SO FUNKTIONIERT ES")}</div>
          <ol className="space-y-1 text-muted list-decimal list-inside">
            <li>{t("Press + STEP (top left) or double-click empty space in a lane to add a step.", "Klicken Sie auf + SCHRITT (oben links) oder doppelklicken Sie auf freie Fläche in einer Bahn.")}</li>
            <li>{t("Select a step and press the + beside it to add the next one — already connected.", "Wählen Sie einen Schritt und klicken Sie das + daneben – der nächste Schritt entsteht schon verbunden.")}</li>
            <li>{t("Drag from a step's edge dots to another step to connect them — across lanes too.", "Ziehen Sie von den Punkten am Rand eines Schritts zu einem anderen, auch über Bahnen hinweg.")}</li>
            <li>{t("Click a step to set its type, owner and description.", "Klicken Sie einen Schritt an, um Typ, Zuständigkeit und Beschreibung zu setzen.")}</li>
          </ol>
        </div>
      )}
    </div>
    </LockCtx.Provider>
    </PeerCtx.Provider>
  );
}

export function WorkflowCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
