"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLang, type Lang } from "@/lib/i18n";

// Translates what people TYPE (step names, lanes, actors…) between English and
// German. The interface strings use useT(); this handles user content. Each
// phrase is translated once on the server, cached per workspace, and swapped
// in with a short staggered fade so the change sweeps across the diagram.

type Pair = { en: string; de: string };
type Ctx = { map: Record<string, Pair>; lang: Lang; epoch: number };

const C = createContext<Ctx>({ map: {}, lang: "en", epoch: 0 });

export function ContentI18nProvider({ texts, children }: { texts: string[]; children: ReactNode }) {
  const lang = useLang();
  const [map, setMap] = useState<Record<string, Pair>>({});
  const [epoch, setEpoch] = useState(0);
  const prev = useRef(lang);
  const asked = useRef<Set<string>>(new Set());

  // every language switch restarts the swap animation
  useEffect(() => {
    if (prev.current !== lang) {
      prev.current = lang;
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
    (async () => {
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
    })();
  }, [key]);

  const value = useMemo(() => ({ map, lang, epoch }), [map, lang, epoch]);
  return <C.Provider value={value}>{children}</C.Provider>;
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
  return (
    <span
      key={ctx.epoch}
      className={`${className ?? ""} ${animate ? "tx-swap" : ""}`}
      style={animate ? { animationDelay: `${Math.round(d)}ms` } : undefined}
    >
      {pick(ctx, text)}
    </span>
  );
}
