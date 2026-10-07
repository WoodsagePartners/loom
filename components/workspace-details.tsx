"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

// Two plain-language fields that tell Loom (and later the AI helper) what this
// workspace is about and where the pain is felt.
export function WorkspaceDetails({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const t = useT();
  const sb = useRef(createClient()).current;
  const [desc, setDesc] = useState("");
  const [look, setLook] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    sb.from("orgs").select("description, looking_for").eq("id", orgId).maybeSingle().then(({ data }) => {
      setDesc(data?.description ?? "");
      setLook(data?.looking_for ?? "");
      setLoaded(true);
    });
  }, [sb, orgId]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  async function save() {
    setBusy(true);
    const { error } = await sb.from("orgs").update({ description: desc.trim() || null, looking_for: look.trim() || null }).eq("id", orgId);
    setBusy(false);
    if (error) return setErr(error.message);
    onClose();
  }

  const box = "w-full bg-black/25 border border-white/15 focus:border-orange/50 rounded-lg text-[0.84rem] px-3 py-2 outline-none resize-none";
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="glass glass-bright rounded-2xl w-full max-w-lg p-6"
        style={{ background: "var(--tint-solid)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[0.95rem] font-medium">{t("About this workspace", "Über diesen Arbeitsbereich")}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-text text-lg leading-none">×</button>
        </div>
        <label className="block text-[0.74rem] text-muted mb-1">{t("What does this workspace do? Who is it for?", "Was macht dieser Arbeitsbereich? Für wen ist er?")}</label>
        <textarea rows={3} value={desc} disabled={!loaded} onChange={(e) => setDesc(e.target.value)} className={box}
          placeholder={t("e.g. Order-to-delivery for our packaging plant in Linz", "z. B. Auftrag bis Lieferung in unserem Verpackungswerk in Linz")} />
        <label className="block text-[0.74rem] text-muted mt-4 mb-1">{t("What are you looking for? Any hunch about where it hurts?", "Wonach suchen Sie? Haben Sie eine Ahnung, wo es hakt?")}</label>
        <textarea rows={3} value={look} disabled={!loaded} onChange={(e) => setLook(e.target.value)} className={box}
          placeholder={t("e.g. Quotes seem to stall between sales and engineering", "z. B. Angebote bleiben anscheinend zwischen Vertrieb und Technik hängen")} />
        {err && <div className="text-[0.74rem] text-red-300 mt-2">{err}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-[0.8rem] text-muted hover:text-text">{t("Cancel", "Abbrechen")}</button>
          <button type="button" onClick={save} disabled={busy || !loaded}
            className="px-4 py-1.5 rounded-full text-[0.8rem] bg-orange/90 text-black hover:bg-orange disabled:opacity-50">
            {busy ? t("Saving…", "Speichern…") : t("Save", "Speichern")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
