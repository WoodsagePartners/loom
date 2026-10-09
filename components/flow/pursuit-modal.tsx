"use client";

import { useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import { useTx } from "@/lib/content-i18n";
import type { FlowPin } from "@/lib/flow";
import { PIN_KINDS } from "@/components/flow/pin-layer";

const TRAIL: Record<string, { en: string; de: string; color: string; glyph: string }> = {
  signal: { en: "Signal", de: "Signal", color: "#fbbf24", glyph: "▲" },
  question: PIN_KINDS.question,
  finding: PIN_KINDS.finding,
  idea: PIN_KINDS.idea,
  at: { en: "On", de: "An", color: "#9aa3b2", glyph: "@" },
};

/** Opens a pursuit: edit its headline, clarify the item, see where it came from. The seed of the innovation canvas. */
export function PursuitModal({
  pin,
  onSave,
  onSuggest,
  onShow,
  onRemove,
  onClose,
}: {
  pin: FlowPin;
  onSave: (patch: { headline: string | null; body: string }) => void;
  onSuggest: (body: string) => Promise<string | null>;
  onShow: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const tx = useTx();
  const lang = useLang();
  const [headline, setHeadline] = useState(pin.headline ?? "");
  const [body, setBody] = useState(pin.body);
  const [busy, setBusy] = useState(false);
  const latest = useRef({ headline, body });
  latest.current = { headline, body };
  const saved = useRef(false);
  const k = PIN_KINDS[pin.kind];

  const save = () => {
    if (saved.current) return;
    saved.current = true;
    const h = latest.current.headline.trim();
    const b = latest.current.body.trim() || pin.body;
    if (h !== (pin.headline ?? "") || b !== pin.body) onSave({ headline: h || null, body: b });
  };
  const close = () => { save(); onClose(); };
  const closeRef = useRef(close);
  closeRef.current = close;

  // the headline arrives a moment after a pursuit is created: pick it up if the box is still empty
  useEffect(() => { if (!headline && pin.headline) setHeadline(pin.headline); }, [pin.headline]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const suggest = async () => {
    setBusy(true);
    const h = await onSuggest(body.trim() || pin.body);
    setBusy(false);
    if (h) setHeadline(h);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(4,6,12,.62)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" className="glass glass-bright rounded-2xl w-[min(560px,94vw)] max-h-[90vh] overflow-y-auto p-5" style={{ background: "rgba(12,16,26,0.98)", borderColor: "rgba(252,211,77,.4)" }}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.62rem] tracking-[0.16em]" style={{ color: "#fcd34d" }}>★ {t("PURSUIT", "VORHABEN")}</span>
          <span className="font-mono text-[0.58rem] tracking-[0.14em]" style={{ color: k.color }}>{k.glyph} {t(k.en, k.de).toUpperCase()}</span>
          <button onClick={close} aria-label={t("Close", "Schließen")} className="ml-auto text-muted hover:text-text text-lg leading-none">×</button>
        </div>

        <label className="block mt-4 text-[0.66rem] font-mono tracking-[0.12em] text-muted uppercase">{t("Headline", "Überschrift")}</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={60}
            placeholder={pin.headline === null ? t("Writing a headline…", "Überschrift wird geschrieben …") : t("Three words that name it", "Drei Wörter, die es benennen")}
            className="flex-1 bg-black/40 border border-white/15 rounded-lg text-[1rem] font-medium text-text px-3 py-2 outline-none focus:border-orange/60 placeholder:text-text/35"
          />
          <button onClick={suggest} disabled={busy} title={t("Let Loom suggest a headline", "Loom eine Überschrift vorschlagen lassen")} className="rounded-full border border-orange/50 text-orange text-[0.7rem] px-3 py-1.5 hover:bg-orange/10 disabled:opacity-50 whitespace-nowrap">
            {busy ? "…" : `✦ ${t("Suggest", "Vorschlagen")}`}
          </button>
        </div>

        <label className="block mt-4 text-[0.66rem] font-mono tracking-[0.12em] text-muted uppercase">{t("What we found", "Was wir gefunden haben")}</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.min(10, Math.max(4, Math.ceil(body.length / 60)))}
          placeholder={t("Clarify it: what exactly is the situation, and why does it matter?", "Klären Sie es: Was genau ist die Lage, und warum ist sie wichtig?")}
          className="mt-1 w-full resize-none bg-black/40 border border-white/15 rounded-lg text-[0.86rem] text-text px-3 py-2 outline-none focus:border-orange/60 placeholder:text-text/35"
        />
        {body.trim() && tx(body) !== body.trim() && <div className="mt-1 text-[0.74rem] text-text/70 italic">{tx(body)}</div>}

        {pin.lineage && pin.lineage.length > 0 && (
          <>
            <div className="mt-4 text-[0.66rem] font-mono tracking-[0.12em] text-muted uppercase">{t("Where it came from", "Woher es kommt")}</div>
            <ol className="mt-1.5 flex flex-col gap-1">
              {pin.lineage.map((l, i) => {
                const kk = TRAIL[l.kind] ?? TRAIL.at;
                const text = l.kind === "signal" ? (lang === "de" && l.de ? l.de : l.text) : tx(l.text);
                return (
                  <li key={i} className="flex items-start gap-2 text-[0.78rem] leading-snug text-text/85">
                    <span className="w-4 text-center flex-none" style={{ color: kk.color }}>{kk.glyph}</span>
                    <span className="flex-none w-[4.4rem] text-muted text-[0.68rem] pt-px">{t(kk.en, kk.de)}</span>
                    <span className="flex-1">{text}</span>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button onClick={() => { save(); onShow(); }} className="rounded-full border border-orange/60 bg-orange/10 text-orange text-[0.76rem] px-4 py-1.5 hover:bg-orange/20">
            ⌖ {t("Show on the map", "Auf der Karte zeigen")}
          </button>
          <button onClick={() => { saved.current = true; onRemove(); }} className="text-[0.72rem] text-muted hover:text-red-300">{t("Remove from pursuits", "Aus den Vorhaben entfernen")}</button>
          <button onClick={close} className="ml-auto rounded-full bg-orange text-black text-[0.76rem] font-medium px-4 py-1.5 hover:opacity-90">{t("Done", "Fertig")}</button>
        </div>
        <div className="mt-3 text-[0.62rem] text-muted/60">{t("Coming next: work this pursuit on the innovation canvas.", "Als Nächstes: dieses Vorhaben auf der Innovations-Fläche bearbeiten.")}</div>
      </div>
    </div>
  );
}
