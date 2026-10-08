"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useTheme } from "@/lib/theme";
import { GroundSymbol, ShapeBody } from "@/components/flow/shapes";

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
  onAddNext: (id: string) => void;
  dim: boolean;
  ring: string | null;
  badges: string[];
  selecting: boolean;
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
  onSelect: (id: string) => void;
  smarts: Pick<FlowEdge, "payload" | "channel" | "wait_minutes" | "friction" | "weight" | "note">;
  onSmarts: (id: string, patch: EdgePatch) => void;
  dim: boolean;
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
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onStartEdit(node.id);
      }}
      className="relative group"
      style={{
        width: w,
        height: h,
        outline: selected ? "2px solid rgba(248,153,29,.85)" : "none",
        outlineOffset: 4,
        borderRadius: 18,
        opacity: data.dim ? 0.2 : 1,
        filter: data.dim ? "grayscale(0.8)" : undefined,
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

      <NodeToolbar position={Position.Right} offset={12} isVisible={(selected || plusVis) && !dragging && !editing && node.type !== "end"}>
        <button
          onMouseEnter={plusOn}
          onMouseLeave={plusOff}
          onClick={() => data.onAddNext(node.id)}
          title={t("Add the next step", "Nächsten Schritt hinzufügen")}
          className="nodrag nopan w-7 h-7 rounded-full border border-orange/60 bg-orange/15 text-orange text-lg leading-none flex items-center justify-center hover:bg-orange/30 transition-colors"
        >
          +
        </button>
      </NodeToolbar>

      <NodeToolbar position={flipUp ? Position.Top : Position.Bottom} offset={14} isVisible={hoverNode && !selected && !dragging && !editing}>
        <div className="glass glass-bright glass-dense glass-pop w-72 rounded-xl p-3 text-[0.8rem] pointer-events-none">
          <div className="font-medium text-[0.86rem] mb-1">{node.label ? tx(node.label) : t("Untitled step", "Schritt ohne Namen")}</div>
          <div className="flex gap-2"><span className="text-text/60 w-14 flex-none">{t("Type", "Typ")}</span><span>{info.glyph} {t(info.en, info.de)}</span></div>
          <div className="flex gap-2"><span className="text-text/60 w-14 flex-none">{t("Owner", "Zuständig")}</span><span style={actor?.color ? { color: actor.color } : undefined}>{actor ? tx(actor.name) : t("— no owner yet —", "— noch niemand —")}</span></div>
          {node.description && <div className="mt-2 pt-2 border-t border-white/10 text-text/80 whitespace-pre-wrap">{tx(node.description)}</div>}
        </div>
      </NodeToolbar>

      <NodeToolbar position={flipUp ? Position.Top : Position.Bottom} offset={14} isVisible={selected && !dragging}>
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
          <button
            onClick={() => data.onDelete(node.id)}
            className="mt-2.5 text-[0.75rem] text-muted hover:text-red-300"
          >
            {t("Delete this step", "Schritt löschen")}
          </button>
        </div>
      </NodeToolbar>
    </div>
  );
});

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
    </div>
  );
}

/** Read-only hover card. */
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
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data, markerEnd } = props;
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
        style={{ stroke, strokeWidth: (WEIGHTS.find((w) => w.key === sm?.weight)?.px ?? 1.9) + (selected ? 0.9 : 0), filter: selected ? `drop-shadow(0 0 5px ${stroke})` : undefined, strokeDasharray: kindInfo.dash, strokeLinecap: kindInfo.dash ? "round" : "butt", opacity: data?.dim ? 0.12 : 1, transition: "opacity .35s ease" }}
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
        >
          <div className="absolute left-1/2 top-1/2 w-0 h-0" style={{ transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}>
          {hover && !selected && !editing && (hasSmarts || !!data?.label) && data && <SmartsCard data={data} label={data.label} />}
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
};

function Inner(props: CanvasProps) {
  const t = useT();
  const tx = useTx();
  const theme = useTheme();
  const { lanes, nodes, edges, actors, focus } = props;
  const { screenToFlowPosition, flowToScreenPosition, zoomTo, getViewport, setCenter } = useReactFlow();
  const boxRef = useRef<HTMLDivElement>(null);
  const addNextRef = useRef<(id: string) => void>(() => {});
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
          onAddNext: (id) => addNextRef.current(id),
          dim: (!!focus && !focus.selecting && !focus.ids.has(n.id)) || (searching && !matchIds.has(n.id)), // while picking steps, nothing is hidden
          ring: focus && focus.ids.has(n.id) ? focus.ring : searching && matchIds.has(n.id) ? "#f8991d" : null,
          badges: focus?.badges.get(n.id) ?? [],
          selecting: !!focus?.selecting,
          commentCount: props.commentCounts[n.id] ?? 0,
          onOpenComments: (id) => propsRef.current.onOpenComments(id),
        },
      })),
    [nodes, laneIdx, actorMap, actors, editingId, commitLabel, focus, searching, matchIds, props.commentCounts]
  );

  const [rfNodes, setRfNodes] = useState<RFNode[]>(derived);
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

  // Esc closes the open step / line card (they show while something is selected)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
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
          smarts: { payload: e.payload ?? null, channel: e.channel ?? null, wait_minutes: e.wait_minutes ?? null, friction: e.friction ?? null, weight: e.weight ?? null, note: e.note ?? null },
          onSmarts: (id, patch) => propsRef.current.onPatchEdge(id, patch),
          dim: !!focus && !focus.selecting && !(focus.ids.has(e.from_node_id) && focus.ids.has(e.to_node_id)),
        },
      })),
    [edges, focus, selEdge]
  );
  const onEdgesChange = useCallback((changes: any[]) => {
    for (const c of changes) {
      if (c.type === "select") setSelEdge((cur) => (c.selected ? c.id : cur === c.id ? null : cur));
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
      if (pd.fromId) Promise.resolve(propsRef.current.onConnect(pd.fromId, id, "r", "l")).then((eid) => eid && setSelEdge(eid));
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

  addNextRef.current = (id: string) => {
    const n = propsRef.current.nodes.find((x) => x.id === id);
    if (!n || !n.lane_id) return;
    // close any open step / line card first so cards don't stack up
    setSelEdge(null);
    setRfNodes((nds) => (nds.some((x) => x.selected) ? nds.map((x) => (x.selected ? { ...x, selected: false } : x)) : nds));
    openPromptAt(freeX(n.lane_id, n.x + NODE_W + 60), n.lane_id, n.y_offset, id);
  };

  const showCoach = nodes.filter((n) => n.type !== "start").length === 0;

  return (
    <div ref={boxRef} className="relative w-full h-full" onDoubleClick={onPaneDoubleClick}>
      <ReactFlow<RFNode, RFEdge>
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={() => setSelEdge(null)}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onConnectEnd={onConnectEnd as any}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, n) => focus?.selecting && propsRef.current.onFocusToggle(n.id)}
        elementsSelectable={!focus?.selecting}
        nodesDraggable={!focus?.selecting}
        nodesConnectable={!focus?.selecting}
        onNodesDelete={(ns) => propsRef.current.onDeleteNodes(ns.map((n) => n.id))}
        onEdgesDelete={(es) => propsRef.current.onDeleteEdges(es.map((e) => e.id))}
        connectionMode={ConnectionMode.Loose}
        zoomOnDoubleClick={false}
        deleteKeyCode={["Backspace", "Delete"]}
        minZoom={0.25}
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
        <Controls showInteractive={false} position="bottom-right" />
        {lanes.length > 0 && (
          <Panel position="top-left" style={{ margin: 0, left: LANE_LABEL_W + 40, top: 12 }}>
            <div className="flex items-center gap-2">
            <button
              onClick={addFromButton}
              title={t("Add a step", "Schritt hinzufügen")}
              className="glass glass-bright rounded-full pl-2.5 pr-3.5 py-1.5 text-[0.76rem] font-mono tracking-wider text-orange border !border-orange/50 hover:bg-orange/10 transition-colors flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span>
              {t("STEP", "SCHRITT")}
            </button>
            {([
              { k: "undo", g: "↶", on: props.canUndo, fn: props.onUndo, tt: t("Undo (Ctrl+Z)", "Rückgängig (Strg+Z)") },
              { k: "redo", g: "↷", on: props.canRedo, fn: props.onRedo, tt: t("Redo (Ctrl+Shift+Z)", "Wiederholen (Strg+Umschalt+Z)") },
            ] as const).map((b) => (
              <button
                key={b.k}
                onClick={b.fn}
                disabled={!b.on}
                title={b.tt}
                aria-label={b.tt}
                className="glass rounded-full w-8 h-8 text-base leading-none text-text/80 hover:text-orange disabled:opacity-30 disabled:hover:text-text/80 transition-colors"
              >
                {b.g}
              </button>
            ))}
            <button
              onClick={toggleGrid}
              title={t("Toggle grid", "Raster ein/aus")}
              aria-label={t("Toggle grid", "Raster ein/aus")}
              className="glass rounded-full w-8 h-8 text-[0.95rem] leading-none text-text/80 hover:text-orange transition-colors"
              style={{ opacity: grid ? 1 : 0.6 }}
            >
              ▦
            </button>
            <button
              onClick={exportPng}
              disabled={exporting || lanes.length === 0}
              title={t("Export as image (PNG)", "Als Bild exportieren (PNG)")}
              aria-label={t("Export as image (PNG)", "Als Bild exportieren (PNG)")}
              className="glass rounded-full w-8 h-8 text-[0.95rem] leading-none text-text/80 hover:text-orange disabled:opacity-40 transition-colors"
            >
              {exporting ? "…" : "⤓"}
            </button>
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
            </div>
          </Panel>
        )}
        <Panel position="bottom-right" style={{ margin: 0, right: 15, bottom: 104 }}>
          <button
            onClick={() => zoomTo(1, { duration: 200 })}
            title={t("Zoom level — click for 100%", "Zoomstufe – Klick für 100 %")}
            className="glass rounded-full px-2 py-0.5 font-mono text-[0.68rem] text-muted hover:text-text"
          >
            {Math.round(zoom * 100)}%
          </button>
        </Panel>

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
  );
}

export function WorkflowCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
