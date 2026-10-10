"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { PROCESSOR_VERSION, type OrgView } from "@/lib/organizations";

const btn = "rounded-full border border-white/20 px-3 py-1 text-[0.68rem] font-mono tracking-wider hover:border-white/40 disabled:opacity-40";
const input = "bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2 outline-none focus:border-orange/60";

export function RedeemBox() {
  const t = useT();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true);
    setErr("");
    const { error } = await createClient().rpc("redeem_license", { p_code: code });
    if (error) {
      setErr(t("That code didn't work. Check it, make sure you're signed in with the email it was issued to, or ask us for a new one.", "Dieser Code hat nicht funktioniert. Bitte prüfen Sie ihn, melden Sie sich mit der E-Mail-Adresse an, für die er ausgestellt wurde, oder fragen Sie nach einem neuen."));
      setBusy(false);
      return;
    }
    window.location.assign("/workspaces");
  }
  return (
    <div className="glass rounded-2xl p-5 mb-6">
      <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-orange mb-2">{t("License code", "Lizenzcode")}</div>
      <p className="text-[0.85rem] text-muted mb-3">{t("Have an enterprise license code? Enter it to open your organization.", "Haben Sie einen Enterprise-Lizenzcode? Geben Sie ihn ein, um Ihre Organisation zu öffnen.")}</p>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" className={input + " flex-1 font-mono tracking-wider"} />
        <button disabled={busy || code.trim().length < 8} onClick={go} className="rounded-full text-white text-[0.72rem] font-mono tracking-wider px-4 py-2 disabled:opacity-40" style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}>
          {busy ? t("CHECKING…", "PRÜFE…") : t("REDEEM", "EINLÖSEN")}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

export function OrganizationSection({ ov, memberIds, onOpen, greeting }: { ov: OrgView; memberIds: Set<string>; onOpen: (id: string, join: boolean) => void; greeting: string }) {
  const t = useT();
  const sb = createClient();
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const isOwner = ov.my_role === "owner";
  const expired = !!ov.org.term_end && new Date(ov.org.term_end) < new Date();
  const wsUsed = ov.workspaces.length;
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, okText?: string, reload = true) => {
    setBusy(true);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    if (reload) window.location.reload();
    else setMsg({ ok: true, text: okText ?? "" });
  };
  const acked = ov.acks[0];
  return (
    <section className="glass rounded-2xl p-5 mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-orange">{t("Organization", "Organisation")}</div>
          <h2 className="text-base font-medium">{greeting} · {ov.org.name}</h2>
        </div>
        <div className="text-[0.78rem] text-muted text-right">
          <div>
            {t("Enterprise license", "Enterprise-Lizenz")} · {t(`${wsUsed} of ${ov.org.workspace_limit} workspaces in use`, `${wsUsed} von ${ov.org.workspace_limit} Arbeitsbereichen belegt`)} · {t(`${ov.users} of ${ov.org.user_limit} users in use`, `${ov.users} von ${ov.org.user_limit} Benutzern belegt`)}
          </div>
          {ov.org.term_end && (
            <div className={expired ? "text-danger" : ""} suppressHydrationWarning>
              {expired ? t("License term ended", "Lizenzlaufzeit beendet") : t("License runs until", "Lizenz läuft bis")} {new Date(ov.org.term_end).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </div>
          )}
        </div>
      </div>
      {expired && <p className="mt-2 text-[0.8rem] text-danger">{t("The license term has ended. Your data is safe; new workspaces are paused until the license is renewed.", "Die Lizenzlaufzeit ist abgelaufen. Ihre Daten sind sicher; neue Arbeitsbereiche sind bis zur Verlängerung pausiert.")}</p>}

      <div className="mt-4 grid gap-2">
        {ov.workspaces.map((w) => (
          <div key={w.id} className={`rounded-xl border border-white/10 px-3 py-2 flex flex-wrap items-center gap-3 ${w.archived ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="text-[0.9rem] font-medium truncate">{w.name}</div>
              <div className="text-[0.7rem] font-mono tracking-wider text-muted/70">
                {t(`${w.members} members`, `${w.members} Mitglieder`)}
                {w.locked && ` · ${t("LOCKED", "GESPERRT")}`}
                {w.archived && ` · ${t("ARCHIVED (still uses a license seat)", "ARCHIVIERT (belegt weiter einen Platz)")}`}
              </div>
            </div>
            {!w.archived && <button disabled={busy} onClick={() => onOpen(w.id, !memberIds.has(w.id))} className={btn}>{t("OPEN", "ÖFFNEN")}</button>}
            <button disabled={busy} onClick={() => run(() => sb.rpc("org_set_archived", { p_workspace: w.id, p_archived: !w.archived }))} className={btn}>
              {w.archived ? t("RESTORE", "WIEDERHERSTELLEN") : t("ARCHIVE", "ARCHIVIEREN")}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("New workspace name", "Name des neuen Arbeitsbereichs")} className={input + " flex-1"} />
        <button disabled={busy || expired || !name.trim() || wsUsed >= ov.org.workspace_limit} onClick={() => run(() => sb.rpc("org_create_workspace", { p_org: ov.org.id, p_name: name }))} className={btn}>
          + {t("ADD WORKSPACE", "ARBEITSBEREICH")}
        </button>
      </div>
      {wsUsed >= ov.org.workspace_limit && <p className="mt-1 text-[0.74rem] text-muted">{t("All workspaces in your license are in use. Delete one or ask us to expand.", "Alle Arbeitsbereiche Ihrer Lizenz sind belegt. Löschen Sie einen oder fragen Sie nach einer Erweiterung.")}</p>}

      <details className="mt-4">
        <summary className="cursor-pointer text-[0.78rem] text-muted hover:text-text">{t(`People (${ov.people.length})`, `Personen (${ov.people.length})`)}</summary>
        <div className="mt-2 grid gap-1 text-[0.82rem]">
          {ov.people.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="flex-1 truncate">{p.email}</span>
              <span className="font-mono text-[0.66rem] tracking-wider text-muted/70">
                {p.org_role ? p.org_role.toUpperCase() : t("MEMBER", "MITGLIED")} · {t(`${p.workspaces} workspaces`, `${p.workspaces} Arbeitsbereiche`)}
              </span>
            </div>
          ))}
        </div>
        {isOwner && (
          <div className="mt-3 flex gap-2">
            <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder={t("Add an admin by email (they need a Loom account)", "Admin per E-Mail hinzufügen (Loom-Konto nötig)")} className={input + " flex-1"} />
            <button disabled={busy || !adminEmail.includes("@")} onClick={() => run(() => sb.rpc("org_add_admin", { p_org: ov.org.id, p_email: adminEmail }))} className={btn}>{t("ADD ADMIN", "ADMIN HINZUFÜGEN")}</button>
          </div>
        )}
      </details>

      {isOwner && (
        <div className="mt-4 border-t border-white/10 pt-3 text-[0.8rem] text-muted flex flex-wrap items-center gap-3">
          <span className="flex-1">
            {t("Processor terms", "Auftragsverarbeitung")}:{" "}
            {acked ? t(`acknowledged (version ${acked.version}, ${new Date(acked.accepted_at).toLocaleDateString()})`, `bestätigt (Version ${acked.version}, ${new Date(acked.accepted_at).toLocaleDateString()})`) : t("not yet acknowledged", "noch nicht bestätigt")}
          </span>
          <button disabled={busy || acked?.version === PROCESSOR_VERSION} onClick={() => run(() => sb.rpc("org_ack_processor", { p_org: ov.org.id, p_version: PROCESSOR_VERSION }))} className={btn}>
            {t("ACKNOWLEDGE", "BESTÄTIGEN")}
          </button>
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-300" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}
