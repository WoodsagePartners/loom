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

export const markGuideSeen = () => {
  try {
    localStorage.setItem(SEEN, "1");
  } catch {
    /* ignore */
  }
};

type Card = { term: [string, string]; what: [string, string]; why: [string, string]; art: ReactNode };

function WeightArt() {
  const t = useT();
  const rows: [number, string, string][] = [
    [1.1, "Occasional", "Gelegentlich"],
    [2.6, "Regular", "Regelmäßig"],
    [5, "Main route", "Hauptweg"],
  ];
  return (
    <svg width="150" height="34" aria-hidden>
      {rows.map(([w, en, de], i) => (
        <g key={i}>
          <line x1="4" x2="46" y1={6 + i * 11} y2={6 + i * 11} stroke="#f8991d" strokeWidth={w} strokeLinecap="round" />
          <text x="56" y={9.5 + i * 11} fontSize="9.5" fill="currentColor" opacity="0.8">{t(en, de)}</text>
        </g>
      ))}
    </svg>
  );
}

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
      <div className="w-44 rounded-md border border-white/15 bg-white/[0.04] py-1.5 text-left text-[0.7rem]">
        <div className="flex items-center gap-2 px-2.5 py-0.5">
          <span className="w-2 h-2 rotate-45 flex-none" style={{ background: PALETTE[0] }} />
          <span className="flex-1" style={{ color: PALETTE[0] }}>Fix billing</span>
          <span className="text-[0.55rem] font-mono tracking-wider text-muted/70">PLAN</span>
        </div>
        {[["Quick wins", PALETTE[2], "3 steps"], ["Bigger fixes", PALETTE[5], "5 steps"]].map(([n, c, k]) => (
          <div key={n} className="flex items-center gap-2 pl-6 pr-2.5 py-0.5">
            <span className="w-1.5 h-3.5 rounded-sm flex-none" style={{ background: c }} />
            <span className="flex-1" style={{ color: c }}>{n}</span>
            <span className="text-[0.58rem] font-mono text-muted/60">{k}</span>
          </div>
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
    what: ["Draw a line and its details card opens right away; click a line’s label (or the line) any time to record what moves across it, how it moves, the typical wait, how much friction it causes, and a note.", "Sobald Sie eine Linie zeichnen, öffnet sich ihre Detailkarte; per Klick auf die Beschriftung (oder die Linie) erfassen Sie jederzeit, was übergeben wird, auf welchem Weg, die typische Wartezeit, die Reibung und eine Notiz."],
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
    term: ["Line weight", "Linienstärke"],
    what: ["In the line details card, “How much travels here” makes a line thin (Occasional), medium (Regular) or thick (Main route). Click the same choice again to clear it.", "In der Detailkarte der Linie macht „Wie viel läuft hier durch“ eine Linie dünn (Gelegentlich), mittel (Regelmäßig) oder dick (Hauptweg). Dieselbe Auswahl erneut anklicken hebt sie auf."],
    why: ["Thickness shows where the work really flows — a thick line into a painful hand-off is the first thing to fix.", "Die Dicke zeigt, wo die Arbeit wirklich fließt – eine dicke Linie in eine schmerzhafte Übergabe ist das Erste, was man angeht."],
    art: <WeightArt />,
  },
  {
    term: ["Hover for details", "Mit der Maus Details sehen"],
    what: ["Rest the pointer on any step or line label and a small card shows its details — type, owner, description, and for lines what moves, wait and friction.", "Fahren Sie mit der Maus über einen Schritt oder eine Linien-Beschriftung – eine kleine Karte zeigt Details: Typ, Zuständigkeit, Beschreibung und bei Linien Übergabe, Wartezeit und Reibung."],
    why: ["You can read the whole map at a glance without opening anything — ideal when walking someone through a process.", "So lesen Sie die ganze Karte auf einen Blick, ohne etwas zu öffnen – ideal, um jemandem einen Prozess zu erklären."],
    art: <span className="text-3xl text-orange">☝</span>,
  },
  {
    term: ["Comments", "Kommentare"],
    what: ["Hover a step and click the small speech bubble in its corner to leave a note for your team. Steps with comments keep an orange badge showing how many. You can delete your own comments; owners and admins can delete any.", "Fahren Sie über einen Schritt und klicken Sie auf die kleine Sprechblase an der Ecke, um Ihrem Team eine Notiz zu hinterlassen. Schritte mit Kommentaren behalten ein orangefarbenes Zeichen mit der Anzahl. Eigene Kommentare können Sie löschen, Inhaber und Admins alle."],
    why: ["Questions and context stay on the step they are about, so the next person finds them exactly where the work happens.", "Fragen und Hintergründe bleiben an dem Schritt, um den es geht – die nächste Person findet sie genau dort, wo gearbeitet wird."],
    art: (
      <svg width="64" height="30" aria-hidden>
        <rect x="6" y="6" width="44" height="20" rx="8" fill="none" stroke="#7fa8ff" strokeWidth="1.8" />
        <circle cx="50" cy="6" r="7" fill="#f8991d" />
        <text x="50" y="9.2" fontSize="9" fontWeight="700" textAnchor="middle" fill="#14161c">2</text>
      </svg>
    ),
  },
  {
    term: ["Find a step", "Schritt suchen"],
    what: ["Type in the search box at the top of the canvas. Matching steps light up with an orange ring and the rest fade back. Press Enter to jump to the first match, then Enter again for the next. Esc clears the search.", "Tippen Sie in das Suchfeld oben auf der Fläche. Passende Schritte leuchten mit orangefarbenem Ring auf, die übrigen treten zurück. Mit Eingabe springen Sie zum ersten Treffer, erneut Eingabe zum nächsten. Esc löscht die Suche."],
    why: ["In a big process, finding the step someone mentioned should take a second, not a scroll.", "In einem großen Prozess soll das Finden eines genannten Schritts eine Sekunde dauern, nicht minutenlanges Scrollen."],
    art: (
      <svg width="64" height="30" aria-hidden>
        <rect x="4" y="6" width="56" height="18" rx="9" fill="none" stroke="currentColor" strokeOpacity="0.4" />
        <circle cx="16" cy="15" r="4" fill="none" stroke="#f8991d" strokeWidth="1.6" />
        <path d="M19 18 L23 22" stroke="#f8991d" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    term: ["Copy a process or lane", "Prozess oder Bahn kopieren"],
    what: ["Hover a process in the left menu and click ⧉. Loom makes a “(copy)” with all its lanes, steps and lines and opens it. Plans and phases are not copied. Lanes copy too: hover a lane and click ⧉ — its steps and the lines between them come along (not the Start step).", "Fahren Sie im linken Menü über einen Prozess und klicken Sie auf ⧉. Loom legt eine „(Kopie)“ mit allen Bahnen, Schritten und Linien an und öffnet sie. Pläne und Phasen werden nicht mitkopiert. Auch Bahnen lassen sich kopieren: über die Bahn fahren und auf ⧉ klicken – ihre Schritte und die Linien dazwischen kommen mit (nicht der Beginn-Schritt)."],
    why: ["Try a “what if” or a to-be version without touching the original — and compare the two side by side.", "So probieren Sie ein „Was wäre wenn“ oder einen Soll-Zustand aus, ohne das Original anzutasten – und vergleichen beide."],
    art: <span className="text-3xl text-orange">⧉</span>,
  },
  {
    term: ["About this workspace", "Über diesen Arbeitsbereich"],
    what: ["Owners and admins can open the workspace menu at the top and choose “About this workspace…”. Say what the workspace is for and what you are looking for — any hunch about where it hurts.", "Eigentümer und Admins öffnen oben das Arbeitsbereich-Menü und wählen „Über diesen Arbeitsbereich…“. Beschreiben Sie, wofür er gedacht ist und wonach Sie suchen – auch eine Ahnung, wo es hakt."],
    why: ["It gives everyone, and later the AI helper, the context to suggest where to look first.", "So haben alle – und später die KI – den Kontext, um zu sagen, wo man zuerst hinschauen sollte."],
    art: <span className="text-3xl text-orange">✎</span>,
  },
  {
    term: ["Team", "Team"],
    what: [
      "Open Team in the left menu to see who is in this workspace. Owners and admins use the + (or Manage team) to invite colleagues by email; they join with a link and see everything here.",
      "Unter Team im linken Menü sehen Sie, wer in diesem Arbeitsbereich ist. Eigentümer und Admins laden über + (oder Team verwalten) Kolleginnen und Kollegen per E-Mail ein; sie treten über einen Link bei und sehen hier alles.",
    ],
    why: [
      "A map gets better when the people who do the work can see it, comment on it and correct it.",
      "Eine Karte wird besser, wenn die Menschen, die die Arbeit machen, sie sehen, kommentieren und korrigieren können.",
    ],
    art: <span className="text-3xl text-orange">☺</span>,
  },
  {
    term: ["Share & switch language", "Teilen & Sprache wechseln"],
    what: ["The ⤓ button saves the current process as a PNG picture, ready for a slide or an email. The EN / DE toggle switches the whole app — and your own step and lane names are translated too.", "Die Schaltfläche ⤓ speichert den aktuellen Prozess als PNG-Bild, bereit für Folie oder E-Mail. Mit EN / DE wechseln Sie die ganze Oberfläche – auch Ihre eigenen Schritt- und Bahnnamen werden übersetzt."],
    why: ["A map people can drop into a meeting, in the language the room speaks, gets used.", "Eine Karte, die man in ein Meeting mitnehmen kann, in der Sprache des Raums, wird auch genutzt."],
    art: <span className="text-3xl text-orange">⤓</span>,
  },
  {
    term: ["Shortcuts & undo", "Tastenkürzel & Rückgängig"],
    what: [
      "Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes — or use the ↶ ↷ buttons beside + STEP. The ▦ button shows a grid to line things up. Delete removes the selected step or line. Double-click a lane to add a step. Covered: adding, moving, editing and deleting steps and lines, including their details (the last 60 changes). Not covered: copying a process or lane, lanes, roles and plans — deleting those asks you to confirm instead — and a deleted step comes back without its plan-phase membership.",
      "Strg/Cmd+Z macht rückgängig, Strg/Cmd+Umschalt+Z (oder Strg+Y) wiederholt – oder nutzen Sie die Schaltflächen ↶ ↷ neben + SCHRITT. Die Schaltfläche ▦ blendet ein Raster zum Ausrichten ein. Entf löscht den gewählten Schritt oder die Linie. Doppelklick auf eine Bahn fügt einen Schritt hinzu. Abgedeckt: Hinzufügen, Verschieben, Bearbeiten und Löschen von Schritten und Linien samt Details (die letzten 60 Änderungen). Nicht abgedeckt: Kopieren von Prozessen und Bahnen, Bahnen, Rollen und Pläne – dort fragt Loom vor dem Löschen nach – und ein gelöschter Schritt kehrt ohne seine Phasenzuordnung zurück.",
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

export function Guide({ onClose, start }: { onClose: () => void; start?: string }) {
  const t = useT();
  const [i, setI] = useState(() => Math.max(0, CARDS.findIndex((c) => c.term[0] === start)));
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-[4px] p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="w-full max-w-md glass glass-bright glass-clear rounded-2xl p-6" style={{ background: "var(--tint-solid)" }} role="dialog" aria-label={t("How Loom works", "So funktioniert Loom")}>
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
