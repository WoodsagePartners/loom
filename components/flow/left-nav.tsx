"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACTOR_KINDS,
  PALETTE,
  pickColor,
  NEUTRAL,
  type Actor,
  type ActorKind,
  type Lane,
  type Lens,
  type Roadmap,
  type RoadmapPhase,
  type Workflow,
} from "@/lib/flow";
import { ShapeIcon } from "@/components/flow/shapes";
import { useT } from "@/lib/i18n";
import { Tx, useTx } from "@/lib/content-i18n";

type Props = {
  workflows: Workflow[];
  activeWorkflowId: string | null;
  lanes: Lane[];
  actors: Actor[];
  memberHint: string;
  onSelectWorkflow: (id: string) => void;
  onCreateWorkflow: (name: string, color?: string) => void;
  onPatchWorkflow: (id: string, patch: Partial<Workflow>) => void;
  onDeleteWorkflow: (id: string) => void;
  onDuplicateWorkflow: (id: string) => void;
  onAddLane: (name: string, color?: string) => void;
  onPatchLane: (id: string, patch: Partial<Lane>) => void;
  onMoveLane: (id: string, dir: -1 | 1) => void;
  onDeleteLane: (id: string) => void;
  onDuplicateLane: (id: string) => void;
  onAddActor: (a: { name: string; kind: ActorKind; role: string }) => void;
  onPatchActor: (id: string, patch: Partial<Actor>) => void;
  onDeleteActor: (id: string) => void;
  onOpenTeam: () => void;
  roadmaps: Roadmap[];
  phases: RoadmapPhase[];
  phaseCounts: Record<string, number>;
  lens: Lens;
  onLens: (l: Lens) => void;
  onAddRoadmap: (name: string, color?: string) => void;
  onPatchRoadmap: (id: string, patch: Partial<Roadmap>) => void;
  onDeleteRoadmap: (id: string) => void;
  onAddPhase: (roadmapId: string, name: string, color?: string) => void;
  onPatchPhase: (id: string, patch: Partial<RoadmapPhase>) => void;
  onDeletePhase: (id: string) => void;
};

const SECTIONS = [
  { key: "workflows", glyph: "▤" },
  { key: "lanes", glyph: "☰" },
  { key: "actors", glyph: "◉" },
  { key: "roadmaps", glyph: "⚑" },
  { key: "team", glyph: "☺" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

function useAutoFocus() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const ids = [0, 60, 200].map((ms) => setTimeout(() => ref.current?.focus(), ms));
    return () => ids.forEach(clearTimeout);
  }, []);
  return ref;
}

/** names in their palette colour, but softened toward the text colour so a long list doesn't read as a rainbow */
const soft = (c: string | null | undefined) => (c ? `color-mix(in srgb, ${c} 58%, rgb(var(--c-text)))` : undefined);

const FIELD =
  "w-full bg-black/25 border border-white/10 rounded-md text-[0.74rem] text-text/75 placeholder:text-muted/50 px-2.5 py-1 outline-none focus:border-orange/40 focus:text-text";

function Swatches({ value, onPick }: { value: string | null; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-nowrap gap-1.5 my-1.5 pl-0.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          aria-label={c}
          className="w-3.5 h-3.5 flex-none rounded-full border transition-all hover:opacity-100 hover:scale-110"
          style={{ background: c, opacity: value === c ? 1 : 0.5, filter: "saturate(.8)", borderColor: value === c ? "rgba(255,255,255,.85)" : "transparent" }}
        />
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  open,
  onToggle,
  onAdd,
  addLabel,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1.5 mt-2 border-t border-white/10 first:mt-0 first:border-t-0">
      <button onClick={onToggle} aria-expanded={open} className="flex-1 flex items-center gap-2 text-left group/h">
        <span className="w-3 text-[0.8rem] leading-none text-muted group-hover/h:text-orange transition-colors">{open ? "▾" : "▸"}</span>
        <span className="text-[0.78rem] font-medium tracking-[0.12em] uppercase text-text/90">{title}</span>
        {count !== undefined && <span className="font-mono text-[0.72rem] text-muted/60">{count}</span>}
      </button>
      {onAdd && open && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onAdd}
          title={addLabel}
          className="w-5 h-5 text-sm rounded-full border border-white/15 text-muted hover:text-orange hover:border-orange/50 leading-none"
        >
          +
        </button>
      )}
    </div>
  );
}

function AddRow({ placeholder, onSubmit, onCancel, colorSeed }: { placeholder: string; onSubmit: (v: string, color: string) => void; onCancel: () => void; colorSeed: number }) {
  const [v, setV] = useState("");
  const [color, setColor] = useState<string>(pickColor(colorSeed));
  const ref = useAutoFocus();
  return (
    <form
      className="pl-8 pr-3 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSubmit(v.trim(), color);
        setV("");
      }}
    >
      <input
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        onBlur={() => !v && onCancel()}
        placeholder={placeholder}
        className={FIELD}
      />
      <Swatches value={color} onPick={setColor} />
    </form>
  );
}

export function LeftNav(p: Props) {
  const t = useT();
  const tx = useTx();
  const [pinned, setPinned] = useState(true);
  const [hover, setHover] = useState(false);
  const [suppress, setSuppress] = useState(false); // after clicking Collapse, ignore hover until the pointer leaves
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ workflows: true, lanes: true, actors: true, roadmaps: true, team: false });
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newActor, setNewActor] = useState<{ name: string; kind: ActorKind; role: string } | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("loom_nav_pinned");
      if (v !== null) setPinned(v === "1");
    } catch {}
  }, []);
  const togglePin = () => {
    if (pinned) {
      setHover(false);
      setSuppress(true);
    }
    setPinned((x) => {
      try {
        localStorage.setItem("loom_nav_pinned", x ? "0" : "1");
      } catch {}
      return !x;
    });
  };

  const expanded = pinned || hover;
  const title = (k: SectionKey) =>
    ({ workflows: t("Processes", "Prozesse"), lanes: t("Lanes", "Bahnen"), actors: t("Roles", "Rollen"), roadmaps: t("Plans", "Pläne"), team: t("Team", "Team") })[k];
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const jump = (k: SectionKey) => {
    setHover(true);
    setOpen((o) => ({ ...o, [k]: true }));
  };

  const isLens = (kind: "lane" | "actor" | "phase" | "roadmap", id: string) => p.lens?.kind === kind && p.lens.id === id;
  const rowCls = "group flex items-center gap-2 pl-8 pr-3 py-1 hover:bg-white/5";

  return (
    <>
      {/* spacer so the canvas shifts when pinned */}
      <div className="flex-none transition-[width] duration-200" style={{ width: pinned ? 244 : 56 }} />
      <aside
        onMouseEnter={() => !suppress && setHover(true)}
        onMouseLeave={() => {
          setHover(false);
          setSuppress(false);
        }}
        onKeyDown={(e) => {
          const el = e.target as HTMLElement;
          if (e.key === "Enter" && el.tagName === "INPUT" && !el.closest("form")) (el as HTMLInputElement).blur();
        }}
        className="glass-chrome absolute inset-y-0 left-0 z-30 border-r border-white/10 overflow-hidden shadow-2xl transition-[width] duration-200 ease-out flex flex-col"
        style={{ width: expanded ? 244 : 56, ...(expanded && !pinned ? { background: "var(--tint-dense)", backdropFilter: "blur(30px) saturate(1.4)", WebkitBackdropFilter: "blur(30px) saturate(1.4)" } : {}) }}
      >
        {!expanded ? (
          <div className="flex flex-col items-center pt-3 gap-1">
            <span className="text-orange text-sm mb-1">≡</span>
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => jump(s.key)}
                title={title(s.key)}
                className="w-10 h-10 rounded-lg text-muted hover:text-orange hover:bg-white/5 text-base"
              >
                {s.glyph}
              </button>
            ))}
          </div>
        ) : (
          <>
          <div className="nav-scroll flex-1 overflow-y-auto pb-6 min-w-[244px]">
            {/* ---------------------------------------------- workflows --- */}
            <SectionHeader
              title={title("workflows")}
              count={p.workflows.length}
              open={open.workflows}
              onToggle={() => toggle("workflows")}
              onAdd={() => {
                setOpen((o) => ({ ...o, workflows: true }));
                setAdding((a) => (a === "workflows" ? null : "workflows"));
              }}
              addLabel={t("New process", "Neuer Prozess")}
            />
            {open.workflows && (
              <div>
                {adding === "workflows" && (
                  <AddRow
                    placeholder={t("Name the process…", "Prozess benennen…")}
                    colorSeed={p.workflows.length}
                    onSubmit={(v, c) => {
                      p.onCreateWorkflow(v, c);
                      setAdding(null);
                    }}
                    onCancel={() => setAdding(null)}
                  />
                )}
                {p.workflows.length === 0 && adding !== "workflows" && (
                  <div className="pl-8 pr-3 py-1 text-[0.76rem] text-muted/70">{t("No processes yet.", "Noch keine Prozesse.")}</div>
                )}
                {p.workflows.map((w, wi) => (
                  <div key={w.id}>
                    <div
                      className={`${rowCls} cursor-pointer ${w.id === p.activeWorkflowId ? "bg-orange/10" : ""}`}
                      onClick={() => p.onSelectWorkflow(w.id)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: w.color ?? NEUTRAL }} />
                      <span title={tx(w.name)} className="flex-1 truncate text-[0.76rem] ink-text" style={{ color: soft(w.color) }}><Tx text={w.name} d={wi * 160} /></span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          p.onDuplicateWorkflow(w.id);
                        }}
                        className="text-muted/50 hover:text-orange text-xs opacity-0 group-hover:opacity-100"
                        title={t("Duplicate process", "Prozess duplizieren")}
                      >
                        ⧉
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(editing === w.id ? null : w.id);
                        }}
                        className="text-muted/50 hover:text-text text-xs opacity-0 group-hover:opacity-100"
                        title={t("Edit", "Bearbeiten")}
                      >
                        ✎
                      </button>
                    </div>
                    {editing === w.id && (
                      <div className="pl-8 pr-3 pb-3 bg-white/[0.03]">
                        <input
                          defaultValue={w.name}
                          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== w.name && p.onPatchWorkflow(w.id, { name: e.target.value.trim() })}
                          className={FIELD + " mt-2"}
                        />
                        <textarea
                          defaultValue={w.description ?? ""}
                          rows={2}
                          placeholder={t("What is this process for?", "Wofür ist dieser Prozess?")}
                          onBlur={(e) => e.target.value !== (w.description ?? "") && p.onPatchWorkflow(w.id, { description: e.target.value || null })}
                          className={FIELD + " mt-2 resize-none"}
                        />
                        <textarea
                          defaultValue={w.ai_context ?? ""}
                          rows={3}
                          placeholder={t("Context for the AI: what is this process for, what does good look like, anything unusual?", "Kontext für die KI: Wofür ist dieser Prozess, was ist ein gutes Ergebnis, was ist ungewöhnlich?")}
                          onBlur={(e) => e.target.value !== (w.ai_context ?? "") && p.onPatchWorkflow(w.id, { ai_context: e.target.value.trim() || null })}
                          className={FIELD + " mt-2 resize-none"}
                        />
                        <Swatches value={w.color} onPick={(c) => p.onPatchWorkflow(w.id, { color: c })} />
                        <div className="flex items-center gap-4">
                          <button onClick={() => p.onDuplicateWorkflow(w.id)} className="text-[0.72rem] text-muted hover:text-orange">
                            {t("Duplicate process", "Prozess duplizieren")}
                          </button>
                          <button onClick={() => p.onDeleteWorkflow(w.id)} className="text-[0.72rem] text-muted hover:text-red-300">
                            {t("Delete process", "Prozess löschen")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* --------------------------------------------------- lanes --- */}
            <SectionHeader
              title={title("lanes")}
              count={p.activeWorkflowId ? p.lanes.length : undefined}
              open={open.lanes}
              onToggle={() => toggle("lanes")}
              onAdd={p.activeWorkflowId ? () => { setOpen((o) => ({ ...o, lanes: true })); setAdding((a) => (a === "lanes" ? null : "lanes")); } : undefined}
              addLabel={t("Add lane", "Bahn hinzufügen")}
            />
            {open.lanes && (
              <div>
                                {!p.activeWorkflowId && <div className="pl-8 pr-3 py-1 text-[0.76rem] text-muted/70">{t("Pick a process first.", "Wählen Sie zuerst einen Prozess.")}</div>}
                {adding === "lanes" && (
                  <AddRow
                    placeholder={t("Name the lane (e.g. Order intake)…", "Bahn benennen (z. B. Auftragseingang)…")}
                    colorSeed={p.lanes.length}
                    onSubmit={(v, c) => { p.onAddLane(v, c); setAdding(null); }}
                    onCancel={() => setAdding(null)}
                  />
                )}
                {p.lanes.map((l, i) => (
                  <div key={l.id}>
                    <div className={`${rowCls} cursor-pointer ${isLens("lane", l.id) ? "bg-white/10" : ""}`} onClick={() => p.onLens(isLens("lane", l.id) ? null : { kind: "lane", id: l.id })}>
                      <span className="w-1.5 h-5 rounded-sm flex-none" style={{ background: l.color ?? NEUTRAL }} />
                      <span title={tx(l.name)} className="flex-1 truncate text-[0.76rem] ink-text" style={{ color: soft(l.color) }}><Tx text={l.name} d={160 + i * 160} /></span>
                      <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 text-muted/70" onClick={(e) => e.stopPropagation()}>
                        <button disabled={i === 0} onClick={() => p.onMoveLane(l.id, -1)} className="px-1 hover:text-text disabled:opacity-30" title={t("Move up", "Nach oben")}>↑</button>
                        <button disabled={i === p.lanes.length - 1} onClick={() => p.onMoveLane(l.id, 1)} className="px-1 hover:text-text disabled:opacity-30" title={t("Move down", "Nach unten")}>↓</button>
                        <button onClick={() => p.onDuplicateLane(l.id)} className="px-1 hover:text-orange" title={t("Duplicate lane", "Bahn duplizieren")}>⧉</button>
                        <button onClick={() => setEditing(editing === l.id ? null : l.id)} className="px-1 hover:text-text" title={t("Edit", "Bearbeiten")}>✎</button>
                      </span>
                    </div>
                    {editing === l.id && (
                      <div className="pl-8 pr-3 pb-3 bg-white/[0.03]">
                        <input
                          defaultValue={l.name}
                          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== l.name && p.onPatchLane(l.id, { name: e.target.value.trim() })}
                          className={FIELD + " mt-2"}
                        />
                        <Swatches value={l.color} onPick={(c) => p.onPatchLane(l.id, { color: c })} />
                        <button onClick={() => p.onDeleteLane(l.id)} className="text-[0.72rem] text-muted hover:text-red-300">
                          {t("Delete lane", "Bahn löschen")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ------------------------------------------------- actors --- */}
            <SectionHeader
              title={title("actors")}
              count={p.actors.length}
              open={open.actors}
              onToggle={() => toggle("actors")}
              onAdd={() => { setOpen((o) => ({ ...o, actors: true })); setNewActor((n) => (n ? null : { name: "", kind: "team", role: "" })); }}
              addLabel={t("Add role", "Rolle hinzufügen")}
            />
            {open.actors && (
              <div>
                {newActor && (
                  <form
                    className="pl-8 pr-3 pb-3 bg-white/[0.03]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newActor.name.trim()) {
                        p.onAddActor({ ...newActor, name: newActor.name.trim() });
                        setNewActor(null);
                      }
                    }}
                  >
                    <input
                      ref={(el) => {
                        if (el && !el.dataset.f) {
                          el.dataset.f = "1";
                          [0, 60, 200].forEach((ms) => setTimeout(() => el.focus(), ms));
                        }
                      }}
                      value={newActor.name}
                      onChange={(e) => setNewActor({ ...newActor, name: e.target.value })}
                      placeholder={t("Name (e.g. Sales, SAP, Anna)", "Name (z. B. Vertrieb, SAP, Anna)")}
                      className={FIELD + " mt-2"}
                    />
                    <div className="grid grid-cols-5 gap-1.5 mt-2">
                      {ACTOR_KINDS.map((k) => (
                        <button
                          key={k.key}
                          type="button"
                          title={`${t(k.en, k.de)} — ${t(k.hint, k.hintDe)}`}
                          onClick={() => setNewActor({ ...newActor, kind: k.key })}
                          className={`rounded-md border py-1.5 flex justify-center ${newActor.kind === k.key ? "border-orange/70 bg-orange/10" : "border-white/10"}`}
                        >
                          <ShapeIcon kind={k.key} color={newActor.kind === k.key ? "#f8991d" : "#93a5b6"} size={24} />
                        </button>
                      ))}
                    </div>
                    <div className="text-[0.72rem] text-muted mt-1">
                      {(() => { const k = ACTOR_KINDS.find((x) => x.key === newActor.kind)!; return `${t(k.en, k.de)} — ${t(k.hint, k.hintDe)}`; })()}
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <button className="rounded-full border border-orange/60 bg-orange/15 text-orange hover:bg-orange/25 text-[0.72rem] font-mono tracking-wider px-3 py-1 transition-colors">{t("ADD", "HINZUFÜGEN")}</button>
                      <button type="button" onClick={() => setNewActor(null)} className="text-[0.74rem] text-muted hover:text-text">{t("Cancel", "Abbrechen")}</button>
                    </div>
                  </form>
                )}
                {p.actors.length === 0 && !newActor && (
                  <div className="pl-8 pr-3 py-1 text-[0.76rem] text-muted/70">{t("Add the roles in your process: people, teams, systems.", "Fügen Sie die Rollen Ihres Prozesses hinzu: Personen, Teams, Systeme.")}</div>
                )}
                {p.actors.map((a, ai) => (
                  <div key={a.id}>
                    <div className={`${rowCls} cursor-pointer ${isLens("actor", a.id) ? "bg-white/10" : ""}`} onClick={() => p.onLens(isLens("actor", a.id) ? null : { kind: "actor", id: a.id })}>
                      <ShapeIcon kind={a.kind} color={a.color ?? NEUTRAL} size={26} />
                      <span className="flex-1 min-w-0">
                        <span title={tx(a.name)} className="block truncate text-[0.76rem] ink-text" style={{ color: soft(a.color) }}><Tx text={a.name} d={320 + ai * 160} /></span>
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); setEditing(editing === a.id ? null : a.id); }} className="text-muted/50 hover:text-text text-xs opacity-0 group-hover:opacity-100" title={t("Edit", "Bearbeiten")}>✎</button>
                    </div>
                    {editing === a.id && (
                      <div className="pl-8 pr-3 pb-3 bg-white/[0.03]">
                        <input defaultValue={a.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== a.name && p.onPatchActor(a.id, { name: e.target.value.trim() })} className={FIELD + " mt-2"} />
                        <div className="grid grid-cols-5 gap-1.5 mt-2">
                          {ACTOR_KINDS.map((k) => (
                            <button key={k.key} type="button" title={t(k.en, k.de)} onClick={() => p.onPatchActor(a.id, { kind: k.key })} className={`rounded-md border py-1.5 flex justify-center ${a.kind === k.key ? "border-orange/70 bg-orange/10" : "border-white/10"}`}>
                              <ShapeIcon kind={k.key} color={a.kind === k.key ? "#f8991d" : "#93a5b6"} size={24} />
                            </button>
                          ))}
                        </div>
                        <Swatches value={a.color} onPick={(c) => p.onPatchActor(a.id, { color: c })} />
                        <button onClick={() => p.onDeleteActor(a.id)} className="text-[0.72rem] text-muted hover:text-red-300">{t("Delete role", "Rolle löschen")}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ---------------------------------------------- roadmaps --- */}
            <SectionHeader
              title={title("roadmaps")}
              count={p.activeWorkflowId ? p.roadmaps.length : undefined}
              open={open.roadmaps}
              onToggle={() => toggle("roadmaps")}
              onAdd={p.activeWorkflowId ? () => { setOpen((o) => ({ ...o, roadmaps: true })); setAdding((a) => (a === "roadmaps" ? null : "roadmaps")); } : undefined}
              addLabel={t("New plan", "Neuer Plan")}
            />
            {open.roadmaps && (
              <div>
                {!p.activeWorkflowId && <div className="pl-8 pr-3 py-1 text-[0.76rem] text-muted/70">{t("Pick a process first.", "Wählen Sie zuerst einen Prozess.")}</div>}
                {adding === "roadmaps" && (
                  <AddRow
                    placeholder={t("Name the plan (e.g. Fix billing)…", "Plan benennen (z. B. Abrechnung verbessern)…")}
                    colorSeed={p.roadmaps.length + 2}
                    onSubmit={(v, c) => { p.onAddRoadmap(v, c); setAdding(null); }}
                    onCancel={() => setAdding(null)}
                  />
                )}
                {p.activeWorkflowId && p.roadmaps.length === 0 && adding !== "roadmaps" && (
                  <div className="pl-8 pr-3 py-1 text-[0.76rem] text-muted/70">{t("Group steps into phases to plan improvements.", "Gruppieren Sie Schritte in Phasen, um Verbesserungen zu planen.")}</div>
                )}
                {p.roadmaps.map((r, ri) => (
                  <div key={r.id}>
                    <div className={`${rowCls} cursor-pointer ${isLens("roadmap", r.id) ? "bg-white/10" : ""}`} onClick={() => p.onLens(isLens("roadmap", r.id) ? null : { kind: "roadmap", id: r.id })}>
                      <span className="w-2 h-2 rotate-45 flex-none" style={{ background: r.color ?? NEUTRAL }} />
                      <span title={tx(r.name)} className="flex-1 truncate text-[0.76rem] ink-text" style={{ color: soft(r.color) }}><Tx text={r.name} d={480 + ri * 160} /></span>
                      <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 text-muted/70" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setOpen((o) => ({ ...o, roadmaps: true })); setAdding((a) => (a === `phase:${r.id}` ? null : `phase:${r.id}`)); }} onMouseDown={(e) => e.preventDefault()} className="px-1 hover:text-text" title={t("Add phase", "Phase hinzufügen")}>+</button>
                        <button onClick={() => setEditing(editing === r.id ? null : r.id)} className="px-1 hover:text-text" title={t("Edit", "Bearbeiten")}>✎</button>
                      </span>
                    </div>
                    {editing === r.id && (
                      <div className="pl-8 pr-3 pb-3 bg-white/[0.03]">
                        <input defaultValue={r.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== r.name && p.onPatchRoadmap(r.id, { name: e.target.value.trim() })} className={FIELD + " mt-2"} />
                        <Swatches value={r.color} onPick={(c) => p.onPatchRoadmap(r.id, { color: c })} />
                        <button onClick={() => p.onDeleteRoadmap(r.id)} className="text-[0.72rem] text-muted hover:text-red-300">{t("Delete plan", "Plan löschen")}</button>
                      </div>
                    )}
                    {p.phases.filter((x) => x.roadmap_id === r.id).map((ph, pi) => (
                      <div key={ph.id}>
                        <div
                          className={`group flex items-center gap-2 pl-11 pr-3 py-1 hover:bg-white/5 cursor-pointer ${isLens("phase", ph.id) ? "bg-white/10" : ""}`}
                          onClick={() => p.onLens(isLens("phase", ph.id) ? null : { kind: "phase", id: ph.id })}
                        >
                          <span className="w-1.5 h-4 rounded-sm flex-none" style={{ background: ph.color ?? NEUTRAL }} />
                          <span title={tx(ph.name)} className="flex-1 truncate text-[0.72rem] ink-text" style={{ color: soft(ph.color) }}><Tx text={ph.name} d={560 + pi * 160} /></span>
                          <span className="font-mono text-[0.62rem] text-muted/60">{p.phaseCounts[ph.id] ?? 0}</span>
                          <button onClick={(e) => { e.stopPropagation(); setEditing(editing === ph.id ? null : ph.id); }} className="text-muted/50 hover:text-text text-xs opacity-0 group-hover:opacity-100" title={t("Edit", "Bearbeiten")}>✎</button>
                        </div>
                        {editing === ph.id && (
                          <div className="pl-11 pr-3 pb-3 bg-white/[0.03]">
                            <input defaultValue={ph.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== ph.name && p.onPatchPhase(ph.id, { name: e.target.value.trim() })} className={FIELD + " mt-2"} />
                            <Swatches value={ph.color} onPick={(c) => p.onPatchPhase(ph.id, { color: c })} />
                            <button onClick={() => p.onDeletePhase(ph.id)} className="text-[0.72rem] text-muted hover:text-red-300">{t("Delete phase", "Phase löschen")}</button>
                          </div>
                        )}
                      </div>
                    ))}
                    {adding === `phase:${r.id}` && (
                      <div className="pl-3">
                        <AddRow
                          placeholder={t("Name the phase (e.g. Quick wins)…", "Phase benennen (z. B. Schnelle Erfolge)…")}
                          colorSeed={(p.phases.filter((x) => x.roadmap_id === r.id).length) + 5}
                          onSubmit={(v, c) => { p.onAddPhase(r.id, v, c); setAdding(null); }}
                          onCancel={() => setAdding(null)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* --------------------------------------------------- team --- */}
            <button
              onClick={p.onOpenTeam}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left font-mono text-[0.78rem] tracking-[0.12em] uppercase text-text/90 hover:text-orange transition-colors"
              title={t("Manage team & invites", "Team & Einladungen verwalten")}
            >
              <span className="text-[0.62rem] text-muted">›</span>
              {title("team")}
            </button>
          </div>
          <div className="flex-none min-w-[244px] border-t border-white/10 px-3 py-2 flex items-center justify-between">
            
              <button
                onClick={togglePin}
                title={pinned ? t("Collapse the menu", "Menü einklappen") : t("Keep the menu open", "Menü offen halten")}
                className={`font-mono text-[0.58rem] tracking-[0.08em] uppercase px-2 py-0.5 rounded-full border ${
                  pinned ? "border-white/15 text-muted hover:text-orange hover:border-orange/50" : "border-orange/50 text-orange bg-orange/10"
                }`}
              >
                {pinned ? t("‹ Collapse", "‹ Einklappen") : t("Pin open", "Fixieren")}
              </button>
              <button
                onClick={() => {
                  const anyOpen = Object.values(open).some(Boolean);
                  setOpen({ workflows: !anyOpen, lanes: !anyOpen, actors: !anyOpen, roadmaps: !anyOpen, team: false });
                  setAdding(null);
                }}
                title={t("Fold or unfold every section", "Alle Bereiche ein- oder ausklappen")}
                className="font-mono text-[0.58rem] tracking-[0.08em] uppercase px-2 py-0.5 rounded-full border border-white/15 text-muted hover:text-orange hover:border-orange/50"
              >
                {Object.values(open).some(Boolean) ? t("Roll up ⌃", "Zuklappen ⌃") : t("Unroll ⌄", "Aufklappen ⌄")}
              </button>
                      </div>
          </>
        )}
      </aside>
    </>
  );
}
