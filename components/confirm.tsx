"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

type Req = { msg: string; title?: string; confirmLabel?: string; resolve: (ok: boolean) => void };

function ConfirmDialog({ req, onDone }: { req: Req; onDone: (ok: boolean) => void }) {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onDone(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 backdrop-blur-[3px] p-4" onMouseDown={(e) => e.target === e.currentTarget && onDone(false)}>
      <div role="alertdialog" aria-modal="true" className="w-full max-w-sm glass glass-bright glass-dense glass-pop rounded-2xl p-5 text-sm">
        <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-text/60 mb-2">{req.title ?? t("Please confirm", "Bitte bestätigen")}</div>
        <p className="text-[0.9rem] leading-relaxed text-text/90 whitespace-pre-wrap">{req.msg}</p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button ref={cancelRef} onClick={() => onDone(false)} className="rounded-full border border-white/20 px-4 py-1.5 text-[0.74rem] font-mono tracking-wider hover:border-white/40">
            {t("CANCEL", "ABBRECHEN")}
          </button>
          <button onClick={() => onDone(true)} className="rounded-full border border-red-400/50 bg-red-500/15 px-4 py-1.5 text-[0.74rem] font-mono tracking-wider text-red-300 hover:bg-red-500/25 transition-colors">
            {req.confirmLabel ?? t("DELETE", "LÖSCHEN")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Themed replacement for window.confirm: `const [ask, dialog] = useConfirm(); if (!(await ask("…"))) return;` and render {dialog}. */
export function useConfirm(): readonly [(msg: string, o?: { title?: string; confirmLabel?: string }) => Promise<boolean>, ReactNode] {
  const [req, setReq] = useState<Req | null>(null);
  const ask = useCallback(
    (msg: string, o?: { title?: string; confirmLabel?: string }) => new Promise<boolean>((resolve) => setReq({ msg, ...o, resolve })),
    []
  );
  const done = useCallback(
    (ok: boolean) => {
      setReq((r) => {
        r?.resolve(ok);
        return null;
      });
    },
    []
  );
  return [ask, req ? <ConfirmDialog key="confirm" req={req} onDone={done} /> : null] as const;
}
