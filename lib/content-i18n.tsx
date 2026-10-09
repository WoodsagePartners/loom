"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLang, useT, type Lang } from "@/lib/i18n";

// Translates what people TYPE (step names, lanes, actors…) between English and
// German. The interface strings use useT(); this handles user content. Each
// phrase is translated once on the server, cached per workspace, and swapped
// in with a short staggered fade so the change sweeps across the diagram.

type Pair = { en: string; de: string };
type Ctx = { map: Record<string, Pair>; lang: Lang; epoch: number; report: (d: number) => void };

// The swap sweep runs at slower: delays x1.6, each fade 1.6s.
const SLOW = 1.6;
const FADE_MS = 1600;

const C = createContext<Ctx>({ map: {}, lang: "en", epoch: 0, report: () => {} });

export function ContentI18nProvider({ texts, children }: { texts: string[]; children: ReactNode }) {
  const lang = useLang();
  const [map, setMap] = useState<Record<string, Pair>>({});
  const [epoch, setEpoch] = useState(0);
  const prev = useRef(lang);
  const asked = useRef<Set<string>>(new Set());
  const [busy, setBusy] = useState(0);
  const maxD = useRef(0); // longest stagger delay among the texts on screen
  const [pct, setPct] = useState<number | null>(null); // sweep progress after a language switch

  // drive the toast's percentage across the whole sweep
  useEffect(() => {
    if (epoch === 0) return;
    const start = Date.now();
    setPct(0);
    const iv = setInterval(() => {
      const total = maxD.current * SLOW + FADE_MS;
      const p = Math.min(100, Math.round(((Date.now() - start) / total) * 100));
      setPct(p);
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => setPct((cur) => (cur === 100 ? null : cur)), 700);
      }
    }, 100);
    return () => clearInterval(iv);
  }, [epoch]);

  // every language switch restarts the swap animation
  useEffect(() => {
    if (prev.current !== lang) {
      prev.current = lang;
      maxD.current = 0;
      setEpoch((e) => e + 1);
    }
  }, [lang]);

  const key = useMemo(
    () => Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean))).sort().join("\u0000"),
    [texts]
  );

  useEffect(() => {
    const todo = key.split("\u0000").filter((t) => t && t.length <= 600 && !asked.current.has(t));
    if (!todo.length) return;
    todo.forEach((t) => asked.current.add(t));
    setBusy((b) => b + 1);
    (async () => {
     try {
      for (let i = 0; i < todo.length; i += 40) {
        const chunk = todo.slice(i, i + 40);
        try {
          const r = await fetch("/api/translate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ texts: chunk }),
          });
          if (!r.ok) {
            chunk.forEach((t) => asked.current.delete(t)); // try again on the next change
            break;
          }
          const j = await r.json();
          const got: Record<string, Pair> = j?.translations ?? {};
          chunk.filter((t) => !got[t]).forEach((t) => asked.current.delete(t));
          setMap((m) => ({ ...m, ...got }));
        } catch {
          chunk.forEach((t) => asked.current.delete(t));
          break;
        }
      }
     } finally {
      setBusy((b) => Math.max(0, b - 1));
     }
    })();
  }, [key]);

  const value = useMemo(() => ({ map, lang, epoch, report: (d: number) => { if (d > maxD.current) maxD.current = d; } }), [map, lang, epoch]);
  return (
    <C.Provider value={value}>
      {children}
      {(pct !== null || busy > 0) && <TranslatingToast lang={lang} pct={pct === null ? 0 : busy > 0 ? Math.min(pct, 99) : pct} />}
    </C.Provider>
  );
}

function pick(ctx: Ctx, text: string) {
  const p = ctx.map[text.trim()];
  return p ? (ctx.lang === "de" ? p.de : p.en) : text;
}

/** Plain-string version, for places that can't hold an element (option labels, titles). */
export function useTx() {
  const ctx = useContext(C);
  return (text: string | null | undefined) => (text ? pick(ctx, text) : "");
}

/** Renders user content in the active language, fading in after `d` ms on each language switch. */
export function Tx({ text, d = 0, className }: { text: string; d?: number; className?: string }) {
  const ctx = useContext(C);
  const animate = ctx.epoch > 0;
  if (animate) ctx.report(d);
  return (
    <span
      key={ctx.epoch}
      className={`${className ?? ""} ${animate ? "tx-swap" : ""}`}
      style={animate ? { animationDelay: `${Math.round(d * SLOW)}ms`, animationDuration: `${FADE_MS}ms` } : undefined}
    >
      {pick(ctx, text)}
    </span>
  );
}

function TranslatingToast({ lang, pct }: { lang: Lang; pct: number }) {
  const t = useT();
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] glass glass-bright glass-pop rounded-full px-4 py-2 text-[0.8rem] flex items-center gap-2.5 pointer-events-none"
      style={{ background: "var(--tint-solid)" }}
    >
      <span className="inline-block w-3 h-3 rounded-full border-2 border-orange/30 border-t-orange animate-spin" aria-hidden />
      {lang === "de"
        ? t(`Translating to German, ${pct}% complete`, `Übersetze ins Deutsche, ${pct} % abgeschlossen`)
        : t(`Translating to English, ${pct}% complete`, `Übersetze ins Englische, ${pct} % abgeschlossen`)}
    </div>
  );
}
