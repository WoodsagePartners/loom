"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLang, useT } from "@/lib/i18n";
import { useTx } from "@/lib/content-i18n";
import { HelpTip } from "@/components/flow/help-tip";
import type { FlowEdge, FlowNode, FlowPin, Lineage, PhaseNode, PinKind, Roadmap, RoadmapPhase } from "@/lib/flow";

export type Plans = { roadmaps: Roadmap[]; phases: RoadmapPhase[]; phaseNodes: PhaseNode[] };

/** An idea with no Question/Finding behind it and no stated reason. The label drops the moment any support appears. */
export const isUnsupported = (p: FlowPin, all: FlowPin[]) =>
  p.kind === "idea" && !p.parent_id && !(p.support ?? "").trim() && !all.some((c) => c.parent_id === p.id && c.kind === "finding" && c.status !== "dismissed");

// The z=1 layer: Questions, Findings and Ideas pinned to steps and lines, plus
// Signals — faint pins Loom raises by itself when something in the map looks off.
// Clicking a signal turns it into a real Question (or dismisses it).

export const PIN_KINDS: Record<PinKind, { en: string; de: string; color: string; glyph: string }> = {
  question: { en: "Question", de: "Frage", color: "#f8991d", glyph: "?" },
  finding: { en: "Finding", de: "Befund", color: "#60a5fa", glyph: "◆" },
  idea: { en: "Idea", de: "Idee", color: "#5eead4", glyph: "✦" },
};
const SIGNAL_WARN = "#fbbf24"; // amber: worth a look
const SIGNAL_HIGH = "#f97316"; // red-orange: likely hurting
export const PURSUIT_COLOR = "#fcd34d"; // gold: something you decided to pursue

const STATUS_LABELS: Record<PinKind, { key: "open" | "active" | "done"; en: string; de: string }[]> = {
  question: [
    { key: "open", en: "Open", de: "Offen" },
    { key: "active", en: "Exploring", de: "In Klärung" },
    { key: "done", en: "Answered", de: "Beantwortet" },
  ],
  finding: [],
  idea: [], // an idea is simply pursued or not
};

// ---------------------------------------------------------------- signals ---
export type Signal = {
  key: string; // stable id, e.g. "wait:<nodeId>"
  node_id?: string;
  edge_id?: string;
  level: "warn" | "high";
  en: string;
  de: string;
};

function fmtWait(m: number, de: boolean) {
  if (m >= 1440) {
    const d = Math.round((m / 1440) * 10) / 10;
    return de ? `${d} ${d === 1 ? "Tag" : "Tage"}` : `${d} ${d === 1 ? "day" : "days"}`;
  }
  const h = Math.round((m / 60) * 10) / 10;
  return de ? `${h} Std.` : `${h} h`;
}

/** Deterministic checks on the map. No AI: every signal can be explained in one sentence. */
export function computeSignals(nodes: FlowNode[], edges: FlowEdge[]): Signal[] {
  const out: Signal[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    const w = n.wait_minutes ?? 0;
    if (w >= 1440) {
      out.push({ key: `wait:${n.id}`, node_id: n.id, level: w >= 4320 ? "high" : "warn", en: `Work waits ${fmtWait(w, false)} before this step starts.`, de: `Die Arbeit wartet ${fmtWait(w, true)}, bevor dieser Schritt beginnt.` });
    }
  }
  for (const e of edges) {
    const w = e.wait_minutes ?? 0;
    if (w >= 1440) {
      out.push({ key: `ewait:${e.id}`, edge_id: e.id, level: w >= 4320 ? "high" : "warn", en: `Work waits ${fmtWait(w, false)} on this handoff.`, de: `Die Arbeit wartet ${fmtWait(w, true)} bei dieser Übergabe.` });
    }
    if (e.kind === "exception") {
      out.push({ key: `rework:${e.id}`, edge_id: e.id, level: "warn", en: "Rework loop: work goes back instead of forward.", de: "Nacharbeit: Die Arbeit geht zurück statt vorwärts." });
    }
    if (e.friction === "painful") {
      out.push({ key: `pain:${e.id}`, edge_id: e.id, level: "high", en: "This handoff was marked painful.", de: "Diese Übergabe wurde als schmerzhaft markiert." });
    }
  }
  // bounce: A (lane 1) → B (lane 2) → C (lane 1): work leaves a lane and comes straight back
  const flow = edges.filter((e) => e.kind !== "info");
  const seen = new Set<string>();
  for (const ab of flow) {
    const a = byId.get(ab.from_node_id);
    const b = byId.get(ab.to_node_id);
    if (!a || !b || !a.lane_id || !b.lane_id || a.lane_id === b.lane_id || seen.has(b.id)) continue;
    for (const bc of flow) {
      if (bc.from_node_id !== b.id) continue;
      const c = byId.get(bc.to_node_id);
      if (c && c.lane_id === a.lane_id) {
        seen.add(b.id);
        out.push({ key: `bounce:${b.id}`, node_id: b.id, level: "warn", en: "Work leaves a lane and bounces straight back. Two handoffs for one step.", de: "Die Arbeit verlässt eine Bahn und kommt gleich zurück. Zwei Übergaben für einen Schritt." });
        break;
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ layer ---
type Item = { type: "pin"; pin: FlowPin } | { type: "sig"; sig: Signal };
type Add = (a: { node_id?: string | null; edge_id?: string | null; kind: PinKind; body?: string; parent_id?: string | null; origin?: string | null; status?: FlowPin["status"]; pursued_at?: string | null; lineage?: Lineage | null }) => Promise<FlowPin | null>;

const D = 24; // pin diameter
const STEP = 32; // pin pitch along the chain
const MAX_SHOWN = 5;

export function PinLayer({
  nodes, edges, pins, signals, anchor, selNodeIds, selEdgeId, hoverNodeId, onHoverNode, describe, openKey, setOpenKey, onAdd, onPatch, onDelete, onReveal,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  pins: FlowPin[];
  signals: Signal[];
  anchor: (t: { node_id?: string | null; edge_id?: string | null }) => { x: number; y: number } | null;
  selNodeIds: string[];
  selEdgeId: string | null;
  hoverNodeId: string | null;
  onHoverNode: (id: string | null) => void;
  describe: (s: Signal) => { target: string; lane: string; before?: string; after?: string; actor?: string };
  openKey: string | null;
  setOpenKey: (k: string | null) => void;
  onAdd: Add;
  onPatch: (id: string, patch: Partial<FlowPin>) => void;
  onDelete: (id: string) => void;
  onReveal: (x: number, y: number) => void;
}) {
  const t = useT();
  const tx = useTx();
  const lang = useLang();

  const used = useMemo(() => new Set(pins.map((p) => p.origin).filter(Boolean) as string[]), [pins]);
  // where a pin came from, frozen at the moment it is pursued: signal › question › finding › idea, plus the step it sits on
  const lineageFor = (pin: FlowPin): Lineage => {
    const chain: FlowPin[] = [];
    let cur: FlowPin | undefined = pin;
    while (cur && chain.length < 8) {
      chain.unshift(cur);
      const pid: string | null = cur.parent_id;
      cur = pid ? pins.find((x) => x.id === pid) : undefined;
    }
    const out: Lineage = [];
    const sig = chain[0]?.origin ? signals.find((s) => s.key === chain[0].origin) : undefined;
    if (sig) out.push({ kind: "signal", text: sig.en, de: sig.de });
    for (const c of chain) out.push({ kind: c.kind, text: c.body });
    const d = describe({ key: "", node_id: pin.node_id ?? undefined, edge_id: pin.edge_id ?? undefined, level: "warn", en: "", de: "" });
    if (d.target) out.push({ kind: "at", text: d.target });
    return out;
  };
  const pursue = (p: FlowPin) => onPatch(p.id, { pursued_at: new Date().toISOString(), lineage: lineageFor(p) });
  const unpursue = (p: FlowPin) => onPatch(p.id, { pursued_at: null, lineage: null });
  const groups = useMemo(() => {
    const g = new Map<string, { node_id?: string; edge_id?: string; items: Item[] }>();
    const tk = (x: { node_id?: string | null; edge_id?: string | null }) => (x.node_id ? `n:${x.node_id}` : `e:${x.edge_id}`);
    const ensure = (x: { node_id?: string | null; edge_id?: string | null }) => {
      const k = tk(x);
      if (!g.has(k)) g.set(k, { node_id: x.node_id ?? undefined, edge_id: x.edge_id ?? undefined, items: [] });
      return g.get(k)!;
    };
    for (const s of signals) if (!used.has(s.key)) ensure(s).items.push({ type: "sig", sig: s });
    const live = pins.filter((p) => p.status !== "dismissed").sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const p of live) ensure(p).items.push({ type: "pin", pin: p });
    for (const id of selNodeIds) ensure({ node_id: id });
    if (hoverNodeId) ensure({ node_id: hoverNodeId });
    if (selEdgeId) ensure({ edge_id: selEdgeId });
    return g;
  }, [signals, used, pins, selNodeIds, selEdgeId, hoverNodeId]);

  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenKey(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openKey, setOpenKey]);

  const itemKey = (it: Item) => (it.type === "pin" ? `pin:${it.pin.id}` : `sig:${it.sig.key}`);

  return (
    <>
      <style>{`@keyframes pinPop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }`}</style>
      {Array.from(groups.entries()).map(([gk, g]) => {
        const a = anchor(g);
        if (!a) return null;
        const selected = g.node_id ? selNodeIds.includes(g.node_id) || g.node_id === hoverNodeId : g.edge_id === selEdgeId;
        const shown = g.items.length > MAX_SHOWN ? g.items.slice(0, MAX_SHOWN - 1) : g.items;
        const more = g.items.length - shown.length;
        const slots = shown.length + (more > 0 ? 1 : 0) + (selected ? 1 : 0);
        if (!slots) return null;
        const x0 = a.x + 16;
        return (
          <Fragment key={gk}>
            {/* anchor dot + the thread the pins hang on */}
            <div style={{ position: "absolute", left: a.x - 3, top: a.y - 3, width: 6, height: 6, borderRadius: 3, background: "#f8991d", opacity: 0.8, pointerEvents: "none", zIndex: 40 }} />
            <div style={{ position: "absolute", left: a.x, top: a.y - 0.5, width: 16 + (slots - 1) * STEP + D / 2, height: 1, background: "rgba(248,153,29,.4)", pointerEvents: "none", zIndex: 39 }} />
            {shown.map((it, i) => {
              const cx = x0 + i * STEP;
              const k = itemKey(it);
              return (
                <Fragment key={k}>
                  <PinDot item={it} unsupported={it.type === "pin" && isUnsupported(it.pin, pins)} x={cx} y={a.y} active={openKey === k} onClick={() => { setOpenKey(openKey === k ? null : k); onReveal(cx, a.y); }} />
                  {openKey === k && (
                    it.type === "pin" ? (
                      <PinCard pin={it.pin} pins={pins} x={cx} y={a.y} onPursue={pursue} onUnpursue={unpursue} onPatch={onPatch} onDelete={onDelete} onClose={() => setOpenKey(null)} onAdd={onAdd} setOpenKey={setOpenKey} />
                    ) : (
                      <SignalCard sig={it.sig} x={cx} y={a.y} onClose={() => setOpenKey(null)}
                        onAsk={async () => {
                          // Loom (Haiku) phrases the question; a short pause keeps it feeling considered
                          const d = describe(it.sig);
                          const [res] = await Promise.all([
                            fetch("/api/pin-question", {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ signal: it.sig.en, target: d.target, lane: d.lane, before: d.before, after: d.after, actor: d.actor, kind: it.sig.key.split(":")[0], seed: Array.from(it.sig.key).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7), lang }),
                            }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
                            new Promise((ok) => setTimeout(ok, 1800)),
                          ]);
                          const q = typeof res?.question === "string" && res.question.trim() ? res.question.trim() : t(it.sig.en, it.sig.de);
                          const p = await onAdd({ node_id: it.sig.node_id, edge_id: it.sig.edge_id, kind: "question", body: q, origin: it.sig.key });
                          setOpenKey(p ? `pin:${p.id}` : null);
                        }}
                        onPursue={async () => {
                          const d = describe(it.sig);
                          const p = await onAdd({
                            node_id: it.sig.node_id, edge_id: it.sig.edge_id, kind: "finding", body: t(it.sig.en, it.sig.de), origin: it.sig.key,
                            pursued_at: new Date().toISOString(),
                            lineage: [{ kind: "signal", text: it.sig.en, de: it.sig.de }, ...(d.target ? [{ kind: "at", text: d.target }] : [])],
                          });
                          setOpenKey(p ? `pin:${p.id}` : null);
                        }}
                        onPromote={async () => {
                          const p = await onAdd({ node_id: it.sig.node_id, edge_id: it.sig.edge_id, kind: "question", body: t(it.sig.en, it.sig.de), origin: it.sig.key });
                          setOpenKey(p ? `pin:${p.id}` : null);
                        }}
                        onDismiss={async () => {
                          await onAdd({ node_id: it.sig.node_id, edge_id: it.sig.edge_id, kind: "question", body: t(it.sig.en, it.sig.de), origin: it.sig.key, status: "dismissed" });
                          setOpenKey(null);
                        }} />
                    )
                  )}
                </Fragment>
              );
            })}
            {more > 0 && (
              <Fragment>
                <button
                  className="nodrag nopan"
                  onClick={(e) => { e.stopPropagation(); setOpenKey(openKey === `more:${gk}` ? null : `more:${gk}`); }}
                  style={{ position: "absolute", left: x0 + shown.length * STEP - D / 2, top: a.y - D / 2, width: D, height: D, borderRadius: D, pointerEvents: "auto", zIndex: 41 }}
                  title={t("Show all", "Alle anzeigen")}
                >
                  <span className="flex items-center justify-center w-full h-full rounded-full border border-white/30 bg-[#0c101a] text-[0.62rem] font-mono text-text/80">+{more}</span>
                </button>
                {openKey === `more:${gk}` && (
                  <Card x={x0 + shown.length * STEP} y={a.y} onClose={() => setOpenKey(null)}>
                    <div className="flex flex-col gap-1">
                      {g.items.map((it) => (
                        <button key={itemKey(it)} onClick={() => setOpenKey(itemKey(it))} className="flex items-center gap-2 text-left rounded-md px-1.5 py-1 hover:bg-white/10">
                          <span className="inline-block w-2.5 h-2.5 rounded-full flex-none" style={{ background: it.type === "pin" ? PIN_KINDS[it.pin.kind].color : it.sig.level === "high" ? SIGNAL_HIGH : SIGNAL_WARN, opacity: it.type === "sig" ? 0.6 : 1 }} />
                          <span className="text-[0.72rem] text-text/90 truncate">{it.type === "pin" ? (it.pin.body ? tx(it.pin.body) : t("(empty)", "(leer)")) : t(it.sig.en, it.sig.de)}</span>
                        </button>
                      ))}
                    </div>
                  </Card>
                )}
              </Fragment>
            )}
            {selected && (
              <Fragment>
                <button
                  className="nodrag nopan"
                  onClick={(e) => { e.stopPropagation(); setOpenKey(openKey === `add:${gk}` ? null : `add:${gk}`); }}
                  onMouseEnter={() => g.node_id && onHoverNode(g.node_id)}
                  onMouseLeave={() => onHoverNode(null)}
                  title={t("Add a Question, Finding or Idea here", "Frage, Befund oder Idee hier hinzufügen")}
                  style={{ position: "absolute", left: x0 + (shown.length + (more > 0 ? 1 : 0)) * STEP - D / 2, top: a.y - D / 2, width: D, height: D, borderRadius: D, pointerEvents: "auto", zIndex: 41 }}
                >
                  <span className="flex items-center justify-center w-full h-full rounded-full border border-dashed border-orange/70 text-orange text-[0.95rem] leading-none bg-[#0c101a]">+</span>
                </button>
                {openKey === `add:${gk}` && (
                  <Card x={x0 + (shown.length + (more > 0 ? 1 : 0)) * STEP} y={a.y} onClose={() => setOpenKey(null)} width={170}>
                    <div className="flex flex-col gap-1">
                      {(Object.keys(PIN_KINDS) as PinKind[]).map((k) => (
                        <button
                          key={k}
                          onClick={async () => {
                            const p = await onAdd({ node_id: g.node_id, edge_id: g.edge_id, kind: k });
                            setOpenKey(p ? `pin:${p.id}` : null);
                          }}
                          className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/10 text-left"
                        >
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border text-[0.7rem]" style={{ borderColor: PIN_KINDS[k].color, color: PIN_KINDS[k].color }}>{PIN_KINDS[k].glyph}</span>
                          <span className="text-[0.76rem] text-text/90">{t(PIN_KINDS[k].en, PIN_KINDS[k].de)}</span>
                        </button>
                      ))}
                    </div>
                  </Card>
                )}
              </Fragment>
            )}
          </Fragment>
        );
      })}
      <EmptyPinSweeper openKey={openKey} pins={pins} onDelete={onDelete} />
    </>
  );
}

/** A new pin that was closed without any text is removed (pins younger than a few seconds are left alone). */
function EmptyPinSweeper({ openKey, pins, onDelete }: { openKey: string | null; pins: FlowPin[]; onDelete: (id: string) => void }) {
  useEffect(() => {
    const now = Date.now();
    for (const p of pins) {
      if (!p.body.trim() && p.status !== "dismissed" && openKey !== `pin:${p.id}` && now - new Date(p.created_at).getTime() > 4000) onDelete(p.id);
    }
  }, [openKey, pins, onDelete]);
  return null;
}

function PinDot({ item, unsupported = false, x, y, active, onClick }: { item: Item; unsupported?: boolean; x: number; y: number; active: boolean; onClick: () => void }) {
  const t = useT();
  const tx = useTx();
  let color: string, glyph: string, title: string, style: CSSProperties;
  if (item.type === "sig") {
    color = item.sig.level === "high" ? SIGNAL_HIGH : SIGNAL_WARN;
    glyph = "▲";
    title = `${t("Signal", "Signal")}: ${t(item.sig.en, item.sig.de)}`;
    // faint and dashed: Loom's suggestion, not yours yet
    style = { border: `1.5px dashed ${color}`, color, background: "rgba(12,16,26,.55)", opacity: active ? 1 : 0.7 };
  } else {
    const p = item.pin;
    color = PIN_KINDS[p.kind].color;
    glyph = PIN_KINDS[p.kind].glyph;
    title = `${p.pursued_at ? "★ " : ""}${t(PIN_KINDS[p.kind].en, PIN_KINDS[p.kind].de)}: ${p.body ? tx(p.body) : t("(empty)", "(leer)")}`;
    style = p.status === "done" && p.kind === "question"
      ? { border: `1.5px solid ${color}`, color: "#0c101a", background: color }
      : { border: `${p.status === "active" ? 2.5 : 1.5}px ${unsupported ? "dashed" : "solid"} ${color}`, color, background: "#0c101a" };
  }
  return (
    <button
      className="nodrag nopan"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{ animation: "pinPop .45s ease both", position: "absolute", left: x - D / 2, top: y - D / 2, width: D, height: D, borderRadius: D, pointerEvents: "auto", zIndex: 41, boxShadow: [item.type === "pin" && item.pin.pursued_at ? `0 0 0 2px #0c101a, 0 0 0 3.5px ${PURSUIT_COLOR}` : "", active ? `0 0 0 6px ${color}44` : ""].filter(Boolean).join(", ") || undefined, fontSize: item.type === "sig" ? 9 : 12, fontWeight: 600, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", ...style }}
    >
      {glyph}
    </button>
  );
}

function Card({ x, y, onClose, children, width = 250 }: { x: number; y: number; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div
      className="nodrag nopan nowheel glass glass-bright rounded-xl p-2.5"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ position: "absolute", left: x - 12, top: y + 18, width, pointerEvents: "auto", zIndex: 60, background: "rgba(12,16,26,0.97)", borderColor: "rgba(248,153,29,.45)", boxShadow: "0 18px 30px -8px rgba(0,0,0,.65)" }}
    >
      <button onClick={onClose} aria-label="Close" className="absolute top-1 right-2 text-muted hover:text-text text-sm leading-none">×</button>
      {children}
    </div>
  );
}

function SignalCard({ sig, x, y, onClose, onAsk, onPursue, onPromote, onDismiss }: { sig: Signal; x: number; y: number; onClose: () => void; onAsk: () => Promise<void>; onPursue: () => void; onPromote: () => void; onDismiss: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const color = sig.level === "high" ? SIGNAL_HIGH : SIGNAL_WARN;
  return (
    <Card x={x} y={y} onClose={onClose}>
      <div className="font-mono text-[0.58rem] tracking-[0.14em]" style={{ color }}>▲ {t("SIGNAL", "SIGNAL")} · {sig.level === "high" ? t("LIKELY HURTING", "VERMUTLICH SCHÄDLICH") : t("WORTH A LOOK", "BEACHTENSWERT")}</div>
      <div className="mt-1.5 text-[0.76rem] text-text/90 leading-snug">{t(sig.en, sig.de)}</div>
      <div className="mt-1 text-[0.66rem] text-muted">{t("Loom spotted this from your map. It's only a suggestion until you act on it.", "Loom hat das in Ihrer Karte entdeckt. Es bleibt ein Vorschlag, bis Sie handeln.")}</div>
      {busy ? (
        <div className="mt-2.5 flex items-center gap-2 text-[0.72rem] text-orange">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-orange/30 border-t-orange animate-spin" aria-hidden />
          {t("Loom is phrasing a question…", "Loom formuliert eine Frage …")}
        </div>
      ) : (
        <div className="mt-2.5 flex flex-col gap-1.5">
          <button onClick={async () => { setBusy(true); await onAsk(); setBusy(false); }} className="rounded-full border border-orange/60 bg-orange/10 text-orange text-[0.7rem] px-3 py-1.5 hover:bg-orange/20 text-left">
            ✦ {t("Ask Loom to make this a question…", "Loom bitten, daraus eine Frage zu machen …")}
          </button>
          <button onClick={onPursue} className="rounded-full border border-amber-300/50 text-amber-200 text-[0.7rem] px-3 py-1.5 hover:bg-amber-300/10 text-left">
            ☆ {t("Pursue this as it is", "So verfolgen, wie es ist")}
          </button>
          <div className="flex gap-3 text-[0.66rem] text-muted px-1">
            <button onClick={onPromote} className="hover:text-text">{t("Use as written", "So übernehmen")}</button>
            <button onClick={onDismiss} className="hover:text-text">{t("Dismiss", "Verwerfen")}</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function PinCard({ pin, pins, x, y, onPursue, onUnpursue, onPatch, onDelete, onClose, onAdd, setOpenKey }: { pin: FlowPin; pins: FlowPin[]; x: number; y: number; onPursue: (p: FlowPin) => void; onUnpursue: (p: FlowPin) => void; onPatch: (id: string, patch: Partial<FlowPin>) => void; onDelete: (id: string) => void; onClose: () => void; onAdd: Add; setOpenKey: (k: string | null) => void }) {
  const t = useT();
  const tx = useTx();
  const k = PIN_KINDS[pin.kind];
  const [draft, setDraft] = useState(pin.body);
  const [why, setWhy] = useState(pin.support ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const whyRef = useRef(why);
  whyRef.current = why;
  const wasEmpty = useRef(!pin.body);
  useEffect(() => { if (wasEmpty.current) ref.current?.focus(); }, []);
  // save as you type, and once more when the card closes
  useEffect(() => {
    const v = draft.trim();
    if (!v || v === pin.body) return;
    const id = setTimeout(() => onPatch(pin.id, { body: v }), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  useEffect(() => {
    const v = why.trim();
    if (v === (pin.support ?? "")) return;
    const id = setTimeout(() => onPatch(pin.id, { support: v || null }), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [why]);
  useEffect(() => () => {
    const v = draftRef.current.trim();
    if (v && v !== pin.body) onPatch(pin.id, { body: v });
    const w = whyRef.current.trim();
    if (pin.kind === "idea" && w !== (pin.support ?? "")) onPatch(pin.id, { support: w || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const statuses = STATUS_LABELS[pin.kind];
  const cur = pin.status === "dismissed" ? "open" : pin.status;
  const child = async (kind: PinKind) => {
    const v = draft.trim();
    if (v !== pin.body) onPatch(pin.id, { body: v });
    const p = await onAdd({ node_id: pin.node_id, edge_id: pin.edge_id, kind, parent_id: pin.id });
    setOpenKey(p ? `pin:${p.id}` : null);
  };

  // ideas: is there any support behind it? (the label drops as soon as there is)
  const hasFinding = pins.some((c) => c.parent_id === pin.id && c.kind === "finding" && c.status !== "dismissed");
  const supported = !!pin.parent_id || !!why.trim() || hasFinding;

  return (
    <Card x={x} y={y} onClose={onClose}>
      <div className="flex items-center gap-2 pr-4">
        <span className="font-mono text-[0.58rem] tracking-[0.14em]" style={{ color: k.color }}>{k.glyph} {t(k.en, k.de).toUpperCase()}</span>
        {pin.kind === "idea" && !supported && (
          <span className="font-mono text-[0.56rem] tracking-wider text-amber-300/80 border border-amber-300/30 rounded-full px-1.5 py-px">{t("NO EVIDENCE YET", "NOCH KEIN BELEG")}</span>
        )}
      </div>
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onClose(); } }}
        onBlur={() => { const v = draft.trim(); if (v !== pin.body && v) onPatch(pin.id, { body: v }); }}
        rows={Math.min(9, Math.max(3, Math.ceil(draft.length / 30)))}
        placeholder={pin.kind === "question" ? t("What do we want to understand?", "Was möchten wir verstehen?") : pin.kind === "finding" ? t("What did we find? Add the evidence.", "Was haben wir gefunden? Belege ergänzen.") : t("What could we change?", "Was könnten wir ändern?")}
        className="mt-2 w-full resize-none bg-black/40 border border-white/15 rounded-md text-[0.78rem] text-text px-2 py-1.5 outline-none focus:border-orange/60 placeholder:text-text/40"
      />
      {draft.trim() && tx(draft) !== draft.trim() && (
        <div className="mt-1.5 text-[0.7rem] text-text/70 leading-snug italic">{tx(draft)}</div>
      )}
      {pin.kind === "idea" && !pin.parent_id && (
        <input
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onClose(); } }}
          placeholder={t("Because… (a reason or some evidence)", "Weil … (ein Grund oder ein Beleg)")}
          className="mt-1.5 w-full bg-black/30 border border-white/10 rounded-md text-[0.72rem] text-text px-2 py-1 outline-none focus:border-orange/60 placeholder:text-text/35"
        />
      )}
      {statuses.length > 0 && (
        <div className="mt-2 flex rounded-full border border-white/15 overflow-hidden text-[0.64rem]">
          {statuses.map((st) => (
            <button
              key={st.key}
              onClick={() => onPatch(pin.id, { status: st.key })}
              className={`flex-auto whitespace-nowrap px-2 py-1 transition-colors ${cur === st.key ? "bg-orange/20 text-orange" : "text-muted hover:text-text"}`}
            >
              {t(st.en, st.de)}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2">
        {pin.pursued_at ? (
          <div className="rounded-lg border border-amber-300/50 bg-amber-300/10 px-2 py-1.5 text-[0.7rem]">
            <div className="flex items-center gap-2 text-amber-200">
              <span>★ {t("Pursued", "Verfolgt")}</span>
              <button onClick={() => onUnpursue(pin)} className="ml-auto text-amber-200/70 hover:text-text">{t("Remove", "Entfernen")}</button>
            </div>
            {pin.lineage && pin.lineage.length > 0 && <div className="mt-1 text-muted leading-snug"><LineageTrail lineage={pin.lineage} /></div>}
          </div>
        ) : (
          <button
            onClick={() => { const v = draft.trim(); if (v && v !== pin.body) onPatch(pin.id, { body: v }); onPursue({ ...pin, body: v || pin.body }); }}
            disabled={!draft.trim()}
            title={t("Collect this in Pursuits, with where it came from", "In den Vorhaben sammeln, samt Herkunft")}
            className="w-full rounded-full border border-amber-300/50 text-amber-200 hover:bg-amber-300/10 disabled:opacity-40 disabled:hover:bg-transparent text-[0.72rem] py-1"
          >
            ☆ {t("Pursue", "Verfolgen")}
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[0.68rem]">
        {pin.kind === "question" && (
          <>
            <button onClick={() => child("finding")} className="text-muted hover:text-text">+ {t("Finding", "Befund")}</button>
            <button onClick={() => child("idea")} className="text-muted hover:text-text">+ {t("Idea", "Idee")}</button>
          </>
        )}
        {pin.kind === "finding" && <button onClick={() => child("idea")} className="text-muted hover:text-text">+ {t("Idea", "Idee")}</button>}
        {pin.kind === "idea" && !pin.parent_id && !hasFinding && <button onClick={() => child("finding")} className="text-muted hover:text-text">+ {t("Finding", "Befund")}</button>}
        <button onClick={() => { onDelete(pin.id); onClose(); }} className="ml-auto text-muted hover:text-red-300">{t("Delete", "Löschen")}</button>
      </div>
      {pin.author_name && <div className="mt-1 text-[0.6rem] text-muted/70">{pin.author_name}</div>}
    </Card>
  );
}

const TRAIL: Record<string, { en: string; de: string; color: string; glyph: string }> = {
  signal: { en: "Signal", de: "Signal", color: SIGNAL_WARN, glyph: "▲" },
  question: PIN_KINDS.question,
  finding: PIN_KINDS.finding,
  idea: PIN_KINDS.idea,
  at: { en: "At", de: "An", color: "#9aa3b2", glyph: "@" },
};

/** "Signal › Question › Idea @ Step": the story of where a pursuit came from. */
export function LineageTrail({ lineage, limit = 26 }: { lineage: Lineage; limit?: number }) {
  const lang = useLang();
  const tx = useTx();
  const cut = (v: string) => (v.length > limit ? v.slice(0, limit - 1).trimEnd() + "…" : v);
  return (
    <span>
      {lineage.map((l, i) => {
        const k = TRAIL[l.kind] ?? TRAIL.at;
        const text = l.kind === "signal" ? (lang === "de" && l.de ? l.de : l.text) : tx(l.text);
        return (
          <span key={i}>
            {i > 0 && <span className="opacity-50">{l.kind === "at" ? "  " : " › "}</span>}
            <span style={{ color: k.color }}>{k.glyph}</span> {cut(text)}
          </span>
        );
      })}
    </span>
  );
}

/** Summary shown in the tools drawer: what the layer holds, and how to read the pins. */
export function LayerLegend({ pins, signals }: { pins: FlowPin[]; signals: Signal[] }) {
  const t = useT();
  const live = pins.filter((p) => p.status !== "dismissed");
  const used = new Set(pins.map((p) => p.origin).filter(Boolean) as string[]);
  const open = signals.filter((s) => !used.has(s.key));
  const n = (k: PinKind) => live.filter((p) => p.kind === k).length;
  const row = (dot: ReactNode, label: string, count: number, tip: { title: string; body: string; how?: string }) => (
    <div className="flex items-center gap-2">
      {dot}
      <span className="flex-1">{label}</span>
      <HelpTip {...tip} />
      <span className="font-mono text-muted w-4 text-right">{count}</span>
    </div>
  );
  const dot = (color: string, glyph: string, dashed = false) => (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.62rem] flex-none" style={{ border: `1.5px ${dashed ? "dashed" : "solid"} ${color}`, color, opacity: dashed ? 0.75 : 1 }}>{glyph}</span>
  );
  return (
    <div className="px-1 text-text/85 flex flex-col gap-1.5">
      <div>{t("Select a step or line, then press + to pin a Question, Finding or Idea. Esc to return.", "Schritt oder Linie wählen und mit + eine Frage, einen Befund oder eine Idee anheften. Esc zum Zurückkehren.")}</div>
      {row(dot(SIGNAL_WARN, "▲", true), t("Signals (Loom's suggestions)", "Signale (Vorschläge von Loom)"), open.length, {
        title: t("Signals", "Signale"),
        body: t("Things Loom noticed in your map: long waits, rework loops, painful hand-offs, work that bounces between lanes. Amber is worth a look, orange is likely hurting.", "Auffälligkeiten, die Loom in Ihrer Karte bemerkt hat: lange Wartezeiten, Nacharbeit, schmerzhafte Übergaben, Arbeit, die zwischen Bahnen hin- und herspringt. Gelb: ansehen. Orange: vermutlich schädlich."),
        how: t("Click one to turn it into a question, pursue it as it is, or dismiss it. A signal is only a suggestion until you act.", "Anklicken, um daraus eine Frage zu machen, es direkt zu verfolgen oder zu verwerfen. Ein Signal bleibt ein Vorschlag, bis Sie handeln."),
      })}
      {row(dot(PIN_KINDS.question.color, "?"), t("Questions", "Fragen"), n("question"), {
        title: t("Questions", "Fragen"),
        body: t("What you want to understand before changing anything. A good question is open: why, what, when.", "Was Sie verstehen wollen, bevor Sie etwas ändern. Eine gute Frage ist offen: warum, was, wann."),
        how: t("Pin one on any step or line with +, or let Loom phrase one from a signal. Mark it Open, Exploring or Answered.", "Mit + an einem Schritt oder einer Linie anheften oder von Loom aus einem Signal formulieren lassen. Status: Offen, In Klärung, Beantwortet."),
      })}
      {row(dot(PIN_KINDS.finding.color, "◆"), t("Findings", "Befunde"), n("finding"), {
        title: t("Findings", "Befunde"),
        body: t("What you learned: a fact, a measurement, something someone told you. A finding is evidence.", "Was Sie erfahren haben: eine Tatsache, eine Messung, eine Aussage. Ein Befund ist ein Beleg."),
        how: t("Add one under a question, or pin it directly. Ideas backed by a finding lose their “no evidence yet” tag.", "Unter einer Frage oder direkt anheften. Ideen mit Befund verlieren ihr „Noch kein Beleg“."),
      })}
      {row(dot(PIN_KINDS.idea.color, "✦"), t("Ideas", "Ideen"), n("idea"), {
        title: t("Ideas", "Ideen"),
        body: t("What could change. An idea can stand alone, but one with a reason or a finding behind it is stronger. Dashed means no evidence yet.", "Was sich ändern könnte. Eine Idee darf allein stehen, mit Grund oder Befund ist sie stärker. Gestrichelt: noch kein Beleg."),
        how: t("Type a “Because…” or add a finding and the dashes go away. An aha moment is enough to start.", "Ein „Weil …“ oder ein Befund, und die Striche verschwinden. Ein Aha-Moment reicht zum Start."),
      })}
      {row(dot(PURSUIT_COLOR, "★"), t("Pursuits", "Vorhaben"), live.filter((p) => p.pursued_at).length, {
        title: t("Pursuits", "Vorhaben"),
        body: t("Anything you decide to chase: a signal, question, finding or idea. Pursue collects it in the left panel and remembers where it came from.", "Alles, dem Sie nachgehen wollen: Signal, Frage, Befund oder Idee. „Verfolgen“ sammelt es links und merkt sich die Herkunft."),
        how: t("Click a pursuit in the left panel to jump back to its spot on the map.", "Ein Vorhaben links anklicken, um zu seiner Stelle auf der Karte zu springen."),
      })}
    </div>
  );
}

/** Previous / next through every insight on the map, in reading order. */
export function HopBar({ index, total, label, onPrev, onNext }: { index: number; total: number; label: string; onPrev: () => void; onNext: () => void }) {
  const t = useT();
  if (!total) return null;
  const btn = "w-6 h-6 rounded-full border border-white/20 text-text/80 hover:text-orange hover:border-orange/60 leading-none";
  return (
    <div className="flex items-center gap-2 text-[0.72rem]">
      <button onClick={onPrev} className={btn} aria-label={t("Previous insight", "Vorherige Erkenntnis")}>‹</button>
      <span className="font-mono text-muted">{index >= 0 ? index + 1 : "–"}/{total}</span>
      <button onClick={onNext} className={btn} aria-label={t("Next insight", "Nächste Erkenntnis")}>›</button>
      <span className="flex-1 truncate text-muted">{label}</span>
    </div>
  );
}
