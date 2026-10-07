"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EDGE_KINDS, NODE_TYPES, PALETTE } from "@/lib/flow";
import { ShapeIcon } from "@/components/flow/shapes";
import { useT } from "@/lib/i18n";

const SEEN = "loom_guide_seen";
export const guideSeen = () => {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return true; // storage blocked: never nag
  }
};

type Card = { term: [string, string]; what: [string, string]; why: [string, string]; art: ReactNode };

const Brace = ({ c }: { c: string }) => (
  <svg width="22" height="64" viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden>
    <path d="M18 2 C10 2 10 7 10 15 L10 37 C10 45 6 50 2 50 C6 50 10 55 10 63 L10 85 C10 93 10 98 18 98" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>
);

const CARDS: Card[] = [
  {
    term: ["Process", "Prozess"],
    what: ["One process, mapped from first trigger to final result — for example “Order to delivery”.", "Ein Prozess, abgebildet vom ersten Auslöser bis zum Ergebnis – zum Beispiel „Bestellung bis Lieferung“."],
    why: ["Everything else lives inside a process. Map one honestly as it works today before trying to improve it.", "Alles andere lebt innerhalb eines Prozesses. Bilden Sie ihn zuerst ehrlich so ab, wie er heute läuft."],
    art: <span className="text-3xl text-orange">⟶</span>,
  },
  {
    term: ["Lane", "Bahn"],
    what: ["A horizontal band that groups steps by stage, department or area. The curly brace marks where a lane begins.", "Ein horizontales Band, das Schritte nach Phase, Abteilung oder Bereich gruppiert. Die geschweifte Klammer zeigt, wo eine Bahn beginnt."],
    why: ["Lanes show where work crosses a boundary. Hand-offs are where time, errors and misunderstandings hide.", "Bahnen zeigen, wo Arbeit eine Grenze überschreitet. An Übergaben verstecken sich Zeit, Fehler und Missverständnisse."],
    art: <Brace c={PALETTE[0]} />,
  },
  {
    term: ["Step", "Schritt"],
    what: ["One thing that happens. Name it with a verb: “Bill client”. Each step has a type — Start, Action, Decision, Wait, Document / Data, End.", "Eine Sache, die passiert. Benennen Sie sie mit einem Verb: „Kunde abrechnen“. Jeder Schritt hat einen Typ – Start, Aktion, Wahl, Warten, Dokument / Daten, Ende."],
    why: ["Small steps make delays and waste visible. Innovation starts on one chosen step — never on a whole process at once.", "Kleine Schritte machen Verzögerungen und Verschwendung sichtbar. Innovation beginnt an einem gewählten Schritt – nie am ganzen Prozess auf einmal."],
    art: (
      <div className="flex gap-1.5">
        {NODE_TYPES.map((n) => (
          <span key={n.key} className="w-7 h-7 rounded-md border border-white/20 flex items-center justify-center text-sm" title={n.en}>{n.glyph}</span>
        ))}
      </div>
    ),
  },
  {
    term: ["Role", "Rolle"],
    what: ["Who or what does the step: a person, a team, a system, an AI, or an outside party. The shape shows the kind; the color shows which role.", "Wer oder was den Schritt ausführt: Person, Team, System, KI oder externe Partei. Die Form zeigt die Art, die Farbe die Rolle."],
    why: ["Seeing every step a role touches exposes overload, single points of failure — and what could be automated.", "Wer sieht, welche Schritte eine Rolle berührt, erkennt Überlastung, Abhängigkeit von Einzelnen – und Automatisierbares."],
    art: (
      <div className="flex gap-2">
        {(["person", "team", "system", "ai", "external"] as const).map((k, i) => (
          <ShapeIcon key={k} kind={k} color={PALETTE[i]} size={30} />
        ))}
      </div>
    ),
  },
  {
    term: ["Line", "Linie"],
    what: ["Connects steps. Flow (solid) is work moving on. Info (dashed) passes information only. Rework (dotted, red) is an exception or a loop back.", "Verbindet Schritte. Ablauf (durchgezogen): die Arbeit geht weiter. Info (gestrichelt): nur Information. Nacharbeit (gepunktet, rot): Ausnahme oder Rückschleife."],
    why: ["Rework loops and info-only hand-offs are where the most waste hides. Make them visible and they get fixed.", "In Nacharbeitsschleifen und reinen Info-Übergaben steckt die meiste Verschwendung. Sichtbar gemacht, lässt sie sich beheben."],
    art: (
      <svg width="150" height="44" aria-hidden>
        {EDGE_KINDS.map((k, i) => (
          <line key={k.key} x1="4" x2="146" y1={8 + i * 14} y2={8 + i * 14} stroke={k.color} strokeWidth="2" strokeDasharray={k.dash} strokeLinecap={k.dash ? "round" : "butt"} />
        ))}
      </svg>
    ),
  },
  {
    term: ["Plan & Phase", "Plan & Phase"],
    what: ["A plan is one improvement effort. Phases split it into stages — say “Quick wins”, then “Bigger fixes” — by grouping the steps that belong together.", "Ein Plan ist ein Verbesserungsvorhaben. Phasen teilen es in Etappen – etwa „Schnelle Erfolge“, dann „Größere Anpassungen“ – indem Sie zusammengehörige Schritte bündeln."],
    why: ["It turns “everything is broken” into a sequence: which steps to improve first, which later, and who is involved.", "So wird aus „alles ist kaputt“ eine Reihenfolge: welche Schritte zuerst, welche später und wer beteiligt ist."],
    art: (
      <div className="flex items-end gap-1.5">
        {[PALETTE[2], PALETTE[5], PALETTE[1]].map((c, i) => (
          <span key={c} className="w-6 rounded-sm" style={{ background: c, height: 16 + i * 10, opacity: 0.85 }} />
        ))}
      </div>
    ),
  },
  {
    term: ["Focus", "Fokus"],
    what: ["Click a lane, a role, a plan or a phase in the menu and everything else dims, so only what matters stays lit.", "Klicken Sie im Menü auf eine Bahn, Rolle, einen Plan oder eine Phase – alles andere wird abgedunkelt, nur das Wichtige bleibt hell."],
    why: ["It answers “what does Finance touch?” or “what is in Phase 1?” in a single click — ideal for a workshop.", "So beantworten Sie „Was berührt die Finanzabteilung?“ oder „Was steckt in Phase 1?“ mit einem Klick – ideal für Workshops."],
    art: (
      <div className="flex gap-1.5">
        <span className="w-9 h-6 rounded-md border-2" style={{ borderColor: PALETTE[1], boxShadow: `0 0 10px ${PALETTE[1]}88` }} />
        <span className="w-9 h-6 rounded-md border border-white/30 opacity-30" />
        <span className="w-9 h-6 rounded-md border border-white/30 opacity-30" />
      </div>
    ),
  },
  {
    term: ["Line details", "Linien-Details"],
    what: ["Click a line’s label (or the line) to record what moves across it, how it moves, the typical wait, how much friction it causes, and a note.", "Klicken Sie auf die Beschriftung einer Linie (oder die Linie), um zu erfassen, was übergeben wird, auf welchem Weg, die typische Wartezeit, die Reibung und eine Notiz."],
    why: ["Hand-offs are where time and errors hide. A few facts per line show where to start improving — and give the AI what it needs to suggest fixes.", "Übergaben sind der Ort, an dem Zeit und Fehler versickern. Wenige Fakten pro Linie zeigen, wo die Verbesserung beginnt – und geben der KI, was sie für Vorschläge braucht."],
    art: (
      <div className="flex gap-1.5">
        {["#4ade80", "#fbbf24", "#f87171"].map((c) => (
          <span key={c} className="w-4 h-4 rounded-full" style={{ background: c }} />
        ))}
      </div>
    ),
  },
  {
    term: ["Hover for details", "Mit der Maus Details sehen"],
    what: ["Rest the pointer on any step or line label and a small card shows its details — type, owner, description, and for lines what moves, wait and friction.", "Fahren Sie mit der Maus über einen Schritt oder eine Linien-Beschriftung – eine kleine Karte zeigt Details: Typ, Zuständigkeit, Beschreibung und bei Linien Übergabe, Wartezeit und Reibung."],
    why: ["You can read the whole map at a glance without opening anything — ideal when walking someone through a process.", "So lesen Sie die ganze Karte auf einen Blick, ohne etwas zu öffnen – ideal, um jemandem einen Prozess zu erklären."],
    art: <span className="text-3xl text-orange">☝</span>,
  },
  {
    term: ["Shortcuts & undo", "Tastenkürzel & Rückgängig"],
    what: [
      "Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes — or use the ↶ ↷ buttons beside + STEP. Delete removes the selected step or line. Double-click a lane to add a step. Covered: adding, moving, editing and deleting steps and lines, including their details (the last 60 changes). Not covered: lanes, roles and plans — deleting those asks you to confirm instead — and a deleted step comes back without its plan-phase membership.",
      "Strg/Cmd+Z macht rückgängig, Strg/Cmd+Umschalt+Z (oder Strg+Y) wiederholt – oder nutzen Sie die Schaltflächen ↶ ↷ neben + SCHRITT. Entf löscht den gewählten Schritt oder die Linie. Doppelklick auf eine Bahn fügt einen Schritt hinzu. Abgedeckt: Hinzufügen, Verschieben, Bearbeiten und Löschen von Schritten und Linien samt Details (die letzten 60 Änderungen). Nicht abgedeckt: Bahnen, Rollen und Pläne – dort fragt Loom vor dem Löschen nach – und ein gelöschter Schritt kehrt ohne seine Phasenzuordnung zurück.",
    ],
    why: [
      "Mapping is trial and error. Undo makes it safe to experiment, so people try things instead of freezing.",
      "Abbilden heißt ausprobieren. Mit „Rückgängig“ lässt sich gefahrlos experimentieren – man probiert aus, statt zu zögern.",
    ],
    art: (
      <div className="flex gap-1.5 font-mono text-[0.7rem]">
        {["Ctrl", "Z"].map((k) => (
          <span key={k} className="rounded-md border border-white/25 px-2 py-1">{k}</span>
        ))}
      </div>
    ),
  },
];

export function Guide({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const c = CARDS[i];
  const last = i === CARDS.length - 1;

  const close = () => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* ignore */
    }
    onClose();
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((x) => Math.min(CARDS.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-[3px] p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="w-full max-w-md glass glass-bright glass-clear rounded-2xl p-6" role="dialog" aria-label={t("How Loom works", "So funktioniert Loom")}>
        <div className="flex items-center justify-between mb-5">
          <div className="font-mono text-[0.66rem] tracking-[0.16em] text-muted/80">
            {t("HOW LOOM WORKS", "SO FUNKTIONIERT LOOM")} · {i + 1}/{CARDS.length}
          </div>
          <button onClick={close} className="text-muted hover:text-text text-lg leading-none" aria-label={t("Close", "Schließen")}>×</button>
        </div>

        <div className="h-14 flex items-center mb-3">{c.art}</div>
        <h2 className="text-xl font-semibold mb-3">{t(...c.term)}</h2>
        <p className="text-[0.9rem] leading-relaxed mb-3">{t(...c.what)}</p>
        <div className="rounded-xl border border-orange/25 bg-orange/[0.07] px-3.5 py-2.5">
          <div className="font-mono text-[0.6rem] tracking-[0.14em] text-orange mb-1">{t("WHY IT MATTERS", "WARUM ES WICHTIG IST")}</div>
          <p className="text-[0.84rem] leading-relaxed text-text/90">{t(...c.why)}</p>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="text-[0.8rem] text-muted hover:text-text disabled:opacity-30">
            ‹ {t("Back", "Zurück")}
          </button>
          <div className="flex gap-1.5">
            {CARDS.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`${k + 1}`} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: k === i ? "#f8991d" : "rgb(var(--c-white) / .25)", transform: k === i ? "scale(1.4)" : undefined }} />
            ))}
          </div>
          <button
            onClick={() => (last ? close() : setI((x) => x + 1))}
            className="rounded-full px-4 py-1.5 text-[0.76rem] font-mono font-semibold tracking-wider text-[#1a0f05]"
            style={{ background: "linear-gradient(135deg, #f8991d, #e0771a)" }}
          >
            {last ? t("GOT IT", "VERSTANDEN") : t("NEXT", "WEITER")}
          </button>
        </div>
      </div>
    </div>
  );
}
