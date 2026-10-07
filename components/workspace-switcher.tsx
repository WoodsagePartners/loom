"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Workspace, WorkspaceRole } from "@/lib/workspaces";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { WorkspaceDetails } from "@/components/workspace-details";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "OWNER",
  admin: "ADMIN",
  member: "MEMBER",
};

export function WorkspaceSwitcher({
  orgId,
  orgName,
  workspaces,
  role,
}: {
  orgId: string;
  orgName: string;
  workspaces: Workspace[];
  role: WorkspaceRole;
}) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(orgName);
  const [renameErr, setRenameErr] = useState<string | null>(null);
  const sb = useRef(createClient()).current;
  const canRename = role === "owner" || role === "admin";
  const [switching, setSwitching] = useState(false);
  const [details, setDetails] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function commitRename() {
    const name = draft.trim();
    if (!name || name === orgName) return setRenaming(false);
    const { error } = await sb.from("orgs").update({ name }).eq("id", orgId);
    if (error) return setRenameErr(error.message);
    setRenaming(false);
    setRenameErr(null);
    router.refresh();
  }

  async function switchTo(id: string) {
    if (id === orgId || switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: id }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="relative flex items-center gap-1.5" ref={ref}>
      {renaming ? (
        <div className="flex items-center gap-1.5">
          <b className="font-medium uppercase tracking-[0.12em] text-[0.78rem] text-text/90">{t("Workspace:", "Arbeitsbereich:")}</b>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setRenaming(false); setRenameErr(null); }
            }}
            className="bg-black/25 border border-orange/40 rounded-md text-[0.82rem] px-2 py-0.5 outline-none w-48"
          />
          {renameErr && <span className="text-[0.72rem] text-red-300">{renameErr}</span>}
        </div>
      ) : (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-muted hover:text-text text-xs font-normal transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-[0.82rem]"><b className="font-medium uppercase tracking-[0.12em] text-[0.78rem] text-text/90 mr-1.5">{t("Workspace:", "Arbeitsbereich:")}</b>{orgName}</span>
        <span className="text-[0.74rem]">{open ? "▴" : "▾"}</span>
      </button>
      )}
      {canRename && !renaming && (
        <button
          type="button"
          onClick={() => { setDraft(orgName); setRenaming(true); setOpen(false); }}
          title={t("Rename workspace", "Arbeitsbereich umbenennen")}
          className="text-muted/50 hover:text-orange text-[0.8rem] leading-none"
        >
          ✎
        </button>
      )}

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-72 z-50 glass glass-bright glass-clear rounded-xl p-1.5"
          style={{ background: "var(--tint-solid)" }}
        >
          <div className="px-2.5 pt-1.5 pb-1 text-[0.66rem] font-mono tracking-[0.14em] text-muted/70">{t("WORKSPACES", "ARBEITSBEREICHE")}</div>
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitem"
              disabled={switching}
              onClick={() => switchTo(w.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-[0.82rem] rounded-lg hover:bg-white/10 disabled:opacity-50 ${w.id === orgId ? "bg-white/[0.06]" : ""}`}
            >
              <span className="w-3 text-orange text-xs">{w.id === orgId ? "✓" : ""}</span>
              <span className="flex-1 truncate">{w.name}</span>
              <span className="text-[0.68rem] text-muted/70">{({ owner: t("Owner", "Eigentümer"), admin: t("Admin", "Admin"), member: t("Member", "Mitglied") })[w.role]}</span>
            </button>
          ))}
          <div className="my-1.5 border-t border-white/10" />
          {canRename && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setDetails(true); }}
              className="w-full px-2.5 py-2 text-left text-[0.82rem] rounded-lg text-muted hover:text-text hover:bg-white/10"
            >
              {t("About this workspace…", "Über diesen Arbeitsbereich…")}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => router.push("/onboarding")}
            className="w-full px-2.5 py-2 text-left text-[0.82rem] rounded-lg text-muted hover:text-text hover:bg-white/10"
          >
            {t("+ New workspace", "+ Neuer Arbeitsbereich")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => router.push("/workspaces")}
            className="w-full px-2.5 py-2 text-left text-[0.82rem] rounded-lg text-muted hover:text-text hover:bg-white/10"
          >
            {t("All workspaces…", "Alle Arbeitsbereiche…")}
          </button>
        </div>
      )}
    {details && <WorkspaceDetails orgId={orgId} onClose={() => setDetails(false)} />}
    </div>
  );
}
