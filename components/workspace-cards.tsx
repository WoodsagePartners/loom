"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import type { Workspace } from "@/lib/workspaces";

const KEYWORD = "DELETE";

function DeleteDialog({ ws, onClose, onDeleted }: { ws: Workspace; onClose: () => void; onDeleted: () => void }) {
  const t = useT();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [busy, onClose]);

  async function go() {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/workspace/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: ws.id, keyword: word }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error ?? t("Could not delete the workspace.", "Der Arbeitsbereich konnte nicht gelöscht werden."));
      setBusy(false);
      return;
    }
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="alertdialog" aria-modal="true" className="w-full max-w-md glass glass-bright glass-dense glass-pop rounded-2xl p-6 text-sm">
        <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-red-300 mb-2">{t("Caution — permanent", "Achtung – endgültig")}</div>
        <div className="text-[0.78rem] text-muted mb-1">{t("Delete this workspace and clear all associated caches", "Diesen Arbeitsbereich löschen und alle zugehörigen Caches leeren")}</div>
        <h2 className="text-base font-medium mb-2">{t(`Delete “${ws.name}”?`, `„${ws.name}“ löschen?`)}</h2>
        <p className="text-[0.88rem] leading-relaxed text-text/90">
          {t(
            "This deletes the workspace and everything in it: all processes, lanes, roles, steps, lines, plans, members, invitations and every cached translation.",
            "Dies löscht den Arbeitsbereich und alles darin: alle Prozesse, Bahnen, Rollen, Schritte, Linien, Pläne, Mitglieder, Einladungen und alle zwischengespeicherten Übersetzungen."
          )}
        </p>
        <p className="mt-2 text-[0.88rem] leading-relaxed text-red-300 font-medium">
          {t("This cannot be undone and nothing can be retrieved afterwards — not by you, not by us.", "Dies kann nicht rückgängig gemacht werden. Nichts kann danach wiederhergestellt werden – weder von Ihnen noch von uns.")}
        </p>
        <label className="block mt-4 text-[0.78rem] text-muted">
          {t(`Type ${KEYWORD} to confirm`, `Zur Bestätigung ${KEYWORD} eingeben`)}
          <input
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && word.trim() === KEYWORD && !busy && go()}
            className="mt-1 w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2.5 outline-none focus:border-red-400/60 font-mono tracking-wider"
          />
        </label>
        {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button disabled={busy} onClick={onClose} className="rounded-full border border-white/20 px-4 py-1.5 text-[0.74rem] font-mono tracking-wider hover:border-white/40">{t("CANCEL", "ABBRECHEN")}</button>
          <button
            disabled={busy || word.trim() !== KEYWORD}
            onClick={go}
            className="rounded-full border border-red-400/50 bg-red-500/15 px-4 py-1.5 text-[0.74rem] font-mono tracking-wider text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? t("DELETING…", "LÖSCHE…") : t("DELETE FOREVER", "ENDGÜLTIG LÖSCHEN")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceCards({ workspaces }: { workspaces: Workspace[] }) {
  const t = useT();
  const router = useRouter();
  const [list, setList] = useState(workspaces);
  const [target, setTarget] = useState<Workspace | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const roleLabel = { owner: t("Owner", "Eigentümer"), admin: t("Admin", "Admin"), member: t("Member", "Mitglied") };

  async function open(id: string) {
    setOpening(id);
    await fetch("/api/workspace/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: id }) });
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-lg font-medium mb-1">{t("Your workspaces", "Ihre Arbeitsbereiche")}</h1>
        <p className="text-muted text-sm font-light mb-6">{t("Choose where to work.", "Wählen Sie, wo Sie arbeiten möchten.")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((w) => (
            <div key={w.id} className="glass rounded-2xl p-5 flex flex-col gap-4">
              <div>
                <div className="text-[0.95rem] font-medium truncate">{w.name}</div>
                <div className="text-[0.7rem] font-mono tracking-wider text-muted/70 mt-0.5">{roleLabel[w.role].toUpperCase()}</div>
                {w.description && <p className="mt-2 text-[0.85rem] text-muted font-normal leading-snug line-clamp-3 whitespace-pre-line">{w.description}</p>}
                {w.lastEdited && (
                  <div className="mt-2 text-[0.74rem] text-muted/70 font-normal" suppressHydrationWarning>
                    {t("Last edited", "Zuletzt bearbeitet")} {new Date(w.lastEdited).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 mt-auto">
                <button
                  disabled={opening !== null}
                  onClick={() => open(w.id)}
                  className="rounded-full text-white text-[0.72rem] font-mono tracking-wider px-4 py-2 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
                >
                  {opening === w.id ? t("OPENING…", "ÖFFNE…") : t("OPEN", "ÖFFNEN")}
                </button>
                {w.role === "owner" && (
                  <button
                    onClick={() => setTarget(w)}
                    title={t("Delete this workspace and clear all associated caches", "Diesen Arbeitsbereich löschen und alle zugehörigen Caches leeren")}
                    className="rounded-full border border-red-400/50 bg-red-500/15 px-4 py-2 text-[0.72rem] font-mono tracking-wider text-red-300 hover:bg-red-500/25 transition-colors whitespace-nowrap"
                  >
                    {t("DELETE", "LÖSCHEN")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => router.push("/onboarding")} className="mt-5 text-[0.78rem] text-muted hover:text-text">{t("+ New workspace", "+ Neuer Arbeitsbereich")}</button>
      </div>
      {target && (
        <DeleteDialog
          ws={target}
          onClose={() => setTarget(null)}
          onDeleted={() => {
            const rest = list.filter((x) => x.id !== target.id);
            setTarget(null);
            if (rest.length === 0) router.push("/onboarding");
            else setList(rest);
          }}
        />
      )}
    </main>
  );
}
