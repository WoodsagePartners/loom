"use client";

import { useState } from "react";

/** A small (?) that explains itself on hover (or tap). Safe inside buttons: it only uses spans and swallows its own clicks. */
export function HelpTip({ title, body, how, side = "left" }: { title: string; body: string; how?: string; side?: "left" | "above" | "below" }) {
  const [on, setOn] = useState(false);
  const theme = typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const pos = side === "left" ? "right-full mr-2 top-0" : side === "above" ? "right-0 bottom-full mb-2" : "right-0 top-full mt-2";
  return (
    <span
      className="relative inline-flex flex-none align-middle"
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOn((v) => !v); }}
    >
      <span
        role="img"
        aria-label={title}
        className={`w-3.5 h-3.5 rounded-full border text-[0.58rem] leading-none flex items-center justify-center cursor-help transition-colors ${on ? "border-orange/70 text-orange" : "border-white/25 text-muted hover:text-orange hover:border-orange/60"}`}
      >
        ?
      </span>
      {on && (
        <span
          className={`absolute z-[70] block w-60 rounded-xl p-3 text-left pointer-events-none glass glass-bright ${pos}`}
          style={{ background: theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(12,16,26,0.98)" }}
        >
          <span className="block font-mono text-[0.62rem] tracking-[0.14em] text-orange uppercase">{title}</span>
          <span className="block mt-1 text-[0.76rem] leading-snug text-text/90 normal-case font-normal tracking-normal">{body}</span>
          {how && <span className="block mt-1.5 text-[0.7rem] leading-snug text-muted normal-case font-normal tracking-normal">{how}</span>}
        </span>
      )}
    </span>
  );
}
