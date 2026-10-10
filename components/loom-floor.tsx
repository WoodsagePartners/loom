"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { AGREEMENT_VERSION, type OrgAck, type OrgView, type OrgWorkspace } from "@/lib/organizations";
import { RedeemBox } from "@/components/organization-section";
import { LegalModal } from "@/components/legal-modal";
import { PRIVACY, PROCESSOR, TERMS } from "@/lib/legal";
import { Tx } from "@/lib/content-i18n";
import { ADMIN_CARDS, GENERAL_CARDS, GuideDeck } from "@/components/guide";
import { ACTOR_KINDS, ROLE_PALETTE } from "@/lib/flow";
import { ShapeIcon } from "@/components/flow/shapes";
import { THEME } from "@/lib/colors";

const btn = "rounded-full border border-white/20 px-3.5 py-1.5 text-label leading-none font-mono tracking-wider hover:border-white/40 disabled:opacity-40 whitespace-nowrap";
const btnPrimary = "rounded-full border border-transparent text-white text-label leading-none font-mono tracking-wider px-4 py-1.5 disabled:opacity-40 whitespace-nowrap";
const gradient = { background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" };
const input = "bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2 outline-none focus:border-orange/60";
const label = "font-mono text-micro tracking-[0.14em] uppercase text-muted/80";

type Tab = "workspaces" | "pursuits" | "users" | "roles" | "organization" | "license" | "agreements";

function Bar({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, max ? (used / max) * 100 : 100);
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : THEME.orange }} />
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
        <div className="font-mono text-label tracking-[0.14em] uppercase text-danger mb-2">{t("Caution — permanent", "Achtung – endgültig")}</div>
        <h2 className="text-base font-medium mb-2">{t(`Delete “${ws.name}”?`, `„${ws.name}“ löschen?`)}</h2>
        <p className="text-body leading-relaxed text-text/90">{t("This deletes the workspace and everything in it, and frees its license slot. It cannot be undone and nothing can be retrieved afterwards — not by you, not by us. To keep the data, archive it instead.", "Dies löscht den Arbeitsbereich samt Inhalt und gibt den Lizenzplatz frei. Es kann nicht rückgängig gemacht werden; nichts kann danach wiederhergestellt werden – weder von Ihnen noch von uns. Um die Daten zu behalten, archivieren Sie ihn stattdessen.")}</p>
        <label className="block mt-4 text-small text-muted">
          {t("Type DELETE to confirm", "Zur Bestätigung DELETE eingeben")}
          <input autoFocus value={word} onChange={(e) => setWord(e.target.value)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2.5 outline-none focus:border-red-400/60 font-mono tracking-wider" />
        </label>
        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button disabled={busy} onClick={onClose} className={btn}>{t("CANCEL", "ABBRECHEN")}</button>
          <button disabled={busy || word.trim() !== "DELETE"} onClick={go} className="rounded-full border btn-danger px-4 py-1.5 text-label font-mono tracking-wider disabled:opacity-40">{busy ? t("DELETING…", "LÖSCHE…") : t("DELETE FOREVER", "ENDGÜLTIG LÖSCHEN")}</button>
        </div>
      </div>
    </div>
  );
}

type RoleDraft = { scope: "ent" | "ws"; id: string; name: string; title: string; kind: string; color: string };

function RoleEditor({ draft, onChange, onSave, onCancel, onDelete, busy }: { draft: RoleDraft; onChange: (d: RoleDraft) => void; onSave: () => void; onCancel: () => void; onDelete?: () => void; busy: boolean }) {
  const t = useT();
  return (
    <div className="px-4 py-3 border-b border-white/10 bg-white/[0.04] grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder={t("Role name", "Rollenname")} className={input} autoFocus />
        <input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} placeholder={t("Title / function (optional)", "Titel / Funktion (optional)")} className={input} />
      </div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        <div>
          <div className={label + " mb-1.5"}>{t("Role type", "Rollentyp")}</div>
          <div className="grid grid-cols-5 gap-1.5 w-[15rem]">
            {ACTOR_KINDS.map((k) => (
              <button key={k.key} type="button" title={`${t(k.en, k.de)} — ${t(k.hint, k.hintDe)}`} onClick={() => onChange({ ...draft, kind: k.key })} className={`rounded-md border py-1.5 flex justify-center ${draft.kind === k.key ? "border-orange/70 bg-orange/10" : "border-white/10"}`}>
                <ShapeIcon kind={k.key} color={draft.kind === k.key ? THEME.orange : THEME.slate} size={24} />
              </button>
            ))}
          </div>
          <div className="text-caption text-muted mt-1">{(() => { const k = ACTOR_KINDS.find((x) => x.key === draft.kind) ?? ACTOR_KINDS[0]; return `${t(k.en, k.de)} — ${t(k.hint, k.hintDe)}`; })()}</div>
        </div>
        <div>
          <div className={label + " mb-1.5"}>{t("Color", "Farbe")}</div>
          <div className="flex flex-nowrap gap-1.5 pt-1.5">
            {ROLE_PALETTE.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => onChange({ ...draft, color: c })} className="w-3.5 h-3.5 flex-none rounded-full border transition-all hover:opacity-100 hover:scale-110" style={{ background: c, opacity: draft.color === c ? 1 : 0.5, filter: "saturate(.8)", borderColor: draft.color === c ? "rgba(255,255,255,.85)" : "transparent" }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy || !draft.name.trim()} onClick={onSave} className={btnPrimary} style={gradient}>{t("SAVE", "SPEICHERN")}</button>
        <button type="button" onClick={onCancel} className={btn}>{t("CANCEL", "ABBRECHEN")}</button>
        {onDelete && <button type="button" disabled={busy} onClick={onDelete} className="rounded-full border btn-danger px-3.5 py-1.5 text-label leading-none font-mono tracking-wider ml-auto">{t("DELETE", "LÖSCHEN")}</button>}
      </div>
    </div>
  );
}

const ROLE_GRID = "grid grid-cols-[1.75rem_1.2fr_1.2fr_1fr_4.5rem_5.5rem] items-center gap-3";

export function LoomFloor({ orgs, greeting, memberIds, onOpen, children }: { orgs: OrgView[]; greeting: string; memberIds: Set<string>; onOpen: (id: string, join: boolean, to?: string) => void; children?: React.ReactNode }) {
  const t = useT();
  const sb = createClient();
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [tabState, setTab] = useState<Tab>("workspaces");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [delWs, setDelWs] = useState<OrgWorkspace | null>(null);
  const [legal, setLegal] = useState<"privacy" | "terms" | "processor" | null>(null);
  const [newWs, setNewWs] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [editRole, setEditRole] = useState<RoleDraft | null>(null);
  const [rolesOpen, setRolesOpen] = useState(true);
  const [entOpen, setEntOpen] = useState(true);
  const [wsOpen, setWsOpen] = useState(true);
  const ov = orgs[Math.min(idx, orgs.length - 1)];
  const [form, setForm] = useState({ name: ov.org.name, contact_name: ov.org.contact_name ?? "", contact_email: ov.org.contact_email ?? "", billing_notes: ov.org.billing_notes ?? "" });
  useEffect(() => setForm({ name: ov.org.name, contact_name: ov.org.contact_name ?? "", contact_email: ov.org.contact_email ?? "", billing_notes: ov.org.billing_notes ?? "" }), [ov.org.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwner = ov.my_role === "owner";
  // Same rule as the database: the term has ended once its end date is before today.
  const expired = !!ov.org.term_end && ov.org.term_end.slice(0, 10) < new Date().toISOString().slice(0, 10);
  const tab: Tab = expired ? "license" : tabState;
  const wsUsed = ov.workspaces.length;
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

  // Runs a database action, then refreshes the page data in place (so the tab and any open form stay where they are).
  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string, after?: () => void) {
    setBusy(true);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    after?.();
    if (ok) setMsg({ ok: true, text: ok });
    router.refresh();
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
      <div role="tablist" className="flex flex-wrap items-end gap-x-1 border-b border-white/30 mb-4">
        {tabs.map(([k, name]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            disabled={expired && k !== "license"}
            onClick={() => { setTab(k); setMsg(null); }}
            className={`${expired && k !== "license" ? "opacity-35 cursor-not-allowed " : ""}relative -mb-px px-4 pt-2 pb-2 text-small rounded-t-xl border border-b-0 transition-colors ${tab === k ? "bg-orange/15 border-orange/50 text-orange font-semibold pb-[0.6rem] shadow-[0_-3px_0_0_#f8991d_inset]" : "bg-white/[0.08] border-white/25 text-text/85 hover:text-text hover:bg-white/[0.14]"}`}
          >
            {name}
          </button>
        ))}
      </div>
      {expired && (
        <div className="mb-4 rounded-2xl border btn-danger px-4 py-3 text-small">
          <b>{t("Your license term ended", "Ihre Lizenzlaufzeit ist abgelaufen")} {fmt(ov.org.term_end)}.</b>{" "}
          {t("Access to workspaces and management is paused until the license is renewed. Nothing has been deleted.", "Der Zugang zu Arbeitsbereichen und zur Verwaltung ist bis zur Verlängerung pausiert. Es wurde nichts gelöscht.")}{" "}
          <a className="underline" href="mailto:ron@struinova.com?subject=Loom%20license%20renewal">{t("Contact Struinova to renew", "Struinova zur Verlängerung kontaktieren")}</a>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-3">
        <div>
          <div className={label + " !text-orange"}>{t("Organization", "Organisation")}</div>
          <h2 className="text-base font-medium">
            {greeting}
            {orgs.length > 1 ? (
              <select value={idx} onChange={(e) => setIdx(+e.target.value)} className={input + " ml-3 !py-1 text-base"}>
                {orgs.map((o, i) => (
                  <option key={o.org.id} value={i} className="bg-panel">{o.org.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-muted font-normal"> · {ov.org.name}</span>
            )}
          </h2>
        </div>
      </div>

      {msg && <p className={`mb-3 text-xs ${msg.ok ? "text-emerald-300" : "text-danger"}`}>{msg.text}</p>}
      {expired && tab !== "license" && <p className="mb-3 text-small text-danger">{t("The license term has ended. Your data is safe; new workspaces are paused until the license is renewed.", "Die Lizenzlaufzeit ist abgelaufen. Ihre Daten sind sicher; neue Arbeitsbereiche sind bis zur Verlängerung pausiert.")}</p>}

      {tab === "workspaces" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {ov.workspaces.map((w) => (
              <div key={w.id} className={`glass rounded-2xl p-5 flex flex-col gap-3 ${w.archived ? "opacity-70" : ""}`}>
                <div>
                  <div className="text-lead font-medium truncate"><Tx text={w.name} /></div>
                  <div className="text-label font-mono tracking-wider text-muted/70 mt-0.5 flex flex-wrap gap-x-3">
                    {w.locked && <span className="text-orange">{t("LOCKED", "GESPERRT")}</span>}
                    {w.archived && <span>{t("ARCHIVED · still uses a license slot", "ARCHIVIERT · belegt weiter einen Lizenzplatz")}</span>}
                    {!w.locked && !w.archived && <span>{t("ACTIVE", "AKTIV")}</span>}
                  </div>
                </div>
                {w.description && <p className="text-small text-muted leading-snug line-clamp-3 whitespace-pre-line"><Tx text={w.description} /></p>}
                {w.goal && (
                  <div>
                    <div className={label}>{t("Goal", "Ziel")}</div>
                    <p className="text-small text-text/90 leading-snug line-clamp-2 whitespace-pre-line"><Tx text={w.goal} /></p>
                  </div>
                )}
                <div>
                  <div className={label}>{t(`Processes (${w.processes.length})`, `Prozesse (${w.processes.length})`)}</div>
                  <p className="text-small text-text/90 leading-snug">
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
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted">
                  <span>{t(`${w.members} members`, `${w.members} Mitglieder`)}</span>
                  <span>{t(`${w.pursuits} pursuits in play`, `${w.pursuits} Vorhaben aktiv`)}</span>
                  <span suppressHydrationWarning>{t("Edited", "Bearbeitet")} {fmt(w.last_edited)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                  {!w.archived && <button disabled={busy} onClick={() => onOpen(w.id, !memberIds.has(w.id))} className={btnPrimary} style={gradient}>{t("OPEN", "ÖFFNEN")}</button>}
                  {!w.archived && (
                    <button disabled={busy} onClick={() => run(() => sb.rpc("org_set_locked", { p_workspace: w.id, p_locked: !w.locked }))} className={btn} title={w.locked ? t("Unlock: people can edit again", "Entsperren: Bearbeiten wieder möglich") : t("Lock: view only until unlocked", "Sperren: nur Ansicht, bis entsperrt")}>
                      {w.locked ? t("UNLOCK", "ENTSPERREN") : t("LOCK", "SPERREN")}
                    </button>
                  )}
                  <button disabled={busy} onClick={() => run(() => sb.rpc("org_set_archived", { p_workspace: w.id, p_archived: !w.archived }))} className={btn}>
                    {w.archived ? t("RESTORE", "WIEDERHERSTELLEN") : t("ARCHIVE", "ARCHIVIEREN")}
                  </button>
                  {isOwner && <button disabled={busy} onClick={() => setDelWs(w)} className="rounded-full border btn-danger px-3.5 py-1.5 text-label leading-none font-mono tracking-wider ml-auto">{t("DELETE", "LÖSCHEN")}</button>}
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-white/15 p-5 flex flex-col justify-center gap-2">
              <div className={label}>{t("New workspace", "Neuer Arbeitsbereich")}</div>
              <input value={newWs} onChange={(e) => setNewWs(e.target.value)} placeholder={t("Workspace name", "Name des Arbeitsbereichs")} className={input} />
              <button disabled={busy || expired || !newWs.trim() || wsUsed >= ov.org.workspace_limit} onClick={() => run(() => sb.rpc("org_create_workspace", { p_org: ov.org.id, p_name: newWs }))} className={btnPrimary + " self-start"} style={gradient}>
                + {t("ADD WORKSPACE", "ARBEITSBEREICH HINZUFÜGEN")}
              </button>
              {wsUsed >= ov.org.workspace_limit && <p className="text-caption text-muted">{t("All workspaces in your license are in use. Delete one or ask us to expand.", "Alle Arbeitsbereiche Ihrer Lizenz sind belegt. Löschen Sie einen oder fragen Sie nach einer Erweiterung.")}</p>}
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
                <span className="font-mono text-micro tracking-wider uppercase text-orange">{p.kind}</span>
                <span className="text-lead flex-1 min-w-0">{p.headline ? <Tx text={p.headline} /> : "—"}</span>
                <span className="text-caption text-muted" suppressHydrationWarning>{fmt(p.pursued_at)}</span>
                <button disabled={busy} onClick={() => onOpen(p.workspace_id, !memberIds.has(p.workspace_id), `/dashboard?wf=${p.workflow_id}&pin=${p.id}`)} className={btn} title={t("Open the workspace and jump straight to this pursuit", "Arbeitsbereich öffnen und direkt zu diesem Vorhaben springen")}>{t("TAKE ME THERE", "DORTHIN")}</button>
              </div>
              <div className="text-caption text-muted mt-0.5"><Tx text={p.workspace} /> › <Tx text={p.process} /></div>
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
                  <div className="text-lead truncate">{p.email}</div>
                  <div className="text-label font-mono tracking-wider text-muted/70">
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
                {confirmRemove === p.id ? (
                  <>
                    <span className="text-caption text-muted">{t("Remove from every workspace? What they created stays.", "Aus allen Arbeitsbereichen entfernen? Ihre Inhalte bleiben.")}</span>
                    <button disabled={busy} onClick={() => run(() => sb.rpc("org_remove_user", { p_org: ov.org.id, p_user: p.id }), t("User removed.", "Benutzer entfernt."), () => setConfirmRemove(null))} className="rounded-full border btn-danger px-3.5 py-1.5 text-label leading-none font-mono tracking-wider">{t("YES, REMOVE", "JA, ENTFERNEN")}</button>
                    <button onClick={() => setConfirmRemove(null)} className={btn}>{t("CANCEL", "ABBRECHEN")}</button>
                  </>
                ) : (
                  <button disabled={busy} onClick={() => setConfirmRemove(p.id)} className="rounded-full border btn-danger px-3.5 py-1.5 text-label leading-none font-mono tracking-wider" title={t("Remove this person from the organization and all its workspaces", "Person aus der Organisation und allen Arbeitsbereichen entfernen")}>{t("REMOVE", "ENTFERNEN")}</button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-caption text-muted">{t("Deactivated people can't open your workspaces and don't count toward your user limit. Everything they authored stays.", "Deaktivierte Personen können Ihre Arbeitsbereiche nicht öffnen und zählen nicht zum Benutzerlimit. Alles, was sie erstellt haben, bleibt erhalten.")}</p>
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
          <p className="mb-3 text-small text-muted">{t("Enterprise roles apply to every workspace in your organization: people can't change them, only their color. Each workspace can also add roles of its own.", "Enterprise-Rollen gelten für jeden Arbeitsbereich Ihrer Organisation: Sie können nicht geändert werden, nur ihre Farbe. Jeder Arbeitsbereich kann zusätzlich eigene Rollen anlegen.")}</p>
          <button onClick={() => setRolesOpen(!rolesOpen)} className="mb-2 flex items-center gap-2 font-mono text-label tracking-[0.14em] uppercase text-muted hover:text-text">
            <span>{rolesOpen ? "▾" : "▸"}</span>{t("Roles", "Rollen")} ({ov.roles.enterprise.length + ov.roles.workspace.length})
          </button>
          {rolesOpen && <div className="glass rounded-2xl overflow-hidden">
            <div className={`${ROLE_GRID} px-4 py-2 border-b border-white/15 bg-white/[0.04] font-mono text-micro tracking-[0.14em] uppercase text-muted/80`}>
              <span />
              <span>{t("Role", "Rolle")}</span>
              <span>{t("Title / function", "Titel / Funktion")}</span>
              <span>{t("Workspace", "Arbeitsbereich")}</span>
              <span className="text-right">{t("Steps", "Schritte")}</span>
              <span />
            </div>
            <div className="px-4 py-1.5 bg-orange/10 text-orange font-mono text-micro tracking-[0.14em] uppercase flex items-center">
              <button onClick={() => setEntOpen(!entOpen)} className="flex-1 text-left flex items-center gap-2"><span>{entOpen ? "▾" : "▸"}</span>{t("Enterprise roles — all workspaces", "Enterprise-Rollen – alle Arbeitsbereiche")} ({ov.roles.enterprise.length})</button>
              <button onClick={() => { setEntOpen(true); setEditRole({ scope: "ent", id: "new", name: "", title: "", kind: "team", color: ROLE_PALETTE[0] }); }} className={btn}>+ {t("ADD ENTERPRISE ROLE", "ENTERPRISE-ROLLE")}</button>
            </div>
            {entOpen && <>
            {editRole?.scope === "ent" && editRole.id === "new" && (
              <RoleEditor draft={editRole} onChange={setEditRole} busy={busy} onCancel={() => setEditRole(null)} onSave={() => run(() => sb.rpc("org_add_enterprise_role", { p_org: ov.org.id, p_name: editRole.name, p_role: editRole.title, p_kind: editRole.kind, p_color: editRole.color }), undefined, () => setEditRole(null))} />
            )}
            {ov.roles.enterprise.length === 0 && !(editRole?.scope === "ent" && editRole.id === "new") && <p className="px-4 py-3 text-small text-muted border-b border-white/10">{t("No enterprise roles yet. Every workspace starts empty and adds its own.", "Noch keine Enterprise-Rollen. Jeder Arbeitsbereich beginnt leer und ergänzt eigene.")}</p>}
            {ov.roles.enterprise.map((r) =>
              editRole?.scope === "ent" && editRole.id === r.id ? (
                <RoleEditor key={r.id} draft={editRole} onChange={setEditRole} busy={busy} onCancel={() => setEditRole(null)}
                  onSave={() => run(() => sb.rpc("org_update_enterprise_role", { p_id: r.id, p_name: editRole.name, p_role: editRole.title, p_kind: editRole.kind, p_color: editRole.color }), undefined, () => setEditRole(null))}
                  onDelete={() => run(() => sb.rpc("org_delete_enterprise_role", { p_id: r.id }), undefined, () => setEditRole(null))} />
              ) : (
                <div key={r.id} className={`${ROLE_GRID} px-4 py-2.5 border-b border-white/10`}>
                  <ShapeIcon kind={r.kind as any} color={r.color || "#888"} size={18} />
                  <span className="text-body truncate"><Tx text={r.name} /></span>
                  <span className="text-small text-muted truncate">{r.role ? <Tx text={r.role} /> : "—"}</span>
                  <span className="text-small text-muted truncate">{t("All workspaces", "Alle Arbeitsbereiche")}</span>
                  <span />
                  <span className="text-right"><button onClick={() => setEditRole({ scope: "ent", id: r.id, name: r.name, title: r.role ?? "", kind: r.kind, color: r.color ?? ROLE_PALETTE[0] })} className={btn}>{t("EDIT", "BEARBEITEN")}</button></span>
                </div>
              )
            )}
            </>}
            <button onClick={() => setWsOpen(!wsOpen)} className="w-full text-left px-4 py-1.5 bg-white/[0.06] border-y border-white/20 font-mono text-micro tracking-[0.14em] uppercase text-muted flex items-center gap-2"><span>{wsOpen ? "▾" : "▸"}</span>{t("Roles added by individual workspaces", "Von einzelnen Arbeitsbereichen ergänzte Rollen")} ({ov.roles.workspace.length})</button>
            {wsOpen && <>
            {ov.roles.workspace.length === 0 && <p className="px-4 py-3 text-small text-muted">{t("No workspace roles yet.", "Noch keine Arbeitsbereichs-Rollen.")}</p>}
            {ov.roles.workspace.map((r) =>
              editRole?.scope === "ws" && editRole.id === r.id ? (
                <RoleEditor key={r.id} draft={editRole} onChange={setEditRole} busy={busy} onCancel={() => setEditRole(null)}
                  onSave={() => run(() => sb.rpc("org_update_role_v2", { p_actor: r.id, p_name: editRole.name, p_role: editRole.title, p_kind: editRole.kind, p_color: editRole.color }), undefined, () => setEditRole(null))}
                  onDelete={() => run(() => sb.rpc("org_delete_role", { p_actor: r.id }), undefined, () => setEditRole(null))} />
              ) : (
                <div key={r.id} className={`${ROLE_GRID} px-4 py-2.5 border-b border-white/10 last:border-0`}>
                  <ShapeIcon kind={r.kind as any} color={r.color || "#888"} size={18} />
                  <span className="text-body truncate"><Tx text={r.name} /></span>
                  <span className="text-small text-muted truncate">{r.role ? <Tx text={r.role} /> : "—"}</span>
                  <span className="text-small text-muted truncate"><Tx text={r.workspace} /></span>
                  <span className="text-small text-muted text-right">{r.steps}</span>
                  <span className="text-right"><button onClick={() => setEditRole({ scope: "ws", id: r.id, name: r.name, title: r.role ?? "", kind: r.kind, color: r.color ?? ROLE_PALETTE[0] })} className={btn}>{t("EDIT", "BEARBEITEN")}</button></span>
                </div>
              )
            )}
            </>}
          </div>}
        </>
      )}

      {tab === "organization" && (
        <div className="glass rounded-2xl p-5 grid gap-3 max-w-xl">
          <label className="text-small text-muted">{t("Organization name", "Name der Organisation")}<input disabled={!isOwner} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input + " w-full mt-1"} /></label>
          <label className="text-small text-muted">{t("Contact person", "Ansprechperson")}<input disabled={!isOwner} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={input + " w-full mt-1"} /></label>
          <label className="text-small text-muted">{t("Contact email", "Kontakt-E-Mail")}<input disabled={!isOwner} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className={input + " w-full mt-1"} /></label>
          <label className="text-small text-muted">{t("Billing notes", "Abrechnungshinweise")}<textarea disabled={!isOwner} rows={3} value={form.billing_notes} onChange={(e) => setForm({ ...form, billing_notes: e.target.value })} className={input + " w-full mt-1 resize-none"} /></label>
          {isOwner ? (
            <button disabled={busy || !form.name.trim()} onClick={() => run(() => sb.from("organizations").update({ name: form.name.trim(), contact_name: form.contact_name || null, contact_email: form.contact_email || null, billing_notes: form.billing_notes || null }).eq("id", ov.org.id) as any)} className={btnPrimary + " self-start"} style={gradient}>{t("SAVE", "SPEICHERN")}</button>
          ) : (
            <p className="text-caption text-muted">{t("Only owners can change these.", "Nur Eigentümer können dies ändern.")}</p>
          )}
          <div className="border-t border-white/10 pt-3 grid gap-2 text-small text-muted">
            <div>{t("Billing address, logo upload", "Rechnungsadresse, Logo-Upload")} — <span className="text-muted/70">{t("coming soon", "demnächst")}</span></div>
            <div>{t("AI Gas Tank", "KI-Tank")}: <span className="text-text">{ov.org.ai_credits.toLocaleString()}</span> {t("credits", "Credits")} — <span className="text-muted/70">{t("metering coming soon", "Messung demnächst")}</span></div>
          </div>
        </div>
      )}

      {tab === "license" && (
        <div className="grid gap-4 max-w-xl">
          <div className="glass rounded-2xl p-5 grid gap-4">
            <div>
              <div className="flex justify-between text-small mb-1"><span>{t("Workspaces", "Arbeitsbereiche")}</span><span>{wsUsed} / {ov.org.workspace_limit}</span></div>
              <Bar used={wsUsed} max={ov.org.workspace_limit} />
            </div>
            <div>
              <div className="flex justify-between text-small mb-1"><span>{t("Users", "Benutzer")}</span><span>{ov.users} / {ov.org.user_limit}</span></div>
              <Bar used={ov.users} max={ov.org.user_limit} />
            </div>
            <div className="text-small text-muted" suppressHydrationWarning>
              {t("Term", "Laufzeit")}: {fmt(ov.org.term_start)} → <span className={expired ? "text-danger" : ""}>{fmt(ov.org.term_end)}</span>
              {expired && ` · ${t("ended", "beendet")}`}
            </div>
            <p className="text-caption text-muted">{t("Need more workspaces or users, or a renewal? Write to ron@struinova.com.", "Mehr Arbeitsbereiche oder Benutzer, oder eine Verlängerung? Schreiben Sie an ron@struinova.com.")}</p>
          </div>
          <RedeemBox />
        </div>
      )}

      {tab === "agreements" && (
        <div className="grid gap-3">
          <p className="text-small text-muted">{t("Each agreement needs an owner's acknowledgement. We keep the version, the date and who accepted it.", "Jede Vereinbarung benötigt die Bestätigung eines Eigentümers. Wir halten Version, Datum und die bestätigende Person fest.")}</p>
          {([
            ["processor", t("Struinova processor note", "Struinova Auftragsverarbeitungs-Notiz"), t("How Struinova handles your organization's data on your behalf.", "Wie Struinova die Daten Ihrer Organisation in Ihrem Auftrag verarbeitet.")],
            ["privacy", t("Privacy notice", "Datenschutzhinweis"), t("What personal data Loom collects, why, and your rights.", "Welche personenbezogenen Daten Loom erhebt, warum, und Ihre Rechte.")],
            ["terms", t("Terms of use", "Nutzungsbedingungen"), t("The rules for using Loom.", "Die Regeln für die Nutzung von Loom.")],
          ] as const).map(([doc, title, blurb]) => {
            const hist = ov.acks.filter((a: OrgAck) => a.document === doc);
            const last = hist[0];
            const current = last?.version === AGREEMENT_VERSION;
            return (
              <div key={doc} className="glass rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-[14rem]">
                    <div className="text-lead font-medium">{title}</div>
                    <p className="text-small text-muted mt-0.5">{blurb}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-micro font-mono tracking-wider whitespace-nowrap ${current ? "border-emerald-400/40 text-emerald-300 bg-emerald-500/10" : "border-orange/50 text-orange bg-orange/10"}`}>
                    {current ? t("ACKNOWLEDGED", "BESTÄTIGT") : last ? t("NEW VERSION TO ACKNOWLEDGE", "NEUE VERSION ZU BESTÄTIGEN") : t("NOT YET ACKNOWLEDGED", "NOCH NICHT BESTÄTIGT")}
                  </span>
                </div>
                {last && (
                  <p className="text-small text-text/90" suppressHydrationWarning>
                    {t("Accepted by", "Bestätigt von")} <b>{last.name || last.email}</b>{last.name ? ` (${last.email})` : ""} · {fmt(last.accepted_at)} · {t("version", "Version")} {last.version}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setLegal(doc)} className={btn}>{t("READ", "LESEN")}</button>
                  {isOwner && (
                    <button disabled={busy || current} onClick={() => run(() => sb.rpc("org_ack", { p_org: ov.org.id, p_doc: doc, p_version: AGREEMENT_VERSION }))} className={btnPrimary} style={gradient}>
                      {t("ACKNOWLEDGE", "BESTÄTIGEN")}
                    </button>
                  )}
                  {!isOwner && !current && <span className="text-caption text-muted">{t("Only owners can acknowledge.", "Nur Eigentümer können bestätigen.")}</span>}
                </div>
                {hist.length > 1 && (
                  <div className="text-caption text-muted border-t border-white/10 pt-2" suppressHydrationWarning>
                    {t("Earlier", "Früher")}: {hist.slice(1).map((h) => `${h.version} · ${h.name || h.email} · ${fmt(h.accepted_at)}`).join("  |  ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {delWs && <DeleteConfirm ws={delWs} onClose={() => setDelWs(null)} />}
      {legal && <LegalModal doc={legal === "privacy" ? PRIVACY : legal === "terms" ? TERMS : PROCESSOR} slug={legal} onClose={() => setLegal(null)} />}
    </section>
  );
}
