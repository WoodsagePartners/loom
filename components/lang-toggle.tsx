"use client";

import { setLang, useLang } from "@/lib/i18n";

export function LangToggle({ className = "" }: { className?: string }) {
  const lang = useLang();
  return (
    <div className={`flex font-mono text-[0.76rem] tracking-wider ${className}`}>
      {(["en", "de"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`w-10 h-7 inline-flex items-center justify-center border first:rounded-l-full last:rounded-r-full transition-colors ${
            lang === l ? "border-orange/50 text-orange bg-orange/10" : "border-white/10 text-muted"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
