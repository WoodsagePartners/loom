"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { LegalModal } from "@/components/legal-modal";
import { PRIVACY, PROCESSOR, TERMS } from "@/lib/legal";

// "More…" — a small pop-up at the bottom of the left menu: the legal pages (Help lives on the canvas toolbar).
export function MoreMenu(_props: { onHelp?: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<"privacy" | "terms" | "processor" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ right: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const item = "w-full text-left px-3 py-2 text-small rounded-lg text-text/85 hover:text-orange hover:bg-white/10 transition-colors block";
  return (
    <div ref={ref} className="relative">
      <button
        ref={btn}
        onClick={() => {
          const r = btn.current?.getBoundingClientRect();
          if (r) setPos({ right: Math.max(8, window.innerWidth - r.right), top: r.bottom + 10 });
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="text-caption tracking-[0.1em] uppercase text-muted hover:text-orange transition-colors whitespace-nowrap"
      >
        {t("About", "Über")} ▾
      </button>
      {open && pos && createPortal(
        <div ref={pop} role="menu" className="fixed w-60 z-[70] glass glass-bright glass-pop rounded-xl p-1.5" style={{ right: pos.right, top: pos.top, background: "var(--tint-solid)" }}>
          <div className="px-3 pt-1.5 pb-1 text-label font-mono tracking-[0.14em] uppercase text-muted/70">{t("Notices:", "Hinweise:")}</div>
          <button role="menuitem" className={`${item} !pl-6`} onClick={() => { setOpen(false); setDoc("privacy"); }}>
            {t("Privacy notice", "Datenschutzhinweis")}
          </button>
          <button role="menuitem" className={`${item} !pl-6`} onClick={() => { setOpen(false); setDoc("terms"); }}>
            {t("Terms of use", "Nutzungsbedingungen")}
          </button>
          <button role="menuitem" className={`${item} !pl-6`} onClick={() => { setOpen(false); setDoc("processor"); }}>
            {t("Processor note", "Auftragsverarbeitung")}
          </button>
        </div>,
        document.body
      )}
      {doc && <LegalModal doc={doc === "privacy" ? PRIVACY : doc === "terms" ? TERMS : PROCESSOR} slug={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}
