"use client";

import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import type { LDoc } from "@/lib/legal";

export function LegalBody({ doc }: { doc: LDoc }) {
  const t = useT();
  return (
    <>
      <p className="text-[0.74rem] font-mono tracking-wider text-muted/70 mb-4">{t("Updated", "Stand")} {doc.updated}</p>
      <p className="text-[0.92rem] leading-relaxed text-text/90 mb-6">{t(...doc.intro)}</p>
      <div className="space-y-6">
        {doc.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-[0.78rem] font-medium tracking-[0.12em] uppercase text-text/90 mb-2">{t(...s.h)}</h2>
            {s.p.filter((x) => x[0]).map((x, k) => (
              <p key={k} className="text-[0.88rem] leading-relaxed text-text/80 mb-2">{t(...x)}</p>
            ))}
            {s.bullets && (
              <ul className="list-disc pl-5 space-y-1.5 text-[0.88rem] leading-relaxed text-text/80">
                {s.bullets.map((b, k) => (
                  <li key={k}>{t(...b)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

export function LegalPage({ doc }: { doc: LDoc }) {
  const t = useT();
  return (
    <main className="min-h-screen flex justify-center p-6">
      <div className="w-full max-w-2xl py-6">
        <div className="flex items-center justify-between mb-6">
          <a href="/dashboard" className="text-[0.78rem] text-muted hover:text-text">
            ← {t("Back to Loom", "Zurück zu Loom")}
          </a>
          <LangToggle />
        </div>
        <div className="glass rounded-3xl p-8">
          <h1 className="text-xl font-medium mb-1">{t(...doc.title)}</h1>
          <p className="text-[0.74rem] font-mono tracking-wider text-muted/70 mb-5">{t("Updated", "Stand")} {doc.updated}</p>
          <p className="text-[0.92rem] leading-relaxed text-text/90 mb-6">{t(...doc.intro)}</p>
          <div className="space-y-6">
            {doc.sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-[0.78rem] font-medium tracking-[0.12em] uppercase text-text/90 mb-2">{t(...s.h)}</h2>
                {s.p.filter((x) => x[0]).map((x, k) => (
                  <p key={k} className="text-[0.88rem] leading-relaxed text-text/80 mb-2">{t(...x)}</p>
                ))}
                {s.bullets && (
                  <ul className="list-disc pl-5 space-y-1.5 text-[0.88rem] leading-relaxed text-text/80">
                    {s.bullets.map((b, k) => (
                      <li key={k}>{t(...b)}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
