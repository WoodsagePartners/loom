"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActorKind, ActorRow, Disposition, StepRow } from "@/lib/types";
import { useT } from "@/lib/i18n";

// ---- layout constants (fixed so arrows can be computed without measuring) --
const LABEL_W = 196;
const COL_W = 216;
const CARD_W = 184;
const CARD_H = 80;
const LANE_H = 116;
const PAD_X = 16;

const ACTOR_COLORS = ["#60a5fa", "#f8991d", "#5eead4", "#c084fc", "#f472b6", "#a3e635", "#fb923c", "#22d3ee"];

const KIND_GLYPH: Record<ActorKind, string> = { person: "●", role: "◆", system: "▣", ai: "✦" };

const DISPOSITIONS: { key: Disposition; color: string; en: string; de: string }[] = [
  { key: "undecided", color: "#64748b", en: "Undecided", de: "Offen" },
  { key: "keep", color: "#5eead4", en: "Keep", de: "Beibehalten" },
  { key: "assist", color: "#60a5fa", en: "Assist", de: "Unterstützen" },
  { key: "automate", color: "#f8991d", en: "Automate", de: "Automatisieren" },
  { key: "eliminate", color: "#f87171", en: "Eliminate", de: "Eliminieren" },
];
const dispColor = (d: Disposition) => DISPOSITIONS.find((x) => x.key === d)?.color ?? "#64748b";

const SUGGESTED_ACTORS: { name: string; de: string; kind: ActorKind }[] = [
  { name: "Sales rep", de: "Vertrieb", kind: "role" },
  { name: "Production planner", de: "Produktionsplanung", kind: "role" },
  { name: "Machine operator", de: "Maschinenbediener", kind: "role" },
  { name: "Quality inspector", de: "Qualitätsprüfung", kind: "role" },
  { name: "Warehouse", de: "Lager", kind: "role" },
  { name: "ERP system", de: "ERP-System", kind: "system" },
  { name: "Customer", de: "Kunde", kind: "role" },
];

const UNASSIGNED = "__none__";

// Text input that commits on blur / Enter, so autosave doesn't fire per key.
function Field({
  value,
  onCommit,
  multiline,
  placeholder,
  type = "text",
}: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const cls =
    "w-full bg-black/30 border border-white/10 rounded-lg text-text text-xs font-normal px-2.5 py-2 outline-none focus:border-orange/50";
  const commit = () => v !== value && onCommit(v);
  return multiline ? (
    <textarea
      rows={3}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      className={cls + " resize-none"}
    />
  ) : (
    <input
      type={type}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cls}
    />
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="font-mono text-[0.74rem] tracking-[0.14em] text-muted/70 uppercase mb-1 mt-3">{children}</div>
);

export function ProcessDesigner({ orgId, threadId }: { orgId: string; threadId: string }) {
  const t = useT();
  const supabase = useMemo(() => createClient(), []);

  const [actors, setActors] = useState<ActorRow[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"as-is" | "to-be">("as-is");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newStep, setNewStep] = useState("");
  const [newActor, setNewActor] = useState("");
  const [newKind, setNewKind] = useState<ActorKind>("role");

  const load = useCallback(async () => {
    const [a, s] = await Promise.all([
      supabase.from("actors").select("*").eq("org_id", orgId).order("created_at", { ascending: true }),
      supabase.from("process_steps").select("*").eq("thread_id", threadId).order("seq", { ascending: true }),
    ]);
    if (a.error || s.error) setError((a.error ?? s.error)!.message);
    else {
      setActors((a.data ?? []) as unknown as ActorRow[]);
      setSteps((s.data ?? []) as unknown as StepRow[]);
      setError(null);
    }
    setLoaded(true);
  }, [supabase, orgId, threadId]);

  useEffect(() => {
    load();
    // Teammates work asynchronously over days — refresh when the tab regains focus.
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const actorById = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);
  const selected = steps.find((s) => s.id === selectedId) ?? null;

  // ---- writes -------------------------------------------------------------
  async function addActor(name: string, kind: ActorKind) {
    const clean = name.trim();
    if (!clean) return;
    const color = ACTOR_COLORS[actors.length % ACTOR_COLORS.length];
    const { data, error: err } = await supabase
      .from("actors")
      .insert({ org_id: orgId, kind, name: clean, color })
      .select("*")
      .single();
    if (err) return setError(err.message);
    setActors((p) => [...p, data as unknown as ActorRow]);
    setNewActor("");
  }

  async function removeActor(id: string) {
    if (!window.confirm(t("Remove this actor? Their steps become unassigned.", "Diesen Akteur entfernen? Seine Schritte werden nicht zugeordnet."))) return;
    const { error: err } = await supabase.from("actors").delete().eq("id", id);
    if (err) return setError(err.message);
    load();
  }


  // Example process so a first-time user can see what "good" looks like and
  // edit it, instead of facing a blank page. Everything is deletable.
  async function loadExample() {
    setError(null);
    const defs: { key: string; name: string; kind: ActorKind }[] = [
      { key: "cust", name: t("Customer", "Kunde"), kind: "role" },
      { key: "sales", name: t("Sales rep", "Vertrieb"), kind: "role" },
      { key: "erp", name: t("ERP system", "ERP-System"), kind: "system" },
      { key: "plan", name: t("Production planner", "Produktionsplanung"), kind: "role" },
      { key: "op", name: t("Machine operator", "Maschinenbediener"), kind: "role" },
      { key: "qa", name: t("Quality inspector", "Qualitätsprüfung"), kind: "role" },
      { key: "ai", name: t("AI assistant", "KI-Assistent"), kind: "ai" },
    ];
    const { data: made, error: aErr } = await supabase
      .from("actors")
      .insert(defs.map((d, i) => ({ org_id: orgId, kind: d.kind, name: d.name, color: ACTOR_COLORS[(actors.length + i) % ACTOR_COLORS.length] })))
      .select("id, name");
    if (aErr || !made) return setError(aErr?.message ?? "Could not add the example.");
    const id = (key: string) => made.find((m) => m.name === defs.find((d) => d.key === key)!.name)!.id as string;

    const rows = [
      { title: t("Send order by email or phone", "Auftrag per E-Mail oder Telefon senden"), actor_id: id("cust"), minutes_per_run: 10, runs_per_month: 120 },
      { title: t("Re-type order into ERP", "Auftrag manuell ins ERP übertragen"), actor_id: id("sales"), proposed_actor_id: id("ai"), disposition: "automate", pain: t("Typos and missing specs cause rework", "Tippfehler und fehlende Spezifikationen führen zu Nacharbeit"), minutes_per_run: 20, runs_per_month: 120 },
      { title: t("Check material and machine availability", "Material- und Maschinenverfügbarkeit prüfen"), actor_id: id("plan"), proposed_actor_id: id("erp"), disposition: "assist", pain: t("Spreadsheet is out of date by midday", "Tabelle ist mittags schon veraltet"), minutes_per_run: 45, runs_per_month: 120 },
      { title: t("Schedule the production run", "Produktionslauf einplanen"), actor_id: id("plan"), disposition: "keep", minutes_per_run: 30, runs_per_month: 120 },
      { title: t("Set up the machine and run the job", "Maschine rüsten und Auftrag fahren"), actor_id: id("op"), disposition: "keep", minutes_per_run: 240, runs_per_month: 120 },
      { title: t("Print and sign the paper inspection sheet", "Prüfblatt ausdrucken und unterschreiben"), actor_id: id("qa"), proposed_actor_id: id("erp"), disposition: "eliminate", pain: t("Paper gets lost; nobody can search it", "Papier geht verloren; nichts ist durchsuchbar"), minutes_per_run: 15, runs_per_month: 120 },
      { title: t("Release the batch for shipping", "Charge zum Versand freigeben"), actor_id: id("qa"), disposition: "keep", minutes_per_run: 10, runs_per_month: 120 },
    ].map((r, i) => ({ ...r, seq: i + 1 })) as Partial<StepRow>[];

    const { error: sErr } = await supabase.from("process_steps").insert(rows.map((r) => ({ ...r, thread_id: threadId })));
    if (sErr) setError(sErr.message);
    load();
  }

  async function addStep() {
    const title = newStep.trim();
    if (!title) return;
    const seq = steps.reduce((m, s) => Math.max(m, s.seq), 0) + 1;
    const last = steps[steps.length - 1];
    const { data, error: err } = await supabase
      .from("process_steps")
      .insert({ thread_id: threadId, title, seq, actor_id: last?.actor_id ?? null })
      .select("*")
      .single();
    if (err) return setError(err.message);
    const row = data as unknown as StepRow;
    setSteps((p) => [...p, row]);
    setSelectedId(row.id);
    setNewStep("");
  }

  async function patch(id: string, changes: Partial<StepRow>) {
    setSteps((p) => p.map((s) => (s.id === id ? { ...s, ...changes } : s))); // optimistic
    const { error: err } = await supabase.from("process_steps").update(changes).eq("id", id);
    if (err) {
      setError(err.message);
      load();
    }
  }

  async function removeStep(id: string) {
    if (!window.confirm(t("Delete this step?", "Diesen Schritt löschen?"))) return;
    const { error: err } = await supabase.from("process_steps").delete().eq("id", id);
    if (err) return setError(err.message);
    setSelectedId(null);
    load();
  }

  async function move(id: string, dir: -1 | 1) {
    const i = steps.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= steps.length) return;
    const order = [...steps];
    [order[i], order[j]] = [order[j], order[i]];
    const renum = order.map((s, k) => ({ ...s, seq: k + 1 }));
    setSteps(renum);
    const changed = renum.filter((s, k) => s.seq !== steps.find((x) => x.id === s.id)?.seq);
    const results = await Promise.all(
      changed.map((s) => supabase.from("process_steps").update({ seq: s.seq }).eq("id", s.id))
    );
    const bad = results.find((r) => r.error);
    if (bad?.error) {
      setError(bad.error.message);
      load();
    }
  }

  // ---- derived layout -----------------------------------------------------
  const laneKey = (s: StepRow) =>
    (mode === "to-be" ? (s.proposed_actor_id ?? s.actor_id) : s.actor_id) ?? UNASSIGNED;

  const lanes = useMemo(() => {
    const list: { id: string; name: string; kind: ActorKind | null; color: string }[] = actors.map((a, i) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      color: a.color ?? ACTOR_COLORS[i % ACTOR_COLORS.length],
    }));
    if (steps.some((s) => laneKey(s) === UNASSIGNED))
      list.push({ id: UNASSIGNED, name: t("Unassigned", "Nicht zugeordnet"), kind: null, color: "#64748b" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actors, steps, mode]);

  const laneIndex = new Map(lanes.map((l, i) => [l.id, i]));
  const pos = (s: StepRow, idx: number) => ({
    x: LABEL_W + PAD_X + idx * COL_W,
    y: (laneIndex.get(laneKey(s)) ?? 0) * LANE_H + (LANE_H - CARD_H) / 2,
  });

  const flow = steps.filter((s) => !(mode === "to-be" && s.disposition === "eliminate"));
  const stepIdx = new Map(steps.map((s, i) => [s.id, i]));
  const canvasW = LABEL_W + PAD_X * 2 + Math.max(steps.length, 4) * COL_W;
  const canvasH = Math.max(lanes.length, 1) * LANE_H;

  const hours = (s: StepRow) => ((s.minutes_per_run ?? 0) * (s.runs_per_month ?? 0)) / 60;
  const tally = useMemo(() => {
    const sum = (f: (s: StepRow) => boolean) => steps.filter(f).reduce((a, s) => a + hours(s), 0);
    return {
      total: sum(() => true),
      squeeze: sum((s) => s.disposition === "automate" || s.disposition === "eliminate"),
      assisted: sum((s) => s.disposition === "assist"),
    };
  }, [steps]);
  const fmt = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1));

  // ---- guided first run ---------------------------------------------------
  const progress = [
    { done: actors.length >= 2, en: "Add who is involved (people, roles, systems)", de: "Beteiligte hinzufügen (Personen, Rollen, Systeme)" },
    { done: steps.length >= 3, en: "Add the steps in the order they happen", de: "Schritte in der richtigen Reihenfolge hinzufügen" },
    { done: steps.some((s) => s.actor_id), en: "Click a step and say who does it today", de: "Schritt anklicken und angeben, wer ihn heute ausführt" },
    { done: steps.some((s) => s.minutes_per_run && s.runs_per_month), en: "Add how long it takes and how often", de: "Dauer und Häufigkeit angeben" },
    { done: steps.some((s) => s.disposition !== "undecided"), en: "Mark what could be kept, assisted, automated or eliminated", de: "Markieren, was beibehalten, unterstützt, automatisiert oder eliminiert werden könnte" },
  ];
  const doneCount = progress.filter((p) => p.done).length;

  const selectCls =
    "w-full bg-black/30 border border-white/10 rounded-lg text-text text-xs font-normal px-2.5 py-2 outline-none focus:border-orange/50";

  const actorOptions = (
    <>
      <option value="">{t("— unassigned —", "— nicht zugeordnet —")}</option>
      {actors.map((a) => (
        <option key={a.id} value={a.id} className="bg-[#0b1020]">
          {KIND_GLYPH[a.kind]} {a.name}
        </option>
      ))}
    </>
  );

  if (!loaded) return <div className="p-8 text-muted text-sm font-normal">{t("Loading…", "Lädt…")}</div>;

  return (
    <div className="h-full flex min-h-0">
      {/* ------------------------------------------------------ canvas ---- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-none flex flex-wrap items-center gap-3 px-5 py-3 border-b border-white/10">
          <div className="flex font-mono text-[0.74rem] tracking-wider">
            {(["as-is", "to-be"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 border first:rounded-l-full last:rounded-r-full transition-colors ${
                  mode === m ? "border-orange/50 text-orange bg-orange/10" : "border-white/10 text-muted"
                }`}
              >
                {m === "as-is" ? t("AS IT IS TODAY", "IST-ZUSTAND") : t("PROPOSED", "VORSCHLAG")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-[0.74rem] tracking-wider text-muted ml-auto">
            <span>
              <b className="text-text font-normal">{fmt(tally.total)}</b> {t("h/mo mapped", "Std./Monat erfasst")}
            </span>
            <span style={{ color: "#f8991d" }}>
              <b className="font-normal">{fmt(tally.squeeze)}</b> {t("h/mo could be automated or eliminated", "Std./Monat automatisierbar oder verzichtbar")}
            </span>
            <span style={{ color: "#60a5fa" }}>
              <b className="font-normal">{fmt(tally.assisted)}</b> {t("h/mo assisted", "Std./Monat unterstützt")}
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 text-[0.88rem] font-mono text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1.5 flex justify-between">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto p-5">
          {steps.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-muted text-sm font-normal max-w-md mx-auto">
              <div>
                <div className="text-text text-base mb-2">
                  {t("Your process map starts here.", "Hier beginnt Ihre Prozesslandkarte.")}
                </div>
                {t(
                  "Follow the checklist on the right: first add who is involved, then add the steps. Each person, role or system gets its own lane.",
                  "Folgen Sie der Checkliste rechts: Zuerst die Beteiligten, dann die Schritte. Jede Person, Rolle oder jedes System erhält eine eigene Bahn."
                )}
              </div>
            </div>
          ) : (
            <div className="relative rounded-xl border border-white/10" style={{ width: canvasW, height: canvasH }}>
              {lanes.map((l, i) => (
                <div
                  key={l.id}
                  className="absolute left-0 right-0 border-b border-white/5 last:border-b-0"
                  style={{ top: i * LANE_H, height: LANE_H, background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}
                >
                  <div className="absolute left-0 top-0 bottom-0 flex items-center gap-2 px-3 border-r border-white/10" style={{ width: LABEL_W }}>
                    <span style={{ color: l.color }} className="text-xs">
                      {l.kind ? KIND_GLYPH[l.kind] : "○"}
                    </span>
                    <span className="text-xs font-normal truncate">{l.name}</span>
                  </div>
                </div>
              ))}

              <svg className="absolute inset-0 pointer-events-none" width={canvasW} height={canvasH}>
                <defs>
                  <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0 0 L8 4 L0 8 z" fill="rgba(248,153,29,0.7)" />
                  </marker>
                </defs>
                {flow.slice(0, -1).map((a, k) => {
                  const b = flow[k + 1];
                  const pa = pos(a, stepIdx.get(a.id)!);
                  const pb = pos(b, stepIdx.get(b.id)!);
                  const x1 = pa.x + CARD_W;
                  const y1 = pa.y + CARD_H / 2;
                  const x2 = pb.x;
                  const y2 = pb.y + CARD_H / 2;
                  const dx = Math.max(24, (x2 - x1) / 2);
                  return (
                    <path
                      key={a.id + b.id}
                      d={`M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="rgba(248,153,29,0.5)"
                      strokeWidth="1.5"
                      markerEnd="url(#arr)"
                    />
                  );
                })}
              </svg>

              {steps.map((s, idx) => {
                const p = pos(s, idx);
                const c = dispColor(s.disposition);
                const ghost = mode === "to-be" && s.disposition === "eliminate";
                const moved = mode === "to-be" && s.proposed_actor_id && s.proposed_actor_id !== s.actor_id;
                const isSel = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className="absolute text-left rounded-lg px-2.5 py-2 transition-shadow"
                    style={{
                      left: p.x,
                      top: p.y,
                      width: CARD_W,
                      height: CARD_H,
                      background: "rgba(11,16,32,0.92)",
                      border: `1.5px ${ghost ? "dashed" : "solid"} ${moved ? "#facc15" : c}`,
                      opacity: ghost ? 0.45 : 1,
                      boxShadow: isSel ? `0 0 0 2px rgba(248,153,29,0.8)` : moved ? "0 0 14px rgba(250,204,21,0.25)" : "none",
                    }}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="font-mono text-[0.74rem] text-muted/60 mt-0.5">{idx + 1}</span>
                      <span className={`text-[0.88rem] leading-tight font-normal line-clamp-2 ${ghost ? "line-through" : ""}`}>
                        {s.title}
                      </span>
                    </div>
                    <div className="absolute left-2.5 right-2.5 bottom-1.5 flex items-center justify-between font-mono text-[0.72rem] tracking-wide">
                      <span style={{ color: c }}>
                        {DISPOSITIONS.find((d) => d.key === s.disposition)?.[t("en", "de") as "en" | "de"].toUpperCase()}
                      </span>
                      <span className="text-muted/70">
                        {moved && actorById.get(s.actor_id ?? "")
                          ? `← ${actorById.get(s.actor_id!)!.name.slice(0, 12)}`
                          : s.minutes_per_run
                            ? `${s.minutes_per_run} min`
                            : ""}
                      </span>
                    </div>
                    {s.pain && <span className="absolute -top-1.5 -right-1.5 text-[0.88rem]" title={s.pain}>⚑</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------- right panel ---- */}
      <aside className="flex-none w-80 border-l border-white/10 glass-readable overflow-y-auto p-4">
        {selected ? (
          <div>
            <button onClick={() => setSelectedId(null)} className="font-mono text-[0.74rem] tracking-[0.12em] text-muted hover:text-text mb-2">
              ← {t("BACK", "ZURÜCK")}
            </button>

            <Label>{t("Step", "Schritt")}</Label>
            <Field value={selected.title} onCommit={(v) => v.trim() && patch(selected.id, { title: v.trim() })} />

            <Label>{t("What happens here", "Was passiert hier")}</Label>
            <Field multiline value={selected.detail ?? ""} onCommit={(v) => patch(selected.id, { detail: v || null })} />

            <Label>{t("Who does it today", "Wer führt es heute aus")}</Label>
            <select
              className={selectCls}
              value={selected.actor_id ?? ""}
              onChange={(e) => patch(selected.id, { actor_id: e.target.value || null })}
            >
              {actorOptions}
            </select>

            <Label>{t("Could be done by (proposed)", "Könnte ausgeführt werden von (Vorschlag)")}</Label>
            <select
              className={selectCls}
              value={selected.proposed_actor_id ?? ""}
              onChange={(e) => patch(selected.id, { proposed_actor_id: e.target.value || null })}
            >
              {actorOptions}
            </select>

            <Label>{t("What should happen to it", "Was soll damit geschehen")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {DISPOSITIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => patch(selected.id, { disposition: d.key })}
                  className="font-mono text-[0.74rem] tracking-wider px-2.5 py-1.5 rounded-full border transition-colors"
                  style={{
                    borderColor: selected.disposition === d.key ? d.color : "rgba(255,255,255,0.1)",
                    color: selected.disposition === d.key ? d.color : "#94a3b8",
                    background: selected.disposition === d.key ? `${d.color}1f` : "transparent",
                  }}
                >
                  {t(d.en, d.de).toUpperCase()}
                </button>
              ))}
            </div>

            <Label>{t("What hurts here (delays, rework, errors)", "Was ist hier schmerzhaft (Verzögerung, Nacharbeit, Fehler)")}</Label>
            <Field multiline value={selected.pain ?? ""} onCommit={(v) => patch(selected.id, { pain: v || null })} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("Minutes per run", "Minuten pro Durchlauf")}</Label>
                <Field
                  type="number"
                  value={selected.minutes_per_run?.toString() ?? ""}
                  onCommit={(v) => patch(selected.id, { minutes_per_run: v === "" ? null : Math.max(0, Number(v)) })}
                />
              </div>
              <div>
                <Label>{t("Runs per month", "Durchläufe pro Monat")}</Label>
                <Field
                  type="number"
                  value={selected.runs_per_month?.toString() ?? ""}
                  onCommit={(v) => patch(selected.id, { runs_per_month: v === "" ? null : Math.max(0, Number(v)) })}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => move(selected.id, -1)} className="flex-1 rounded-full border border-white/10 py-1.5 font-mono text-[0.74rem] tracking-wider text-muted hover:text-text">
                ← {t("EARLIER", "FRÜHER")}
              </button>
              <button onClick={() => move(selected.id, 1)} className="flex-1 rounded-full border border-white/10 py-1.5 font-mono text-[0.74rem] tracking-wider text-muted hover:text-text">
                {t("LATER", "SPÄTER")} →
              </button>
            </div>
            <button onClick={() => removeStep(selected.id)} className="mt-3 w-full text-center text-[0.8rem] text-muted hover:text-red-300">
              {t("Delete step", "Schritt löschen")}
            </button>
          </div>
        ) : (
          <div>
            {/* guided checklist */}
            <div className="rounded-xl border border-orange/30 bg-orange/5 p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[0.74rem] tracking-[0.14em] text-orange">{t("GETTING STARTED", "ERSTE SCHRITTE")}</span>
                <span className="font-mono text-[0.74rem] text-muted">{doneCount}/{progress.length}</span>
              </div>
              <ul className="space-y-1.5">
                {progress.map((p) => (
                  <li key={p.en} className={`flex gap-2 text-[0.88rem] font-normal ${p.done ? "text-muted/60 line-through" : "text-text"}`}>
                    <span style={{ color: p.done ? "#5eead4" : "#f8991d" }}>{p.done ? "✓" : "○"}</span>
                    {t(p.en, p.de)}
                  </li>
                ))}
              </ul>
              <p className="text-[0.8rem] text-muted/70 font-normal mt-2">
                {t("Take your time — everything saves as you go, and your teammates can add to it.", "Nehmen Sie sich Zeit — alles wird automatisch gespeichert, und Ihr Team kann ergänzen.")}
              </p>
            </div>

            {steps.length === 0 && actors.length === 0 && (
              <button
                onClick={loadExample}
                className="w-full mb-4 rounded-xl border border-dashed border-white/20 py-2.5 text-[0.88rem] font-normal text-muted hover:text-text hover:border-orange/40"
              >
                {t("Not sure where to begin? Load an example (order to delivery) and edit it", "Unsicher, wo Sie anfangen sollen? Beispiel laden (Auftrag bis Auslieferung) und anpassen")}
              </button>
            )}

            <Label>{t("Who is involved", "Wer ist beteiligt")}</Label>
            <ul className="space-y-1 mb-2">
              {actors.map((a, i) => (
                <li key={a.id} className="flex items-center gap-2 text-xs font-normal group">
                  <span style={{ color: a.color ?? ACTOR_COLORS[i % ACTOR_COLORS.length] }}>{KIND_GLYPH[a.kind]}</span>
                  <span className="flex-1 truncate">{a.name}</span>
                  <button onClick={() => removeActor(a.id)} className="text-muted/50 hover:text-red-300 text-[0.8rem] opacity-0 group-hover:opacity-100">✕</button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addActor(newActor, newKind);
              }}
              className="flex gap-1.5"
            >
              <input
                value={newActor}
                onChange={(e) => setNewActor(e.target.value)}
                placeholder={t("Name", "Name")}
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg text-xs font-normal px-2.5 py-2 outline-none focus:border-orange/50"
              />
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as ActorKind)}
                className="bg-black/30 border border-white/10 rounded-lg text-xs px-1.5"
              >
                <option value="person" className="bg-[#0b1020]">{t("Person", "Person")}</option>
                <option value="role" className="bg-[#0b1020]">{t("Role", "Rolle")}</option>
                <option value="system" className="bg-[#0b1020]">{t("System", "System")}</option>
                <option value="ai" className="bg-[#0b1020]">{t("AI", "KI")}</option>
              </select>
              <button className="rounded-lg bg-orange text-black text-xs font-semibold px-3">+</button>
            </form>
            {actors.length < 2 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {SUGGESTED_ACTORS.filter((s) => !actors.some((a) => a.name === s.name)).map((s) => (
                  <button
                    key={s.name}
                    onClick={() => addActor(t(s.name, s.de), s.kind)}
                    className="text-[0.8rem] font-normal px-2 py-1 rounded-full border border-white/10 text-muted hover:text-text hover:border-orange/40"
                  >
                    + {t(s.name, s.de)}
                  </button>
                ))}
              </div>
            )}

            <Label>{t("Add a step", "Schritt hinzufügen")}</Label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addStep();
              }}
              className="flex gap-1.5"
            >
              <input
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                placeholder={t("e.g. Receive customer order", "z. B. Kundenauftrag erfassen")}
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg text-xs font-normal px-2.5 py-2 outline-none focus:border-orange/50"
              />
              <button className="rounded-lg bg-orange text-black text-xs font-semibold px-3">+</button>
            </form>
            <p className="text-[0.8rem] text-muted/60 font-normal mt-1.5">
              {t("New steps go at the end, in the same lane as the step before.", "Neue Schritte kommen ans Ende, in dieselbe Bahn wie der vorherige Schritt.")}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
