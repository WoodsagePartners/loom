"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

const SHOW_MS = 12000;
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
  const [contact, setContact] = useState(false);

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

  if (hidden && !contact) return null;

  const L = LINES[order[i % order.length]];
  const line = t(L[0], L[1]);

  return (
    <>
    {contact && typeof document !== "undefined" && createPortal(<ContactDialog onClose={() => setContact(false)} />, document.body)}
    {!hidden && (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] hidden md:flex items-center gap-3 max-w-[56vw] rounded-full px-4 py-1.5 text-caption font-light text-text/85 shadow-lg backdrop-blur-md transition-opacity duration-[1800ms] ease-in-out"
      style={{ background: "color-mix(in srgb, var(--tint-solid) 88%, transparent)", border: "1px solid rgb(var(--c-white) / .12)", opacity: visible ? 1 : 0, pointerEvents: "none" }}
      aria-hidden={!visible}
    >
      <span className="truncate">{line}</span>
      <button
        type="button"
        onClick={() => setContact(true)}
        className="text-micro text-muted/70 hover:text-orange hover:underline whitespace-nowrap"
        style={{ pointerEvents: visible ? "auto" : "none" }}
      >
        {t("Talk to us", "Sprechen wir")}
      </button>
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
    )}
    </>
  );
}

function ContactDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  async function send() {
    setState("busy");
    setErr("");
    const r = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message: msg, website: trap, lang: t("en", "de") }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error ?? t("Could not send. You can also write to ron@struinova.com.", "Senden fehlgeschlagen. Sie können auch an ron@struinova.com schreiben."));
      setState("idle");
      return;
    }
    setState("done");
  }
  const input = "mt-1 w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2.5 outline-none focus:border-orange/60";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md glass glass-bright glass-dense glass-pop rounded-2xl p-6 text-sm">
        <div className="font-mono text-label tracking-[0.14em] uppercase text-orange mb-2">{t("Talk to us", "Sprechen wir")}</div>
        {state === "done" ? (
          <>
            <h2 className="text-base font-medium mb-2">{t("Thank you — message received.", "Danke – Nachricht erhalten.")}</h2>
            <p className="text-body text-muted">{t("We'll get back to you soon.", "Wir melden uns bald bei Ihnen.")}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={onClose} className="rounded-full border border-white/20 px-4 py-1.5 text-caption font-mono tracking-wider hover:border-white/40">{t("CLOSE", "SCHLIESSEN")}</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-medium mb-1">{t("Stuck on the How? Tell us what you're working on.", "Beim Wie festgefahren? Erzählen Sie uns, woran Sie arbeiten.")}</h2>
            <label className="block mt-4 text-small text-muted">{t("Your name", "Ihr Name")}<input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
            <label className="block mt-3 text-small text-muted">{t("Your email", "Ihre E-Mail")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></label>
            <label className="block mt-3 text-small text-muted">{t("Message", "Nachricht")}<textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} className={input} /></label>
            <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} style={{ position: "absolute", left: "-9999px", opacity: 0 }} aria-hidden="true" />
            {err && <p className="mt-2 text-xs text-danger">{err}</p>}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button disabled={state === "busy"} onClick={onClose} className="rounded-full border border-white/20 px-4 py-1.5 text-caption font-mono tracking-wider hover:border-white/40">{t("CANCEL", "ABBRECHEN")}</button>
              <button
                disabled={state === "busy" || !email.includes("@") || msg.trim().length < 3}
                onClick={send}
                className="rounded-full text-white text-caption font-mono tracking-wider px-4 py-1.5 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
              >
                {state === "busy" ? t("SENDING…", "SENDE…") : t("SEND", "SENDEN")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
