"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EDGE_KINDS, NODE_TYPES, PALETTE } from "@/lib/flow";
import { ShapeIcon } from "@/components/flow/shapes";
import { useT } from "@/lib/i18n";
import { HandIcon, LockIcon, PencilIcon, PointerIcon } from "@/components/icons";
import { THEME } from "@/lib/colors";

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
          <line x1="4" x2="46" y1={6 + i * 11} y2={6 + i * 11} stroke={THEME.orange} strokeWidth={w} strokeLinecap="round" />
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

function InsightsArt() {
  const tr = useT();
  const rows: [string, string, string, string, boolean][] = [
    ["▲", "#fbbf24", tr("Signal", "Signal"), tr("Loom noticed a 2-day wait", "Loom sah 2 Tage Wartezeit"), true],
    ["?", THEME.orange, tr("Question", "Frage"), tr("Why does work wait here?", "Warum wartet die Arbeit hier?"), false],
    ["◆", "#60a5fa", tr("Finding", "Befund"), tr("Approvals batch up weekly", "Freigaben laufen wöchentlich"), false],
    ["✦", "#5eead4", tr("Idea", "Idee"), tr("Approve daily instead", "Täglich freigeben"), false],
  ];
  return (
    <div className="w-52 flex flex-col gap-1 text-label">
      {rows.map(([g, c, k, txt, dashed]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full flex items-center justify-center flex-none text-micro" style={{ border: `1.5px ${dashed ? "dashed" : "solid"} ${c}`, color: c }}>{g}</span>
          <span className="flex-1 truncate text-text/85">{txt}</span>
        </div>
      ))}
    </div>
  );
}

function PursuitArt() {
  const tr = useT();
  return (
    <div className="w-52 rounded-md border border-white/15 bg-white/[0.04] py-1.5 text-left text-label">
      <div className="px-2.5 pb-1 text-nano font-mono tracking-wider text-muted/70">{tr("PURSUITS", "VORHABEN")}</div>
      <div className="px-2.5 py-0.5">
        <div className="flex items-center gap-2"><span style={{ color: "#5eead4" }}>✦</span><span className="text-text/90">{tr("Approve daily instead", "Täglich freigeben")}</span></div>
        <div className="pl-5 text-nano text-muted/70"><span style={{ color: "#fbbf24" }}>▲</span> {tr("Signal", "Signal")} › <span style={{ color: THEME.orange }}>?</span> {tr("Question", "Frage")} › <span style={{ color: "#5eead4" }}>✦</span> {tr("Idea", "Idee")}</div>
      </div>
    </div>
  );
}

function InquiryArt({ kind }: { kind: "circuit" | "totals" | "gaps" }) {
  const o = THEME.orange;
  const box = (x: number, y: number, on = true, dashed = false) => (
    <rect x={x} y={y} width="26" height="16" rx="4" fill="none" stroke={on ? o : "currentColor"} strokeOpacity={on ? 1 : 0.35} strokeWidth="1.6" strokeDasharray={dashed ? "3 2" : undefined} />
  );
  return (
    <svg width="170" height="52" aria-hidden>
      {kind === "circuit" && (
        <>
          <path d="M30 18H48M74 18H92M118 18H136" stroke={o} strokeWidth="2" />
          {box(4, 10)}{box(48, 10, false)}{box(92, 10, false)}{box(136, 10)}
          <circle cx="17" cy="38" r="3" fill={o} /><circle cx="149" cy="38" r="3" fill={o} /><path d="M20 38H146" stroke={o} strokeWidth="1.4" strokeDasharray="2 3" />
        </>
      )}
      {kind === "totals" && (
        <>
          <rect x="2" y="3" width="118" height="30" rx="5" fill="none" stroke={o} strokeWidth="1.4" strokeDasharray="4 3" />
          {box(8, 10)}{box(42, 10)}{box(76, 10)}
          <text x="128" y="23" fontSize="11" fill={o}>Σ</text>
          <path d="M8 44H120" stroke={o} strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === "gaps" && (
        <>
          {box(4, 18)}{box(48, 18, true, true)}{box(92, 18)}{box(136, 18, true, true)}
          <text x="56" y="14" fontSize="10" fill={o}>?</text><text x="144" y="14" fontSize="10" fill={o}>?</text>
        </>
      )}
    </svg>
  );
}

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
    term: ["Insights", "Erkenntnisse"],
    what: ["Open Intelligence → Insights to look behind your process. Loom flags what looks off (signals). You pin your own questions, findings and ideas to any step or line.", "Öffnen Sie Intelligenz → Erkenntnisse, um hinter den Prozess zu blicken. Loom markiert Auffälliges (Signale). Eigene Fragen, Befunde und Ideen heften Sie an jeden Schritt und jede Linie."],
    why: ["A signal is a hunch, a question is what to learn, a finding is evidence, an idea is what could change. Pointing at the exact step keeps the conversation concrete.", "Ein Signal ist eine Ahnung, eine Frage das Lernziel, ein Befund der Beleg, eine Idee die mögliche Änderung. Der Bezug auf den genauen Schritt hält das Gespräch konkret."],
    art: <InsightsArt />,
  },
  {
    term: ["Pursuits", "Vorhaben"],
    what: ["Press Pursue on any signal, question, finding or idea and it collects in the left panel as a pursuit, with the story of where it came from and the step it sits on.", "Wählen Sie bei einem Signal, einer Frage, einem Befund oder einer Idee „Verfolgen“: Es sammelt sich links als Vorhaben, mit seiner Herkunft und dem Schritt, an dem es hängt."],
    why: ["Pursuits are what you decided is worth chasing. Click one to jump back to its spot on the map. Later, batches of pursuits get worked with innovation techniques.", "Vorhaben sind das, was Sie weiterverfolgen wollen. Ein Klick springt zur Stelle auf der Karte. Später werden Vorhaben gebündelt mit Innovationstechniken bearbeitet."],
    art: <PursuitArt />,
  },
  {
    term: ["Enterprise roles and your own roles", "Enterprise-Rollen und eigene Rollen"],
    what: [
      "If your organization has enterprise roles, every workspace starts with them, listed first under “Enterprise roles”. You can change an enterprise role's color here, but not its name or shape. Under “This workspace” you add roles of your own. Click a group's heading to fold it away.",
      "Hat Ihre Organisation Enterprise-Rollen, beginnt jeder Arbeitsbereich damit; sie stehen zuerst unter „Enterprise-Rollen“. Die Farbe einer Enterprise-Rolle können Sie hier ändern, Name und Form nicht. Unter „Dieser Arbeitsbereich“ ergänzen Sie eigene Rollen. Ein Klick auf die Überschrift klappt die Gruppe zu.",
    ],
    why: [
      "Shared roles keep every team speaking the same language, while each workspace still has room for what is special about its own work.",
      "Gemeinsame Rollen sorgen dafür, dass alle Teams dieselbe Sprache sprechen, und jeder Arbeitsbereich behält Platz für das Besondere seiner Arbeit.",
    ],
    art: <span className="flex gap-2"><ShapeIcon kind="team" color="#5f8bb3" size={28} /><ShapeIcon kind="system" color="#5a8a6b" size={28} /><ShapeIcon kind="person" color="#d08a3c" size={28} /></span>,
  },
  {
    term: ["Hide unused roles", "Ungenutzte Rollen ausblenden"],
    what: [
      "The roles list shows only roles that are used in your processes, plus any you just added. Choose “Show all” to see every role, and “Hide unused roles” to tidy up again. Enterprise roles always stay visible.",
      "Die Rollenliste zeigt nur Rollen, die in Ihren Prozessen vorkommen, plus gerade neu angelegte. „Alle anzeigen“ zeigt jede Rolle, „Ungenutzte Rollen ausblenden“ räumt wieder auf. Enterprise-Rollen bleiben immer sichtbar.",
    ],
    why: [
      "A long list of roles nobody uses hides the few that matter. Hiding is only a view; nothing is deleted.",
      "Eine lange Liste ungenutzter Rollen verdeckt die wenigen wichtigen. Ausblenden ändert nur die Ansicht; nichts wird gelöscht.",
    ],
    art: <span className="font-mono text-label rounded-full border border-white/25 px-3 py-1 text-muted">Show all (12)</span>,
  },
  {
    term: ["Take me there", "Dorthin springen"],
    what: [
      "In the Loom Floor's Pursuits tab, “Take me there” opens the right workspace and process, flies to the step, and opens the pursuit's card. You can also bookmark the address you land on and come back to the same spot.",
      "Im Reiter „Vorhaben“ des Loom Floor öffnet „Dorthin springen“ den richtigen Arbeitsbereich und Prozess, fliegt zum Schritt und öffnet die Karte des Vorhabens. Die Adresse, auf der Sie landen, können Sie als Lesezeichen speichern.",
    ],
    why: [
      "Nobody should have to remember which workspace, process and step a question lives in.",
      "Niemand soll sich merken müssen, in welchem Arbeitsbereich, Prozess und Schritt eine Frage steckt.",
    ],
    art: <span className="text-3xl text-orange">➜</span>,
  },
  {
    term: ["Focus", "Fokus"],
    what: ["Click a lane or a role in the menu and everything else dims, so only what matters stays lit.", "Klicken Sie im Menü auf eine Bahn oder Rolle – alles andere wird abgedunkelt, nur das Wichtige bleibt hell."],
    why: ["It answers “what does Finance touch?” or “what happens in Logistics?” in a single click — ideal for a workshop.", "So beantworten Sie „Was berührt die Finanzabteilung?“ oder „Was passiert in der Logistik?“ mit einem Klick – ideal für Workshops."],
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
        {["#4ade80", "#fbbf24", THEME.danger].map((c) => (
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
        <circle cx="50" cy="6" r="7" fill={THEME.orange} />
        <text x="50" y="9.2" fontSize="9" fontWeight="700" textAnchor="middle" fill="#14161c">2</text>
      </svg>
    ),
  },
  {
    term: ["Circuit Tester", "Schaltkreis-Prüfer"],
    what: ["Open Inquiry → Circuit Tester, then pick two steps. Loom lights the route between them and adds up the steps, lines, hand-offs, lanes, working time and waiting time along it.", "Öffnen Sie Untersuchung → Schaltkreis-Prüfer und wählen Sie zwei Schritte. Loom zeigt den Weg dazwischen und summiert Schritte, Linien, Übergaben, Bahnen, Arbeits- und Wartezeit."],
    why: ["It answers “how long does it really take from here to there, and where does it wait?” with one number you can show a skeptic.", "Es beantwortet „Wie lange dauert es wirklich von hier bis dort, und wo wartet es?“ mit einer Zahl, die auch Skeptiker überzeugt."],
    art: <InquiryArt kind="circuit" />,
  },
  {
    term: ["Selection Totals", "Auswahl-Summen"],
    what: ["Open Inquiry → Selection Totals, then drag a box around steps (or Ctrl-click them). Loom totals the time in whatever you selected: working, waiting and overall.", "Öffnen Sie Untersuchung → Auswahl-Summen und ziehen Sie ein Rechteck um Schritte (oder klicken Sie mit Strg). Loom summiert die Zeit der Auswahl: Arbeits-, Warte- und Gesamtzeit."],
    why: ["Great for a workshop: circle a whole phase of work and see what it costs in time, without a spreadsheet.", "Ideal im Workshop: einen ganzen Arbeitsabschnitt umkreisen und sehen, wie viel Zeit er kostet – ohne Tabelle."],
    art: <InquiryArt kind="totals" />,
  },
  {
    term: ["Time Gaps", "Zeitlücken"],
    what: ["Open Inquiry → Time Gaps. Loom lists every step with no time entered and lights them on the map. Click one in the list to jump to it and add its time.", "Öffnen Sie Untersuchung → Zeitlücken. Loom listet alle Schritte ohne Zeitangabe und hebt sie auf der Karte hervor. Ein Klick in der Liste springt zum Schritt, um die Zeit zu ergänzen."],
    why: ["Totals are only as good as the times behind them. Time Gaps shows where your numbers are quietly missing something.", "Summen sind nur so gut wie die Zeiten dahinter. Zeitlücken zeigt, wo Ihren Zahlen stillschweigend etwas fehlt."],
    art: <InquiryArt kind="gaps" />,
  },
  {
    term: ["Find a step", "Schritt suchen"],
    what: ["Type in the search box at the top of the canvas. Matching steps light up with an orange ring and the rest fade back. Press Enter to jump to the first match, then Enter again for the next. Esc clears the search.", "Tippen Sie in das Suchfeld oben auf der Fläche. Passende Schritte leuchten mit orangefarbenem Ring auf, die übrigen treten zurück. Mit Eingabe springen Sie zum ersten Treffer, erneut Eingabe zum nächsten. Esc löscht die Suche."],
    why: ["In a big process, finding the step someone mentioned should take a second, not a scroll.", "In einem großen Prozess soll das Finden eines genannten Schritts eine Sekunde dauern, nicht minutenlanges Scrollen."],
    art: (
      <svg width="64" height="30" aria-hidden>
        <rect x="4" y="6" width="56" height="18" rx="9" fill="none" stroke="currentColor" strokeOpacity="0.4" />
        <circle cx="16" cy="15" r="4" fill="none" stroke={THEME.orange} strokeWidth="1.6" />
        <path d="M19 18 L23 22" stroke={THEME.orange} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    term: ["Hand & Select", "Hand & Auswahl"],
    what: [
      "Drag empty canvas to move around (the Hand). To pick several steps, switch to Select with the toolbar toggle or press V, then drag a box. Press H to go back to the Hand. In Hand mode you can also hold Shift and drag a box, or Ctrl-click steps one at a time.",
      "Ziehen Sie die freie Fläche, um sich zu bewegen (die Hand). Um mehrere Schritte zu wählen, wechseln Sie mit dem Schalter in der Werkzeugleiste oder mit V auf Auswahl und ziehen ein Rechteck. Mit H geht es zurück zur Hand. Im Hand-Modus geht auch: Umschalt halten und ein Rechteck ziehen, oder Strg-Klick auf einzelne Schritte.",
    ],
    why: [
      "Moving around is what you do most, so it is one drag. Picking several steps is a deliberate act, one click or key away.",
      "Sich zu bewegen tut man am häufigsten – darum genügt ein Ziehen. Mehrere Schritte zu wählen ist eine bewusste Handlung, einen Klick oder eine Taste entfernt.",
    ],
    art: (
      <span className="flex items-center gap-3 text-orange">
        <HandIcon size={26} />
        <PointerIcon size={26} />
      </span>
    ),
  },
  {
    term: ["Copy & paste steps", "Schritte kopieren & einfügen"],
    what: [
      "Select steps, then use the copy and paste buttons in the toolbar, or Ctrl/Cmd+C and Ctrl/Cmd+V. The lines between the copied steps come along. Paste into the same process or switch to another one first. Ctrl/Cmd+D copies and pastes in one go.",
      "Wählen Sie Schritte aus und nutzen Sie die Schaltflächen Kopieren und Einfügen in der Werkzeugleiste oder Strg/Cmd+C und Strg/Cmd+V. Die Linien zwischen den kopierten Schritten werden mitgenommen. Fügen Sie im selben Prozess ein oder wechseln Sie vorher in einen anderen. Strg/Cmd+D kopiert und fügt in einem Zug ein.",
    ],
    why: [
      "Reuse a good sub-process instead of redrawing it, and build variations in minutes.",
      "So verwenden Sie einen guten Teilprozess wieder, statt ihn neu zu zeichnen, und bauen Varianten in Minuten.",
    ],
    art: <span className="text-3xl text-orange">⧉</span>,
  },
  {
    term: ["Lock a process or workspace", "Prozess oder Arbeitsbereich sperren"],
    what: [
      "Owners and admins can click the lock in the toolbar to lock the open process, or choose “Lock workspace” in the workspace menu at the top to lock everything. Locked work is view only: nobody can add, move, edit or delete anything. Hover cards, search, copy and comments keep working. A lock icon marks locked processes in the left menu and locked workspaces on the Workspaces page. Click the lock again to unlock.",
      "Eigentümer und Admins können mit dem Schloss in der Werkzeugleiste den geöffneten Prozess sperren, oder im Arbeitsbereich-Menü oben „Arbeitsbereich sperren“ wählen, um alles zu sperren. Gesperrte Arbeit ist nur ansehbar: niemand kann etwas hinzufügen, verschieben, bearbeiten oder löschen. Hover-Karten, Suche, Kopieren und Kommentare funktionieren weiter. Ein Schloss markiert gesperrte Prozesse im linken Menü und gesperrte Arbeitsbereiche auf der Seite „Arbeitsbereiche“. Zum Entsperren das Schloss erneut anklicken.",
    ],
    why: [
      "Once a process is signed off, you can share it widely without worrying that someone nudges a step by accident. The lock is enforced on the server, not just hidden in the screen.",
      "Ist ein Prozess abgenommen, können Sie ihn breit teilen, ohne dass jemand versehentlich einen Schritt verschiebt. Die Sperre wird auf dem Server durchgesetzt, nicht nur auf dem Bildschirm versteckt.",
    ],
    art: <span className="text-orange"><LockIcon size={30} /></span>,
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
    art: <span className="text-orange"><PencilIcon size={30} /></span>,
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
      "Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes — or use the ↶ ↷ buttons beside the + button. The ▦ button shows a grid to line things up. Delete removes the selected step or line. Double-click a lane to add a step. Covered: adding, moving, editing and deleting steps and lines, including their details (the last 60 changes). Not covered: copying a process or lane, lanes and roles — deleting those asks you to confirm instead. Insights pins save the moment you type and aren't part of undo; delete one from its card.",
      "Strg/Cmd+Z macht rückgängig, Strg/Cmd+Umschalt+Z (oder Strg+Y) wiederholt – oder nutzen Sie die Schaltflächen ↶ ↷ neben der Schaltfläche +. Die Schaltfläche ▦ blendet ein Raster zum Ausrichten ein. Entf löscht den gewählten Schritt oder die Linie. Doppelklick auf eine Bahn fügt einen Schritt hinzu. Abgedeckt: Hinzufügen, Verschieben, Bearbeiten und Löschen von Schritten und Linien samt Details (die letzten 60 Änderungen). Nicht abgedeckt: Kopieren von Prozessen und Bahnen, Bahnen und Rollen – dort fragt Loom vor dem Löschen nach. Pins in Erkenntnisse werden sofort gespeichert und sind nicht Teil von „Rückgängig“; löschen Sie sie auf ihrer Karte.",
    ],
    why: [
      "Mapping is trial and error. Undo makes it safe to experiment, so people try things instead of freezing.",
      "Abbilden heißt ausprobieren. Mit „Rückgängig“ lässt sich gefahrlos experimentieren – man probiert aus, statt zu zögern.",
    ],
    art: (
      <div className="flex gap-1.5 font-mono text-label">
        {["Ctrl", "Z"].map((k) => (
          <span key={k} className="rounded-md border border-white/25 px-2 py-1">{k}</span>
        ))}
      </div>
    ),
  },
];

/** Slides for organization owners and administrators (shown in the Loom Floor's Help tab). */
export const ADMIN_CARDS: Card[] = [
  {
    term: ["The Loom Floor", "Der Loom Floor"],
    what: [
      "The Loom Floor is your organization's control room. Tabs across the top: Workspaces, Pursuits, Users, Roles, Organization, License and Agreements. You see it because you are an owner or administrator.",
      "Der Loom Floor ist die Schaltzentrale Ihrer Organisation. Reiter oben: Arbeitsbereiche, Vorhaben, Benutzer, Rollen, Organisation, Lizenz und Vereinbarungen. Sie sehen ihn als Eigentümer oder Administrator.",
    ],
    why: [
      "One place to see what is happening across every workspace, without opening each one.",
      "Ein Ort, um zu sehen, was in allen Arbeitsbereichen passiert, ohne jeden einzeln zu öffnen.",
    ],
    art: <span className="text-3xl text-orange">▦</span>,
  },
  {
    term: ["Manage workspaces", "Arbeitsbereiche verwalten"],
    what: [
      "Each workspace has a card with its purpose, goal, processes, members, pursuits and last edit. OPEN enters it. LOCK makes it view only. ARCHIVE hides it from daily use but keeps a license seat; RESTORE brings it back. DELETE removes it for good and frees the seat, and asks you to type DELETE first. “New workspace” adds one while you have seats left.",
      "Jeder Arbeitsbereich hat eine Karte mit Zweck, Ziel, Prozessen, Mitgliedern, Vorhaben und letzter Änderung. ÖFFNEN geht hinein. SPERREN macht ihn schreibgeschützt. ARCHIVIEREN nimmt ihn aus dem Alltag, behält aber einen Lizenzplatz; WIEDERHERSTELLEN holt ihn zurück. LÖSCHEN entfernt ihn endgültig, gibt den Platz frei und verlangt vorher die Eingabe von DELETE. „Neuer Arbeitsbereich“ legt einen an, solange Plätze frei sind.",
    ],
    why: [
      "Archive is the safe choice when you are unsure. Delete cannot be undone.",
      "Archivieren ist die sichere Wahl bei Unsicherheit. Löschen lässt sich nicht rückgängig machen.",
    ],
    art: <span className="text-orange"><LockIcon size={30} /></span>,
  },
  {
    term: ["Users: deactivate or remove", "Benutzer: deaktivieren oder entfernen"],
    what: [
      "DEACTIVATE blocks a person's access and frees their user seat, but keeps everything they created; they see a notice with your contact details, in case it was a mistake. REACTIVATE gives access back. REMOVE takes them out of every workspace in the organization after a confirmation. Their authored work stays. Only owners can remove other owners, and owners can add administrators.",
      "DEAKTIVIEREN sperrt den Zugang und gibt den Benutzerplatz frei, behält aber alles Erstellte; die Person sieht einen Hinweis mit Ihren Kontaktdaten, falls es ein Irrtum war. REAKTIVIEREN gibt den Zugang zurück. ENTFERNEN nimmt die Person nach Bestätigung aus allen Arbeitsbereichen der Organisation. Ihre Inhalte bleiben. Nur Eigentümer können andere Eigentümer entfernen, und Eigentümer können Administratoren hinzufügen.",
    ],
    why: [
      "When someone leaves, you close the door without losing the maps they built.",
      "Wenn jemand geht, schließen Sie die Tür, ohne die erstellten Landkarten zu verlieren.",
    ],
    art: <span className="text-3xl text-orange">⚇</span>,
  },
  {
    term: ["Roles for the whole organization", "Rollen für die ganze Organisation"],
    what: [
      "In the Roles tab, “Enterprise roles” apply to every workspace: add one with + ADD ENTERPRISE ROLE, choosing name, title, type and color. New workspaces start with them, and people in a workspace can change only their color. Below, “Roles added by individual workspaces” shows what teams created themselves; you can edit those too. Each section folds away.",
      "Im Reiter „Rollen“ gelten „Enterprise-Rollen“ für jeden Arbeitsbereich: Mit + ENTERPRISE-ROLLE legen Sie eine an (Name, Titel, Typ, Farbe). Neue Arbeitsbereiche starten damit; in einem Arbeitsbereich lässt sich nur die Farbe ändern. Darunter zeigt „Von einzelnen Arbeitsbereichen ergänzte Rollen“, was Teams selbst angelegt haben; auch diese können Sie bearbeiten. Jeder Abschnitt lässt sich zuklappen.",
    ],
    why: [
      "A shared vocabulary of roles makes processes from different teams comparable.",
      "Ein gemeinsames Vokabular an Rollen macht Prozesse verschiedener Teams vergleichbar.",
    ],
    art: <span className="flex gap-2"><ShapeIcon kind="team" color="#5f8bb3" size={28} /><ShapeIcon kind="ai" color="#8a7bb0" size={28} /></span>,
  },
  {
    term: ["License and term", "Lizenz und Laufzeit"],
    what: [
      "The License tab shows how many workspaces and users you are using out of your license, and when the term ends. A license code from Struinova adds a new organization to your account. When the term ends, workspaces pause and only this tab stays open until the license is renewed. Nothing is deleted.",
      "Der Reiter „Lizenz“ zeigt, wie viele Arbeitsbereiche und Benutzer Sie von Ihrer Lizenz nutzen und wann die Laufzeit endet. Ein Lizenzcode von Struinova fügt Ihrem Konto eine Organisation hinzu. Nach Ablauf pausieren die Arbeitsbereiche, und nur dieser Reiter bleibt bis zur Verlängerung offen. Es wird nichts gelöscht.",
    ],
    why: [
      "No surprises: you can see your headroom, and expiry never costs you your data.",
      "Keine Überraschungen: Sie sehen Ihren Spielraum, und ein Ablauf kostet Sie nie Ihre Daten.",
    ],
    art: <span className="text-3xl text-orange">◷</span>,
  },
  {
    term: ["Agreements", "Vereinbarungen"],
    what: [
      "The Agreements tab holds the processor note, privacy notice and terms of use. READ opens each in plain language. ACKNOWLEDGE records who accepted it, when, and which version. The card shows the name of the person who accepted.",
      "Der Reiter „Vereinbarungen“ enthält die Auftragsverarbeitungs-Notiz, den Datenschutzhinweis und die Nutzungsbedingungen. LESEN öffnet jede in einfacher Sprache. BESTÄTIGEN hält fest, wer sie wann und in welcher Version akzeptiert hat. Auf der Karte steht der Name der Person.",
    ],
    why: [
      "You keep a dated record of who agreed to what, which is what auditors and customers ask for.",
      "Sie haben einen datierten Nachweis, wer was akzeptiert hat, wonach Prüfer und Kunden fragen.",
    ],
    art: <span className="text-3xl text-orange">✓</span>,
  },
];

/** A guide shown inline (no pop-up), for the Loom Floor's Help tab. */
export function GuideDeck({ cards, heading }: { cards: Card[]; heading: string }) {
  const t = useT();
  const [i, setI] = useState(0);
  const c = cards[i];
  const last = i === cards.length - 1;
  return (
    <div className="glass rounded-2xl p-5">
      <div className="font-mono text-label tracking-[0.16em] text-muted/80 mb-4">{heading} · {i + 1}/{cards.length}</div>
      <div className="h-12 flex items-center mb-2">{c.art}</div>
      <h3 className="text-lg font-semibold mb-2">{t(...c.term)}</h3>
      <p className="text-body leading-relaxed mb-3">{t(...c.what)}</p>
      <div className="rounded-xl border border-orange/25 bg-orange/[0.07] px-3.5 py-2.5">
        <div className="font-mono text-micro tracking-[0.14em] text-orange mb-1">{t("WHY IT MATTERS", "WARUM ES WICHTIG IST")}</div>
        <p className="text-small leading-relaxed text-text/90">{t(...c.why)}</p>
      </div>
      <div className="flex items-center justify-between mt-5">
        <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="text-small text-muted hover:text-text disabled:opacity-30">‹ {t("Back", "Zurück")}</button>
        <div className="flex gap-1.5 flex-wrap justify-center">
          {cards.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`${k + 1}`} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: k === i ? THEME.orange : "rgb(var(--c-white) / .25)", transform: k === i ? "scale(1.4)" : undefined }} />
          ))}
        </div>
        <button onClick={() => setI((x) => (last ? 0 : x + 1))} className="text-small text-orange hover:underline">{last ? t("Start over", "Von vorn") : t("Next", "Weiter")} ›</button>
      </div>
    </div>
  );
}

export const GENERAL_CARDS = CARDS;

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
          <div className="font-mono text-label tracking-[0.16em] text-muted/80">
            {t("HOW LOOM WORKS", "SO FUNKTIONIERT LOOM")} · {i + 1}/{CARDS.length}
          </div>
          <button onClick={close} className="text-muted hover:text-text text-lg leading-none" aria-label={t("Close", "Schließen")}>×</button>
        </div>

        <div className="h-14 flex items-center mb-3">{c.art}</div>
        <h2 className="text-xl font-semibold mb-3">{t(...c.term)}</h2>
        <p className="text-lead leading-relaxed mb-3">{t(...c.what)}</p>
        <div className="rounded-xl border border-orange/25 bg-orange/[0.07] px-3.5 py-2.5">
          <div className="font-mono text-micro tracking-[0.14em] text-orange mb-1">{t("WHY IT MATTERS", "WARUM ES WICHTIG IST")}</div>
          <p className="text-body leading-relaxed text-text/90">{t(...c.why)}</p>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="text-small text-muted hover:text-text disabled:opacity-30">
            ‹ {t("Back", "Zurück")}
          </button>
          <div className="flex gap-1.5">
            {CARDS.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`${k + 1}`} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: k === i ? THEME.orange : "rgb(var(--c-white) / .25)", transform: k === i ? "scale(1.4)" : undefined }} />
            ))}
          </div>
          <button
            onClick={() => (last ? close() : setI((x) => x + 1))}
            className="rounded-full px-4 py-1.5 text-caption font-mono font-semibold tracking-wider text-onorange"
            style={{ background: "linear-gradient(135deg, #f8991d, #e0771a)" }}
          >
            {last ? t("GOT IT", "VERSTANDEN") : t("NEXT", "WEITER")}
          </button>
        </div>
      </div>
    </div>
  );
}
