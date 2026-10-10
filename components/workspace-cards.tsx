"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import type { Workspace } from "@/lib/workspaces";
import { createClient } from "@/lib/supabase/client";
import { AccountMenu, AccountModal } from "@/components/account";
import { CtaBanner } from "@/components/flow/cta-banner";
import { Guide } from "@/components/guide";
import { LockIcon } from "@/components/icons";
import { ContentI18nProvider, Tx } from "@/lib/content-i18n";
import type { Profile } from "@/lib/profile";
import type { OrgView } from "@/lib/organizations";
import { OrganizationSection, RedeemBox } from "@/components/organization-section";
import { LegalModal } from "@/components/legal-modal";
import { PRIVACY, PROCESSOR, TERMS } from "@/lib/legal";

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
        <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-danger mb-2">{t("Caution — permanent", "Achtung – endgültig")}</div>
        <div className="text-[0.78rem] text-muted mb-1">{t("Delete this workspace and clear all associated caches", "Diesen Arbeitsbereich löschen und alle zugehörigen Caches leeren")}</div>
        <h2 className="text-base font-medium mb-2">{t(`Delete “${ws.name}”?`, `„${ws.name}“ löschen?`)}</h2>
        <p className="text-[0.88rem] leading-relaxed text-text/90">
          {t(
            "This deletes the workspace and everything in it: all processes, lanes, roles, steps, lines, plans, members, invitations and every cached translation.",
            "Dies löscht den Arbeitsbereich und alles darin: alle Prozesse, Bahnen, Rollen, Schritte, Linien, Pläne, Mitglieder, Einladungen und alle zwischengespeicherten Übersetzungen."
          )}
        </p>
        <p className="mt-2 text-[0.88rem] leading-relaxed text-danger font-medium">
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
        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button disabled={busy} onClick={onClose} className="rounded-full border border-white/20 px-4 py-1.5 text-[0.74rem] font-mono tracking-wider hover:border-white/40">{t("CANCEL", "ABBRECHEN")}</button>
          <button
            disabled={busy || word.trim() !== KEYWORD}
            onClick={go}
            className="rounded-full border btn-danger px-4 py-1.5 text-[0.74rem] font-mono tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? t("DELETING…", "LÖSCHE…") : t("DELETE FOREVER", "ENDGÜLTIG LÖSCHEN")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceCards({ workspaces, profile: initialProfile, organizations = [], isAdmin = false, showRedeem = false }: { workspaces: Workspace[]; profile: Profile; organizations?: OrgView[]; isAdmin?: boolean; showRedeem?: boolean }) {
  const t = useT();
  const [profile, setProfile] = useState(initialProfile);
  const [accountOpen, setAccountOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [legal, setLegal] = useState<"privacy" | "terms" | "processor" | null>(null);
  const router = useRouter();
  const [list, setList] = useState(workspaces);
  const [target, setTarget] = useState<Workspace | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const contentTexts = useMemo(() => workspaces.flatMap((w) => [w.name, w.description ?? ""]).filter(Boolean), [workspaces]);
  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/");
  }
  const roleLabel = { owner: t("Owner", "Eigentümer"), admin: t("Admin", "Admin"), member: t("Member", "Mitglied") };

  async function open(id: string, join = false) {
    setOpening(id);
    if (join) {
      const { error } = await createClient().rpc("org_join_workspace", { p_workspace: id });
      if (error) {
        setOpening(null);
        return;
      }
    }
    await fetch("/api/workspace/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: id }) });
    router.push("/dashboard");
  }

  return (
    <ContentI18nProvider texts={contentTexts}>
    <div className="min-h-screen flex flex-col">
      <div className="relative glass-chrome flex-none border-b border-white/10 h-[4.25rem] flex items-center gap-3 pl-5 pr-8">
        <span className="flex items-center gap-3 font-semibold tracking-[0.16em] text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/loom-mark.svg" alt="" width={42} height={42} className="rounded-xl" />
          <span>THE <span className="text-orange">LOOM</span></span>
        </span>
        <span className="text-muted/40">|</span>
        <span className="font-mono text-[0.78rem] tracking-[0.16em] text-muted">{t("LOOM FLOOR", "LOOM FLOOR")}</span>
        <CtaBanner />
        <div className="ml-auto flex items-center gap-3">
          {isAdmin && <a href="/admin" className="font-mono text-[0.68rem] tracking-[0.16em] text-muted hover:text-orange">{t("ADMIN", "ADMIN")}</a>}
          <AccountMenu profile={profile} onAccount={() => setAccountOpen(true)} onTeam={() => {}} onGuide={() => setGuideOpen(true)} onSignOut={signOut} />
        </div>
      </div>
    <main className="flex-1 flex items-start justify-center p-6 pt-12">
      <div className="w-full max-w-3xl">
        <h1 className="text-lg font-medium mb-1">
          {(() => {
            const first = (profile.name || "").trim().split(/\s+/)[0] || profile.email.split("@")[0];
            return t(`Welcome ${first}!`, `Willkommen ${first}!`);
          })()}
        </h1>
        <p className="text-muted text-sm font-light mb-6">{t("Here are your workspaces...", "Hier sind Ihre Arbeitsbereiche...")}</p>
        {organizations.map((ov) => (
          <OrganizationSection
            key={ov.org.id}
            ov={ov}
            greeting={t(`Welcome, ${(profile.name || "").trim().split(/\s+/)[0] || profile.email.split("@")[0]}`, `Willkommen, ${(profile.name || "").trim().split(/\s+/)[0] || profile.email.split("@")[0]}`)}
            memberIds={new Set(workspaces.map((w) => w.id))}
            onOpen={(id, join) => open(id, join)}
          />
        ))}
        {showRedeem && <RedeemBox />}
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((w) => (
            <div key={w.id} className="glass rounded-2xl p-5 flex flex-col gap-4">
              <div>
                <div className="text-[0.95rem] font-medium truncate"><Tx text={w.name} /></div>
                <div className="text-[0.7rem] font-mono tracking-wider text-muted/70 mt-0.5 flex items-center gap-2">
                  <span>{roleLabel[w.role].toUpperCase()}</span>
                  {w.locked && (
                    <span className="inline-flex items-center gap-1 text-orange" title={t("Locked: view only until an owner or admin unlocks it", "Gesperrt: nur Ansicht, bis ein Eigentümer oder Admin entsperrt")}>
                      <LockIcon size={11} />
                      {t("LOCKED", "GESPERRT")}
                    </span>
                  )}
                </div>
                {w.description && <p className="mt-2 text-[0.85rem] text-muted font-normal leading-snug line-clamp-3 whitespace-pre-line"><Tx text={w.description} /></p>}
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
                    className="rounded-full border btn-danger px-4 py-2 text-[0.72rem] font-mono tracking-wider transition-colors whitespace-nowrap"
                  >
                    {t("DELETE", "LÖSCHEN")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => router.push("/onboarding")} className="mt-5 text-[0.78rem] text-muted hover:text-text">{t("+ New workspace", "+ Neuer Arbeitsbereich")}</button>
        {!showRedeem && <button onClick={() => router.push("/workspaces?redeem=1")} className="mt-5 ml-5 text-[0.78rem] text-muted hover:text-text">{t("Have a license code?", "Lizenzcode einlösen?")}</button>}
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
    <footer className="flex-none flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-6 py-4 text-[0.72rem] text-muted/70">
      <button type="button" onClick={() => setLegal("privacy")} className="hover:text-orange hover:underline">{t("Privacy notice", "Datenschutzhinweis")}</button>
      <button type="button" onClick={() => setLegal("terms")} className="hover:text-orange hover:underline">{t("Terms of use", "Nutzungsbedingungen")}</button>
      <button type="button" onClick={() => setLegal("processor")} className="hover:text-orange hover:underline">{t("Processor note", "Auftragsverarbeitung")}</button>
    </footer>
    {legal && <LegalModal doc={legal === "privacy" ? PRIVACY : legal === "terms" ? TERMS : PROCESSOR} slug={legal} onClose={() => setLegal(null)} />}
    {guideOpen && <Guide onClose={() => setGuideOpen(false)} />}
    {accountOpen && <AccountModal profile={profile} onClose={() => setAccountOpen(false)} onSaved={setProfile} />}
    </div>
    </ContentI18nProvider>
  );
}
