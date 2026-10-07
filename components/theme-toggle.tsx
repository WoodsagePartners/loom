"use client";

import { setTheme, useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  const t = useT();
  const items = [
    { key: "dark" as const, glyph: "☾", label: t("Dark", "Dunkel") },
    { key: "light" as const, glyph: "☀", label: t("Light", "Hell") },
  ];
  return (
    <div className={`flex font-mono text-[0.76rem] ${className}`} role="group" aria-label={t("Theme", "Darstellung")}>
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          title={i.label}
          aria-label={i.label}
          aria-pressed={theme === i.key}
          onClick={() => setTheme(i.key)}
          className={`w-10 h-7 inline-flex items-center justify-center border first:rounded-l-full last:rounded-r-full transition-colors ${
            theme === i.key ? "border-orange/50 text-orange bg-orange/10" : "border-white/10 text-muted"
          }`}
        >
          {i.glyph}
        </button>
      ))}
    </div>
  );
}
