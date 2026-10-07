"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n";
import { useConfirm } from "@/components/confirm";
import type { WorkspaceRole } from "@/lib/workspaces";

type Member = {
  membership_id: string;
  user_id: string;
  email: string;
  role: WorkspaceRole;
  joined_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  created_at: string;
};

export function TeamPanel({
  orgId,
  orgName,
  role,
  onClose,
}: {
  orgId: string;
  orgName: string;
  role: WorkspaceRole;
  onClose: () => void;
}) {
  const t = useT();
  const [ask, confirmDialog] = useConfirm();
  const supabase = createClient();
  const canManage = role === "owner" || role === "admin";

  const [me, setMe] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const lang = useLang();
  const [note, setNote] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const link = (token: string) => `${window.location.origin}/invite/${token}`;

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setMe(u.user?.id ?? null);

    const { data: m, error: mErr } = await supabase.rpc("team_members", { target_org: orgId });
    if (mErr) setError(mErr.message);
    else setMembers((m ?? []) as Member[]);

    if (canManage) {
      const { data: i } = await supabase
        .from("invites")
        .select("id, email, role, token, created_at")
        .eq("org_id", orgId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      setInvites((i ?? []) as Invite[]);
    }
  }, [supabase, orgId, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("invites")
      .insert({ org_id: orgId, email: email.trim().toLowerCase(), role: inviteRole, invited_by: me })
      .select("id, token")
      .single();
    setBusy(false);
    if (err) {
      setError(
        err.code === "23505"
          ? t("That person already has an open invite. Copy their link below, or revoke it first.", "Für diese Person gibt es bereits eine offene Einladung. Kopieren Sie den Link unten oder widerrufen Sie ihn zuerst.")
          : err.message
      );
      return;
    }
    setEmail("");
    if (data?.id) await emailInvite(data.id);
    load();
  }

  async function emailInvite(id: string) {
    setNote(null);
    try {
      const r = await fetch("/api/invite/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: id, lang }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "send failed");
      setNote(t("Invitation emailed.", "Einladung per E-Mail gesendet."));
    } catch (e) {
      setError(t("Saved, but the email didn't go out — use Copy link. ", "Gespeichert, aber die E-Mail ging nicht raus – nutzen Sie „Link kopieren“. ") + (e instanceof Error ? e.message : ""));
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked — link is still visible in the list */
    }
  }

  async function revoke(id: string) {
    const { error: err } = await supabase.from("invites").delete().eq("id", id);
    if (err) setError(err.message);
    load();
  }

  async function changeRole(membershipId: string, next: WorkspaceRole) {
    setError(null);
    const { data, error: err } = await supabase
      .from("memberships")
      .update({ role: next })
      .eq("id", membershipId)
      .select("id");
    if (err) setError(err.message);
    else if (!data || data.length === 0) setError(t("You don't have permission to change that role.", "Sie dürfen diese Rolle nicht ändern."));
    load();
  }

  async function remove(m: Member) {
    const self = m.user_id === me;
    if (!(await ask(self ? t("Leave this workspace?", "Diesen Arbeitsbereich verlassen?") : t(`Remove ${m.email} from this workspace?`, `${m.email} aus diesem Arbeitsbereich entfernen?`), { confirmLabel: self ? t("LEAVE", "VERLASSEN") : t("REMOVE", "ENTFERNEN") }))) return;
    setError(null);
    const { data, error: err } = await supabase
      .from("memberships")
      .delete()
      .eq("id", m.membership_id)
      .select("id");
    if (err) setError(err.message);
    else if (!data || data.length === 0)
      setError(t("Couldn't remove that member. A workspace must keep at least one owner.", "Mitglied konnte nicht entfernt werden. Ein Arbeitsbereich braucht mindestens einen Eigentümer."));
    else if (self) {
      window.location.href = "/dashboard";
      return;
    }
    load();
  }

  const canEditRole = (m: Member) =>
    role === "owner" || (role === "admin" && m.role !== "owner" && m.user_id !== me);
  const canRemove = (m: Member) =>
    m.user_id === me || role === "owner" || (role === "admin" && m.role !== "owner");

  return (
    <>
    {confirmDialog}
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 backdrop-blur-[3px] p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl max-h-[85vh] quiet-scroll overflow-y-auto glass glass-bright glass-clear rounded-2xl p-6 text-sm" style={{ background: "var(--tint-solid)" }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[0.8rem] tracking-[0.14em] text-muted/60">{t("TEAM", "TEAM")}</div>
            <div className="text-base font-semibold">{orgName}</div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white text-lg leading-none" aria-label={t("Close", "Schließen")}>
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {note && !error && (
          <div className="mb-4 rounded border border-green-400/30 bg-green-500/10 px-3 py-2 text-xs text-green-200">{note}</div>
        )}

        <div className="text-[0.8rem] tracking-[0.12em] text-muted/60 mb-2">{t("MEMBERS", "MITGLIEDER")}</div>
        <ul className="mb-6 divide-y divide-white/5">
          {members.map((m) => (
            <li key={m.membership_id} className="flex items-center gap-3 py-2">
              <span className="flex-1 truncate text-xs">
                {m.email}
                {m.user_id === me && <span className="text-muted/60"> {t("(you)", "(Sie)")}</span>}
              </span>
              {canEditRole(m) ? (
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.membership_id, e.target.value as WorkspaceRole)}
                  className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[0.8rem] tracking-[0.08em]"
                >
                  <option value="member" className="bg-[#0b1020]">{t("MEMBER", "MITGLIED")}</option>
                  <option value="admin" className="bg-[#0b1020]">{t("ADMIN", "ADMIN")}</option>
                  {role === "owner" && <option value="owner" className="bg-[#0b1020]">{t("OWNER", "EIGENTÜMER")}</option>}
                </select>
              ) : (
                <span className="text-[0.8rem] tracking-[0.08em] text-muted">{({ owner: t("OWNER", "EIGENTÜMER"), admin: t("ADMIN", "ADMIN"), member: t("MEMBER", "MITGLIED") })[m.role]}</span>
              )}
              {canRemove(m) && (
                <button
                  onClick={() => remove(m)}
                  className="text-[0.8rem] text-muted hover:text-red-300"
                >
                  {m.user_id === me ? t("Leave", "Verlassen") : t("Remove", "Entfernen")}
                </button>
              )}
            </li>
          ))}
        </ul>

        {canManage ? (
          <>
            <div className="text-[0.8rem] tracking-[0.12em] text-muted/60 mb-2">{t("INVITE A TEAMMATE", "KOLLEGEN EINLADEN")}</div>
            <form onSubmit={sendInvite} className="flex gap-2 mb-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("name@company.com", "name@firma.de")}
                className="flex-1 bg-transparent border border-white/10 rounded px-2.5 py-1.5 text-xs outline-none focus:border-orange"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="bg-transparent border border-white/10 rounded px-1.5 text-[0.8rem] tracking-[0.08em]"
              >
                <option value="member" className="bg-[#0b1020]">{t("MEMBER", "MITGLIED")}</option>
                <option value="admin" className="bg-[#0b1020]">{t("ADMIN", "ADMIN")}</option>
                {role === "owner" && <option value="owner" className="bg-[#0b1020]">{t("OWNER", "EIGENTÜMER")}</option>}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-orange px-3 text-xs font-semibold text-black disabled:opacity-50"
              >
                {t("INVITE", "EINLADEN")}
              </button>
            </form>
            <p className="text-[0.8rem] text-muted/60 mb-4">
              {t(
                "Creates a private link tied to that email address. Send it however you like — it only works for the person signed in with that email, and expires in 14 days.",
                "Erzeugt einen privaten Link, der an diese E-Mail-Adresse gebunden ist. Senden Sie ihn, wie Sie möchten – er funktioniert nur für die Person, die mit dieser E-Mail angemeldet ist, und läuft nach 14 Tagen ab."
              )}
            </p>

            {invites.length > 0 && (
              <>
                <div className="text-[0.8rem] tracking-[0.12em] text-muted/60 mb-2">{t("PENDING", "AUSSTEHEND")}</div>
                <ul className="divide-y divide-white/5">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1 truncate text-xs">
                        {i.email} <span className="text-muted/60">· {i.role}</span>
                      </span>
                      <button onClick={() => emailInvite(i.id)} className="text-[0.8rem] text-orange hover:underline">
                        {t("Resend email", "E-Mail erneut senden")}
                      </button>
                      <button
                        onClick={() => copy(link(i.token), i.token)}
                        className="text-[0.8rem] text-orange hover:underline"
                      >
                        {copied === i.token ? t("Copied", "Kopiert") : t("Copy link", "Link kopieren")}
                      </button>
                      <button onClick={() => revoke(i.id)} className="text-[0.8rem] text-muted hover:text-red-300">
                        {t("Revoke", "Widerrufen")}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <p className="text-xs text-muted/70">{t("Only workspace owners and admins can invite teammates.", "Nur Eigentümer und Admins des Arbeitsbereichs können Kollegen einladen.")}</p>
        )}
      </div>
    </div>
    </>
  );
}
