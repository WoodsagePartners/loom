"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

// A quiet, occasional nudge at the top centre of the canvas: the story of what Loom is for,
// one line at a time, fading in and out — never permanent.
// [English, German] — add freely; the first one opens the rotation, the rest are shuffled per visit.
const LINES: [string, string][] = [
  ["Loom: discover the Why and What behind a problem before starting the How.", "Loom: Erst das Warum und Was eines Problems entdecken – dann das Wie."],
  ["Don't fix it yet. Map it first.", "Noch nicht reparieren. Erst kartieren."],
  ["Every knot has a story. Loom helps you find the thread.", "Jeder Knoten hat eine Geschichte. Loom findet den Faden."],
  ["Most processes aren't broken — they're just full of surprises.", "Die meisten Prozesse sind nicht kaputt – nur voller Überraschungen."],
  ["Spot the hand-off where Tuesday goes to die.", "Finden Sie die Übergabe, an der der Dienstag stirbt."],
  ["Solving the wrong problem beautifully is still the wrong problem.", "Das falsche Problem elegant zu lösen, bleibt das falsche Problem."],
  ["A problem worth pursuing beats ten solutions in search of one.", "Ein lohnendes Problem schlägt zehn Lösungen auf der Suche nach einem."],
  ["Draw the process. Find the friction. Call the conveyor.", "Prozess zeichnen. Reibung finden. Fließband rufen."],
  ["Then the innovation conveyor delivers fresh ideas for the How.", "Dann liefert das Innovationsfließband frische Ideen für das Wie."],
  ["Stuck on the How? Struinova workshops get things moving.", "Beim Wie festgefahren? Struinova-Workshops bringen Bewegung."],
  ["Waiting is a step too. Loom lets you count it.", "Warten ist auch ein Schritt. Loom zählt mit."],
  ["Sticky notes were a great start. Loom is the sequel.", "Haftnotizen waren ein guter Anfang. Loom ist die Fortsetzung."],
  ["Begin with the Why. The How will thank you later.", "Beginnen Sie mit dem Warum. Das Wie dankt es Ihnen später."],
];

const SHOW_MS = 7000;
const GAP_MS = 5 * 60 * 1000; // at most once every ~5 minutes
const FIRST_MS = 20000;

export function CtaBanner() {
  const t = useT();
  const [i, setI] = useState(0);
  const [order, setOrder] = useState<number[]>(() => LINES.map((_, k) => k));
  useEffect(() => {
    // first line stays first; shuffle the rest once on the client (avoids a server/client mismatch)
    const rest = LINES.map((_, k) => k).slice(1);
    for (let k = rest.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [rest[k], rest[j]] = [rest[j], rest[k]];
    }
    setOrder([0, ...rest]);
  }, []);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("loom_cta_hidden") === "1") setHidden(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (hidden) return;
    let on = false;
    let shown = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      on = !on;
      // swap the text only while the pill is invisible (as it fades IN), never during the fade-out
      if (on && shown++ > 0) setI((x) => x + 1);
      setVisible(on);
      timer = setTimeout(step, on ? SHOW_MS : GAP_MS);
    };
    timer = setTimeout(step, FIRST_MS);
    return () => clearTimeout(timer);
  }, [hidden]);

  if (hidden) return null;

  const L = LINES[order[i % order.length]];
  const line = t(L[0], L[1]);

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] hidden md:flex items-center gap-3 max-w-[56vw] rounded-full px-4 py-1.5 text-[0.76rem] font-light text-text/85 shadow-lg backdrop-blur-md transition-opacity duration-[1800ms] ease-in-out"
      style={{ background: "color-mix(in srgb, var(--tint-solid) 88%, transparent)", border: "1px solid rgb(var(--c-white) / .12)", opacity: visible ? 1 : 0, pointerEvents: "none" }}
      aria-hidden={!visible}
    >
      <span className="truncate">{line}</span>
      <a
        href="mailto:ron@struinova.com?subject=Loom%20%E2%80%93%20let%27s%20talk"
        className="text-[0.64rem] text-muted/70 hover:text-orange hover:underline whitespace-nowrap"
        style={{ pointerEvents: visible ? "auto" : "none" }}
      >
        {t("Talk to us", "Sprechen wir")}
      </a>
      <button
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem("loom_cta_hidden", "1");
          } catch {}
        }}
        aria-label={t("Dismiss", "Schließen")}
        className="opacity-40 hover:opacity-100"
        style={{ pointerEvents: visible ? "auto" : "none" }}
      >
        ✕
      </button>
    </div>
  );
}
