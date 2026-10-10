"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLang, useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import { LegalBody } from "@/components/legal-page";
import type { LDoc } from "@/lib/legal";

function toText(doc: LDoc, lang: "en" | "de") {
  const i = lang === "de" ? 1 : 0;
  const out: string[] = [doc.title[i], "=".repeat(doc.title[i].length), `${lang === "de" ? "Stand" : "Updated"}: ${doc.updated}`, "", doc.intro[i], ""];
  for (const s of doc.sections) {
    out.push(s.h[i].toUpperCase());
    s.p.filter((x) => x[0]).forEach((x) => out.push(x[i]));
    (s.bullets ?? []).forEach((b) => out.push(`- ${b[i]}`));
    out.push("");
  }
  out.push("Struinova Innovation · ron@struinova.com");
  return out.join("\n");
}

/** A scrollable pop-up that shows a legal document inside the workspace, with the language switch and a download. */
export function LegalModal({ doc, slug, onClose }: { doc: LDoc; slug: string; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  function download() {
    const blob = new Blob([toText(doc, lang)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loom-${slug}-${lang}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl max-h-[86vh] flex flex-col glass glass-bright glass-dense glass-pop rounded-2xl">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <h2 className="flex-1 text-base font-medium">{t(...doc.title)}</h2>
          <LangToggle />
          <button
            onClick={download}
            title={t("Download as text file", "Als Textdatei herunterladen")}
            className="rounded-full border border-white/20 px-3 h-7 text-label font-mono tracking-wider text-muted hover:text-orange hover:border-orange/50"
          >
            ⤓ {t("DOWNLOAD", "HERUNTERLADEN")}
          </button>
          <button onClick={onClose} aria-label={t("Close", "Schließen")} className="text-muted hover:text-text text-lg leading-none px-1">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto quiet-scroll px-6 py-5">
          <LegalBody doc={doc} />
        </div>
      </div>
    </div>,
    document.body
  );
}
