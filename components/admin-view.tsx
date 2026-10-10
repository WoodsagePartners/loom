"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

type AOrg = { id: string; name: string; workspace_limit: number; user_limit: number; term_end: string | null; contact_email: string | null; workspaces: number; users: number; owners: string };
type AFree = { id: string; name: string; description: string | null; locked: boolean; created_at: string; members: number; owner: string | null; processes: number };
type ALic = { code: string; owner_email: string; organization_name: string | null; workspace_limit: number; user_limit: number; expires_at: string; redeemed_at: string | null };
export type AdminData = { organizations: AOrg[]; free: AFree[]; licenses: ALic[] };

const input = "bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2 outline-none focus:border-orange/60";
const btn = "rounded-full border border-white/20 px-3 py-1 text-[0.68rem] font-mono tracking-wider hover:border-white/40 disabled:opacity-40";

export function AdminView({ data }: { data: AdminData }) {
  const t = useT();
  const router = useRouter();
  const sb = createClient();
  const [tab, setTab] = useState<"orgs" | "free">("orgs");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [ws, setWs] = useState(3);
  const [us, setUs] = useState(10);
  const [months, setMonths] = useState(12);
  const [newCode, setNewCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function makeLicense() {
    setBusy(true);
    setErr("");
    const { data: code, error } = await sb.rpc("admin_create_license", { p_owner_email: email, p_org_name: orgName, p_workspaces: ws, p_users: us, p_term_months: months });
    setBusy(false);
    if (error) return setErr(error.message);
    setNewCode(code as string);
    setEmail("");
    setOrgName("");
    router.refresh();
  }
  async function move(workspace: string, org: string | null) {
    const { error } = await sb.rpc("admin_move_workspace", { p_workspace: workspace, p_org: org });
    if (error) setErr(error.message);
    else router.refresh();
  }
  const tabBtn = (k: "orgs" | "free", label: string) => (
    <button onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-full text-[0.74rem] font-mono tracking-wider border ${tab === k ? "border-orange/60 text-orange bg-orange/10" : "border-white/15 text-muted hover:text-text"}`}>{label}</button>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <div className="glass-chrome border-b border-white/10 h-[4.25rem] flex items-center gap-3 pl-5 pr-8">
        <span className="font-semibold tracking-[0.16em] text-sm">THE <span className="text-orange">LOOM</span></span>
        <span className="text-muted/40">|</span>
        <span className="font-mono text-[0.78rem] tracking-[0.16em] text-muted">{t("ADMINISTRATOR", "ADMINISTRATOR")}</span>
        <a href="/loomfloor" className="ml-auto text-[0.78rem] text-muted hover:text-orange">{t("← Loom Floor", "← Loom Floor")}</a>
      </div>
      <main className="flex-1 w-full max-w-5xl mx-auto p-6 pt-10">
        <div className="flex gap-2 mb-6">
          {tabBtn("orgs", t(`Organizations (${data.organizations.length})`, `Organisationen (${data.organizations.length})`))}
          {tabBtn("free", t(`Free Accounts (${data.free.length})`, `Kostenlose Konten (${data.free.length})`))}
        </div>
        {err && <p className="mb-4 text-xs text-danger">{err}</p>}

        {tab === "orgs" && (
          <>
            <section className="glass rounded-2xl p-5 mb-6">
              <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-orange mb-3">{t("Issue a license", "Lizenz ausstellen")}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("Owner's email", "E-Mail des Eigentümers")} className={input} />
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={t("Organization name", "Name der Organisation")} className={input} />
                <label className="text-[0.74rem] text-muted">{t("Workspaces", "Arbeitsbereiche")}<input type="number" min={1} value={ws} onChange={(e) => setWs(+e.target.value)} className={input + " w-full mt-1"} /></label>
                <label className="text-[0.74rem] text-muted">{t("Users", "Benutzer")}<input type="number" min={1} value={us} onChange={(e) => setUs(+e.target.value)} className={input + " w-full mt-1"} /></label>
                <label className="text-[0.74rem] text-muted">{t("Term (months)", "Laufzeit (Monate)")}<input type="number" min={1} value={months} onChange={(e) => setMonths(+e.target.value)} className={input + " w-full mt-1"} /></label>
              </div>
              <button disabled={busy || !email.includes("@") || !orgName.trim()} onClick={makeLicense} className="mt-3 rounded-full text-white text-[0.72rem] font-mono tracking-wider px-4 py-2 disabled:opacity-40" style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}>
                {t("GENERATE CODE", "CODE ERZEUGEN")}
              </button>
              {newCode && (
                <p className="mt-3 text-sm">
                  {t("Code (valid 60 days, single use, tied to that email):", "Code (60 Tage gültig, einmalig, an diese E-Mail gebunden):")} <span className="font-mono tracking-wider text-orange select-all">{newCode}</span>
                </p>
              )}
            </section>

            <div className="grid gap-3">
              {data.organizations.map((o) => (
                <div key={o.id} className="glass rounded-2xl p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[0.95rem] font-medium">{o.name}</div>
                    <div className="text-[0.76rem] text-muted">
                      {t(`${o.workspaces}/${o.workspace_limit} workspaces`, `${o.workspaces}/${o.workspace_limit} Arbeitsbereiche`)} · {t(`${o.users}/${o.user_limit} users`, `${o.users}/${o.user_limit} Benutzer`)}
                      {o.term_end && <> · {t("until", "bis")} {new Date(o.term_end).toLocaleDateString()}</>}
                    </div>
                  </div>
                  <div className="text-[0.76rem] text-muted/80 mt-1">{t("Owners", "Eigentümer")}: {o.owners || "—"}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 font-mono text-[0.66rem] tracking-[0.14em] uppercase text-muted mb-2">{t("Recent license codes", "Letzte Lizenzcodes")}</div>
            <div className="grid gap-1 text-[0.78rem]">
              {data.licenses.map((l) => (
                <div key={l.code} className="flex flex-wrap gap-x-4 text-muted">
                  <span className="font-mono">{l.code}</span>
                  <span className="flex-1 truncate">{l.organization_name} · {l.owner_email} · {l.workspace_limit}/{l.user_limit}</span>
                  <span>{l.redeemed_at ? t("redeemed", "eingelöst") : `${t("expires", "läuft ab")} ${new Date(l.expires_at).toLocaleDateString()}`}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "free" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.free.map((w) => (
              <div key={w.id} className="glass rounded-2xl p-4 flex flex-col gap-2">
                <div className="text-[0.95rem] font-medium truncate">{w.name}{w.locked && <span className="ml-2 text-[0.64rem] font-mono text-orange">{t("LOCKED", "GESPERRT")}</span>}</div>
                {w.description && <p className="text-[0.8rem] text-muted line-clamp-3 whitespace-pre-line">{w.description}</p>}
                <div className="text-[0.72rem] text-muted/80">
                  {w.owner ?? "—"} · {t(`${w.members} members`, `${w.members} Mitglieder`)} · {t(`${w.processes} processes`, `${w.processes} Prozesse`)} · {t("created", "erstellt")} {new Date(w.created_at).toLocaleDateString()}
                </div>
                {data.organizations.length > 0 && (
                  <select defaultValue="" onChange={(e) => e.target.value && move(w.id, e.target.value)} className={input + " !text-[0.74rem] mt-auto"}>
                    <option value="">{t("Move into organization…", "In Organisation verschieben…")}</option>
                    {data.organizations.map((o) => (
                      <option key={o.id} value={o.id} className="bg-[#0b1020]">{o.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
            {data.free.length === 0 && <p className="text-muted text-sm">{t("No free accounts.", "Keine kostenlosen Konten.")}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
