"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { PROCESSOR_VERSION, type OrgView, type OrgWorkspace } from "@/lib/organizations";
import { RedeemBox } from "@/components/organization-section";
import { LegalModal } from "@/components/legal-modal";
import { PRIVACY, PROCESSOR, TERMS } from "@/lib/legal";
import { Tx } from "@/lib/content-i18n";

const btn = "rounded-full border border-white/20 px-3.5 py-1.5 text-[0.68rem] leading-none font-mono tracking-wider hover:border-white/40 disabled:opacity-40 whitespace-nowrap";
const btnPrimary = "rounded-full border border-transparent text-white text-[0.68rem] leading-none font-mono tracking-wider px-4 py-1.5 disabled:opacity-40 whitespace-nowrap";
const gradient = { background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" };
const input = "bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2 outline-none focus:border-orange/60";
const label = "font-mono text-[0.62rem] tracking-[0.14em] uppercase text-muted/80";

type Tab = "workspaces" | "pursuits" | "users" | "roles" | "organization" | "license" | "agreements";

function Bar({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, max ? (used / max) * 100 : 100);
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#f8991d" }} />
    </div>
  );
}

function DeleteConfirm({ ws, onClose }: { ws: OrgWorkspace; onClose: () => void }) {
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
    const sb = createClient();
    const c = await sb.rpc("org_claim_workspace", { p_workspace: ws.id });
    if (c.error) {
      setErr(c.error.message);
      setBusy(false);
      return;
    }
    const r = await fetch("/api/workspace/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: ws.id, keyword: word }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error ?? t("Could not delete the workspace.", "Der Arbeitsbereich konnte nicht gelöscht werden."));
      setBusy(false);
      return;
    }
    window.location.reload();
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="alertdialog" aria-modal="true" className="w-full max-w-md glass glass-bright glass-dense glass-pop rounded-2xl p-6 text-sm">
        <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-danger mb-2">{t("Caution — permanent", "Achtung – endgültig")}</div>
        <h2 className="text-base font-medium mb-2">{t(`Delete “${ws.name}”?`, `„${ws.name}“ löschen?`)}</h2>
        <p className="text-[0.88rem] leading-relaxed text-text/90">{t("This deletes the workspace and everything in it, and frees its license slot. It cannot be undone and nothing can be retrieved afterwards — not by you, not by us. To keep the data, archive it instead.", "Dies löscht den Arbeitsbereich samt Inhalt und gibt den Lizenzplatz frei. Es kann nicht rückgängig gemacht werden; nichts kann danach wiederhergestellt werden – weder von Ihnen noch von uns. Um die Daten zu behalten, archivieren Sie ihn stattdessen.")}</p>
        <label className="block mt-4 text-[0.78rem] text-muted">
          {t("Type DELETE to confirm", "Zur Bestätigung DELETE eingeben")}
          <input autoFocus value={word} onChange={(e) => setWord(e.target.value)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2.5 outline-none focus:border-red-400/60 font-mono tracking-wider" />
        </label>
        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button disabled={busy} onClick={onClose} className={btn}>{t("CANCEL", "ABBRECHEN")}</button>
          <button disabled={busy || word.trim() !== "DELETE"} onClick={go} className="rounded-full border btn-danger px-4 py-1.5 text-[0.7rem] font-mono tracking-wider disabled:opacity-40">{busy ? t("DELETING…", "LÖSCHE…") : t("DELETE FOREVER", "ENDGÜLTIG LÖSCHEN")}</button>
        </div>
      </div>
    </div>
  );
}

export function LoomFloor({ orgs, greeting, memberIds, onOpen, children }: { orgs: OrgView[]; greeting: string; memberIds: Set<string>; onOpen: (id: string, join: boolean) => void; children?: React.ReactNode }) {
  const t = useT();
  const sb = createClient();
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("workspaces");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [delWs, setDelWs] = useState<OrgWorkspace | null>(null);
  const [legal, setLegal] = useState<"privacy" | "terms" | "processor" | null>(null);
  const [newWs, setNewWs] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [editRole, setEditRole] = useState<{ id: string; name: string; title: string; color: string } | null>(null);
  const ov = orgs[Math.min(idx, orgs.length - 1)];
  const [form, setForm] = useState({ name: ov.org.name, contact_name: ov.org.contact_name ?? "", contact_email: ov.org.contact_email ?? "", billing_notes: ov.org.billing_notes ?? "" });
  useEffect(() => setForm({ name: ov.org.name, contact_name: ov.org.contact_name ?? "", contact_email: ov.org.contact_email ?? "", billing_notes: ov.org.billing_notes ?? "" }), [ov.org.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwner = ov.my_role === "owner";
  const expired = !!ov.org.term_end && new Date(ov.org.term_end) < new Date();
  const wsUsed = ov.workspaces.length;
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    if (ok) setMsg({ ok: true, text: ok });
    else window.location.reload();
  }

  const tabs: [Tab, string][] = [
    ["workspaces", t("Workspaces", "Arbeitsbereiche")],
    ["pursuits", t("Pursuits", "Vorhaben")],
    ["users", t("Users", "Benutzer")],
    ["roles", t("Roles", "Rollen")],
    ["organization", t("Organization", "Organisation")],
    ["license", t("License", "Lizenz")],
    ["agreements", t("Agreements", "Vereinbarungen")],
  ];

  return (
    <section className="mb-10">
      <div role="tablist" className="flex flex-wrap items-end gap-x-1 border-b border-white/15 mb-4">
        {tabs.map(([k, name]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => { setTab(k); setMsg(null); }}
            className={`relative -mb-px px-4 pt-2 pb-2 text-[0.78rem] rounded-t-xl border border-b-0 transition-colors ${tab === k ? "bg-white/[0.07] border-white/20 text-orange font-medium pb-[0.6rem] shadow-[0_-2px_0_0_#f8991d_inset]" : "bg-black/20 border-white/10 text-muted hover:text-text hover:bg-white/5"}`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-3">
        <div>
          <div className={label + " !text-orange"}>{t("Organization", "Organisation")}</div>
          <h2 className="text-base font-medium">
            {greeting}
            {orgs.length > 1 ? (
              <select value={idx} onChange={(e) => setIdx(+e.target.value)} className={input + " ml-3 !py-1 text-base"}>
                {orgs.map((o, i) => (
                  <option key={o.org.id} value={i} className="bg-[#0b1020]">{o.org.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-muted font-normal"> · {ov.org.name}</span>
            )}
          </h2>
        </div>
      </div>

      {msg && <p className={`mb-3 text-xs ${msg.ok ? "text-emerald-300" : "text-danger"}`}>{msg.text}</p>}
      {expired && tab !== "license" && <p className="mb-3 text-[0.8rem] text-danger">{t("The license term has ended. Your data is safe; new workspaces are paused until the license is renewed.", "Die Lizenzlaufzeit ist abgelaufen. Ihre Daten sind sicher; neue Arbeitsbereiche sind bis zur Verlängerung pausiert.")}</p>}

      {tab === "workspaces" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {ov.workspaces.map((w) => (
              <div key={w.id} className={`glass rounded-2xl p-5 flex flex-col gap-3 ${w.archived ? "opacity-70" : ""}`}>
                <div>
                  <div className="text-[0.95rem] font-medium truncate"><Tx text={w.name} /></div>
                  <div className="text-[0.66rem] font-mono tracking-wider text-muted/70 mt-0.5 flex flex-wrap gap-x-3">
                    {w.locked && <span className="text-orange">{t("LOCKED", "GESPERRT")}</span>}
                    {w.archived && <span>{t("ARCHIVED · still uses a license slot", "ARCHIVIERT · belegt weiter einen Lizenzplatz")}</span>}
                    {!w.locked && !w.archived && <span>{t("ACTIVE", "AKTIV")}</span>}
                  </div>
                </div>
                {w.description && <p className="text-[0.82rem] text-muted leading-snug line-clamp-3 whitespace-pre-line"><Tx text={w.description} /></p>}
                {w.goal && (
                  <div>
                    <div className={label}>{t("Goal", "Ziel")}</div>
                    <p className="text-[0.82rem] text-text/90 leading-snug line-clamp-2 whitespace-pre-line"><Tx text={w.goal} /></p>
                  </div>
                )}
                <div>
                  <div className={label}>{t(`Processes (${w.processes.length})`, `Prozesse (${w.processes.length})`)}</div>
                  <p className="text-[0.82rem] text-text/90 leading-snug">
                    {w.processes.length === 0 ? "—" : (
                      <>
                        {w.processes.slice(0, 4).map((p, i) => (
                          <span key={i}>{i > 0 && " · "}<Tx text={p} /></span>
                        ))}
                        {w.processes.length > 4 && ` · +${w.processes.length - 4}`}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.76rem] text-muted">
                  <span>{t(`${w.members} members`, `${w.members} Mitglieder`)}</span>
                  <span>{t(`${w.pursuits} pursuits in play`, `${w.pursuits} Vorhaben aktiv`)}</span>
                  <span suppressHydrationWarning>{t("Edited", "Bearbeitet")} {fmt(w.last_edited)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                  {!w.archived && <button disabled={busy} onClick={() => onOpen(w.id, !memberIds.has(w.id))} className={btnPrimary} style={gradient}>{t("OPEN", "ÖFFNEN")}</button>}
                  <button disabled={busy} onClick={() => run(() => sb.rpc("org_set_archived", { p_workspace: w.id, p_archived: !w.archived }))} className={btn}>
                    {w.archived ? t("RESTORE", "WIEDERHERSTELLEN") : t("ARCHIVE", "ARCHIVIEREN")}
                  </button>
                  {isOwner && <button disabled={busy} onClick={() => setDelWs(w)} className="rounded-full border btn-danger px-3.5 py-1.5 text-[0.68rem] leading-none font-mono tracking-wider ml-auto">{t("DELETE", "LÖSCHEN")}</button>}
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-white/15 p-5 flex flex-col justify-center gap-2">
              <div className={label}>{t("New workspace", "Neuer Arbeitsbereich")}</div>
              <input value={newWs} onChange={(e) => setNewWs(e.target.value)} placeholder={t("Workspace name", "Name des Arbeitsbereichs")} className={input} />
              <button disabled={busy || expired || !newWs.trim() || wsUsed >= ov.org.workspace_limit} onClick={() => run(() => sb.rpc("org_create_workspace", { p_org: ov.org.id, p_name: newWs }))} className={btnPrimary + " self-start"} style={gradient}>
                + {t("ADD WORKSPACE", "ARBEITSBEREICH HINZUFÜGEN")}
              </button>
              {wsUsed >= ov.org.workspace_limit && <p className="text-[0.74rem] text-muted">{t("All workspaces in your license are in use. Delete one or ask us to expand.", "Alle Arbeitsbereiche Ihrer Lizenz sind belegt. Löschen Sie einen oder fragen Sie nach einer Erweiterung.")}</p>}
            </div>
          </div>
          {children}
        </>
      )}

      {tab === "pursuits" && (
        <div className="grid gap-2">
          {ov.pursuits.length === 0 && <p className="text-muted text-sm">{t("No pursuits in play yet. They appear here when someone presses Pursue on a signal, question, finding or idea.", "Noch keine aktiven Vorhaben. Sie erscheinen hier, sobald jemand bei einem Signal, einer Frage, einem Befund oder einer Idee „Verfolgen“ wählt.")}</p>}
          {ov.pursuits.map((p) => (
            <div key={p.id} className="glass rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-[0.62rem] tracking-wider uppercase text-orange">{p.kind}</span>
                <span className="text-[0.9rem] flex-1 min-w-0">{p.headline ? <Tx text={p.headline} /> : "—"}</span>
                <span className="text-[0.72rem] text-muted" suppressHydrationWarning>{fmt(p.pursued_at)}</span>
              </div>
              <div className="text-[0.74rem] text-muted mt-0.5"><Tx text={p.workspace} /> › <Tx text={p.process} /></div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <>
          <div className="glass rounded-2xl divide-y divide-white/10">
            {ov.people.map((p) => (
              <div key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${p.deactivated ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.9rem] truncate">{p.email}</div>
                  <div className="text-[0.68rem] font-mono tracking-wider text-muted/70">
                    {p.org_role ? p.org_role.toUpperCase() : t("MEMBER", "MITGLIED")} · {t(`${p.workspaces} workspaces`, `${p.workspaces} Arbeitsbereiche`)} · {p.deactivated ? t("DEACTIVATED", "DEAKTIVIERT") : t("ACTIVE", "AKTIV")}
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => run(() => sb.rpc("org_set_user_active", { p_org: ov.org.id, p_user: p.id, p_active: p.deactivated }))}
                  className={btn}
                  title={p.deactivated ? t("Give access back (uses a user seat)", "Zugang wiederherstellen (belegt einen Benutzerplatz)") : t("Block access, keep everything they created, free the seat", "Zugang sperren, alles Erstellte behalten, Platz freigeben")}
                >
                  {p.deactivated ? t("REACTIVATE", "REAKTIVIEREN") : t("DEACTIVATE", "DEAKTIVIEREN")}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.74rem] text-muted">{t("Deactivated people can't open your workspaces and don't count toward your user limit. Everything they authored stays.", "Deaktivierte Personen können Ihre Arbeitsbereiche nicht öffnen und zählen nicht zum Benutzerlimit. Alles, was sie erstellt haben, bleibt erhalten.")}</p>
          {isOwner && (
            <div className="mt-4 flex gap-2">
              <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder={t("Add an admin by email (they need a Loom account)", "Admin per E-Mail hinzufügen (Loom-Konto nötig)")} className={input + " flex-1"} />
              <button disabled={busy || !adminEmail.includes("@")} onClick={() => run(() => sb.rpc("org_add_admin", { p_org: ov.org.id, p_email: adminEmail }))} className={btn}>{t("ADD ADMIN", "ADMIN HINZUFÜGEN")}</button>
            </div>
          )}
        </>
      )}

      {tab === "roles" && (
        <>
          <p className="mb-3 text-[0.8rem] text-muted">{t("Roles are shared across your organization. For now each workspace keeps its own list; one shared list is coming. Members can add roles; owners and admins edit them.", "Rollen gelten organisationsweit. Vorerst führt jeder Arbeitsbereich eine eigene Liste; eine gemeinsame Liste folgt. Mitglieder können Rollen hinzufügen; Eigentümer und Admins bearbeiten sie.")}</p>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1.5rem_1.2fr_1.2fr_1fr_5rem_5.5rem] items-center gap-3 px-4 py-2 border-b border-white/15 bg-white/[0.04] font-mono text-[0.62rem] tracking-[0.14em] uppercase text-muted/80">
              <span />
              <span>{t("Role", "Rolle")}</span>
              <span>{t("Title / function", "Titel / Funktion")}</span>
              <span>{t("Workspace", "Arbeitsbereich")}</span>
              <span className="text-right">{t("Steps", "Schritte")}</span>
              <span />
            </div>
            {ov.roles.length === 0 && <p className="p-4 text-sm text-muted">{t("No roles yet.", "Noch keine Rollen.")}</p>}
            {ov.roles.map((r) =>
              editRole?.id === r.id ? (
                <div key={r.id} className="grid grid-cols-[1.5rem_1.2fr_1.2fr_1fr_5rem_5.5rem] items-center gap-3 px-4 py-2 border-b border-white/10 last:border-0 bg-white/[0.03]">
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(editRole.color) ? editRole.color : "#888888"} onChange={(e) => setEditRole({ ...editRole, color: e.target.value })} className="w-5 h-5 rounded-full bg-transparent border-0 p-0 cursor-pointer" aria-label={t("Color", "Farbe")} />
                  <input value={editRole.name} onChange={(e) => setEditRole({ ...editRole, name: e.target.value })} className={input + " !py-1.5 !text-[0.84rem]"} />
                  <input value={editRole.title} onChange={(e) => setEditRole({ ...editRole, title: e.target.value })} className={input + " !py-1.5 !text-[0.84rem]"} />
                  <span className="text-[0.78rem] text-muted truncate"><Tx text={r.workspace} /></span>
                  <span className="text-[0.78rem] text-muted text-right">{r.steps}</span>
                  <span className="flex gap-1.5 justify-end">
                    <button disabled={busy || !editRole.name.trim()} onClick={() => run(() => sb.rpc("org_update_role", { p_actor: r.id, p_name: editRole.name, p_role: editRole.title, p_color: editRole.color }))} className={btnPrimary} style={gradient}>{t("SAVE", "SPEICHERN")}</button>
                    <button onClick={() => setEditRole(null)} className={btn}>✕</button>
                  </span>
                </div>
              ) : (
                <div key={r.id} className="grid grid-cols-[1.5rem_1.2fr_1.2fr_1fr_5rem_5.5rem] items-center gap-3 px-4 py-2.5 border-b border-white/10 last:border-0">
                  <span className="w-3 h-3 rounded-full" style={{ background: r.color || "#888" }} />
                  <span className="text-[0.88rem] truncate"><Tx text={r.name} /></span>
                  <span className="text-[0.82rem] text-muted truncate">{r.role ? <Tx text={r.role} /> : "—"}</span>
                  <span className="text-[0.78rem] text-muted truncate"><Tx text={r.workspace} /></span>
                  <span className="text-[0.78rem] text-muted text-right">{r.steps}</span>
                  <span className="text-right"><button onClick={() => setEditRole({ id: r.id, name: r.name, title: r.role ?? "", color: r.color ?? "#888888" })} className={btn}>{t("EDIT", "BEARBEITEN")}</button></span>
                </div>
              )
            )}
          </div>
        </>
      )}

      {tab === "organization" && (
        <div className="glass rounded-2xl p-5 grid gap-3 max-w-xl">
          <label className="text-[0.78rem] text-muted">{t("Organization name", "Name der Organisation")}<input disabled={!isOwner} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input + " w-full mt-1"} /></label>
          <label className="text-[0.78rem] text-muted">{t("Contact person", "Ansprechperson")}<input disabled={!isOwner} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={input + " w-full mt-1"} /></label>
          <label className="text-[0.78rem] text-muted">{t("Contact email", "Kontakt-E-Mail")}<input disabled={!isOwner} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className={input + " w-full mt-1"} /></label>
          <label className="text-[0.78rem] text-muted">{t("Billing notes", "Abrechnungshinweise")}<textarea disabled={!isOwner} rows={3} value={form.billing_notes} onChange={(e) => setForm({ ...form, billing_notes: e.target.value })} className={input + " w-full mt-1 resize-none"} /></label>
          {isOwner ? (
            <button disabled={busy || !form.name.trim()} onClick={() => run(() => sb.from("organizations").update({ name: form.name.trim(), contact_name: form.contact_name || null, contact_email: form.contact_email || null, billing_notes: form.billing_notes || null }).eq("id", ov.org.id) as any)} className={btnPrimary + " self-start"} style={gradient}>{t("SAVE", "SPEICHERN")}</button>
          ) : (
            <p className="text-[0.74rem] text-muted">{t("Only owners can change these.", "Nur Eigentümer können dies ändern.")}</p>
          )}
          <div className="border-t border-white/10 pt-3 grid gap-2 text-[0.8rem] text-muted">
            <div>{t("Billing address, logo upload", "Rechnungsadresse, Logo-Upload")} — <span className="text-muted/70">{t("coming soon", "demnächst")}</span></div>
            <div>{t("AI Gas Tank", "KI-Tank")}: <span className="text-text">{ov.org.ai_credits.toLocaleString()}</span> {t("credits", "Credits")} — <span className="text-muted/70">{t("metering coming soon", "Messung demnächst")}</span></div>
          </div>
        </div>
      )}

      {tab === "license" && (
        <div className="grid gap-4 max-w-xl">
          <div className="glass rounded-2xl p-5 grid gap-4">
            <div>
              <div className="flex justify-between text-[0.82rem] mb-1"><span>{t("Workspaces", "Arbeitsbereiche")}</span><span>{wsUsed} / {ov.org.workspace_limit}</span></div>
              <Bar used={wsUsed} max={ov.org.workspace_limit} />
            </div>
            <div>
              <div className="flex justify-between text-[0.82rem] mb-1"><span>{t("Users", "Benutzer")}</span><span>{ov.users} / {ov.org.user_limit}</span></div>
              <Bar used={ov.users} max={ov.org.user_limit} />
            </div>
            <div className="text-[0.82rem] text-muted" suppressHydrationWarning>
              {t("Term", "Laufzeit")}: {fmt(ov.org.term_start)} → <span className={expired ? "text-danger" : ""}>{fmt(ov.org.term_end)}</span>
              {expired && ` · ${t("ended", "beendet")}`}
            </div>
            <p className="text-[0.76rem] text-muted">{t("Need more workspaces or users, or a renewal? Write to ron@struinova.com.", "Mehr Arbeitsbereiche oder Benutzer, oder eine Verlängerung? Schreiben Sie an ron@struinova.com.")}</p>
          </div>
          <RedeemBox />
        </div>
      )}

      {tab === "agreements" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="glass rounded-2xl p-5 flex flex-col gap-3 sm:col-span-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[14rem]">
                <div className="text-[0.95rem] font-medium">{t("Processor terms", "Auftragsverarbeitung")}</div>
                <p className="text-[0.82rem] text-muted mt-0.5">{t("How Struinova handles your organization's data on your behalf. The owner acknowledges the current version once; we keep the version and date on record.", "Wie Struinova die Daten Ihrer Organisation in Ihrem Auftrag verarbeitet. Der Eigentümer bestätigt die aktuelle Version einmal; Version und Datum werden festgehalten.")}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[0.66rem] font-mono tracking-wider ${ov.acks[0]?.version === PROCESSOR_VERSION ? "border-emerald-400/40 text-emerald-300 bg-emerald-500/10" : "border-orange/50 text-orange bg-orange/10"}`}>
                {ov.acks[0]?.version === PROCESSOR_VERSION ? t("ACKNOWLEDGED", "BESTÄTIGT") : ov.acks[0] ? t("NEW VERSION TO ACKNOWLEDGE", "NEUE VERSION ZU BESTÄTIGEN") : t("NOT YET ACKNOWLEDGED", "NOCH NICHT BESTÄTIGT")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setLegal("processor")} className={btn}>{t("READ", "LESEN")}</button>
              {isOwner && (
                <button disabled={busy || ov.acks[0]?.version === PROCESSOR_VERSION} onClick={() => run(() => sb.rpc("org_ack_processor", { p_org: ov.org.id, p_version: PROCESSOR_VERSION }))} className={btnPrimary} style={gradient}>
                  {t("ACKNOWLEDGE", "BESTÄTIGEN")}
                </button>
              )}
              {!isOwner && <span className="text-[0.74rem] text-muted">{t("Only owners can acknowledge.", "Nur Eigentümer können bestätigen.")}</span>}
            </div>
            {ov.acks.length > 0 && (
              <div className="border-t border-white/10 pt-3">
                <div className={label + " mb-1.5"}>{t("Acknowledgement history", "Bestätigungsverlauf")}</div>
                <div className="grid gap-1 text-[0.8rem]">
                  {ov.acks.map((a, i) => (
                    <div key={i} className="flex gap-4 text-muted">
                      <span className="font-mono text-text/90 w-20">{a.version}</span>
                      <span suppressHydrationWarning>{fmt(a.accepted_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {([
            ["privacy", t("Privacy notice", "Datenschutzhinweis"), t("What personal data Loom collects, why, and your rights.", "Welche personenbezogenen Daten Loom erhebt, warum, und Ihre Rechte.")],
            ["terms", t("Terms of use", "Nutzungsbedingungen"), t("The rules for using Loom.", "Die Regeln für die Nutzung von Loom.")],
          ] as const).map(([k, title, blurb]) => (
            <div key={k} className="glass rounded-2xl p-5 flex flex-col gap-2 sm:col-span-1">
              <div className="text-[0.92rem] font-medium">{title}</div>
              <p className="text-[0.8rem] text-muted flex-1">{blurb}</p>
              <button type="button" onClick={() => setLegal(k)} className={btn + " self-start"}>{t("READ", "LESEN")}</button>
            </div>
          ))}
        </div>
      )}

      {delWs && <DeleteConfirm ws={delWs} onClose={() => setDelWs(null)} />}
      {legal && <LegalModal doc={legal === "privacy" ? PRIVACY : legal === "terms" ? TERMS : PROCESSOR} slug={legal} onClose={() => setLegal(null)} />}
    </section>
  );
}
