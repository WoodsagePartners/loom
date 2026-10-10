"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Workspace, WorkspaceRole } from "@/lib/workspaces";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { WorkspaceDetails } from "@/components/workspace-details";
import { LockIcon, PencilIcon, UnlockIcon } from "@/components/icons";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "OWNER",
  admin: "ADMIN",
  member: "MEMBER",
};

export function WorkspaceSwitcher({
  orgId,
  orgName,
  role,
  locked = false,
}: {
  orgId: string;
  orgName: string;
  workspaces?: Workspace[]; // no longer listed here: the Workspaces page is the place to switch
  role: WorkspaceRole;
  locked?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(orgName);
  const [renameErr, setRenameErr] = useState<string | null>(null);
  const [lockErr, setLockErr] = useState<string | null>(null);
  const sb = useRef(createClient()).current;
  const canRename = role === "owner" || role === "admin";
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

  async function toggleLock() {
    setOpen(false);
    const { error } = await sb.from("orgs").update({ locked: !locked }).eq("id", orgId);
    if (error) return setLockErr(error.message);
    setLockErr(null);
    router.refresh();
  }

  async function commitRename() {
    const name = draft.trim();
    if (!name || name === orgName) return setRenaming(false);
    const { error } = await sb.from("orgs").update({ name }).eq("id", orgId);
    if (error) return setRenameErr(error.message);
    setRenaming(false);
    setRenameErr(null);
    router.refresh();
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
        {locked ? <LockIcon size={13} className="text-orange" /> : <UnlockIcon size={13} className="text-muted/60" />}
        <span className="text-[0.82rem]"><b className="font-medium uppercase tracking-[0.12em] text-[0.78rem] text-text/90 mr-1.5">{t("Workspace:", "Arbeitsbereich:")}</b>{orgName}</span>
        <span className="text-[0.74rem]">{open ? "▴" : "▾"}</span>
      </button>
      )}
      {lockErr && <span className="text-[0.72rem] text-red-300" onClick={() => setLockErr(null)}>{lockErr}</span>}
      {canRename && !renaming && (
        <button
          type="button"
          onClick={() => { setDraft(orgName); setRenaming(true); setOpen(false); }}
          title={t("Rename workspace", "Arbeitsbereich umbenennen")}
          className="text-muted/50 hover:text-orange text-[0.8rem] leading-none"
        >
          <PencilIcon size={12} />
        </button>
      )}

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-72 z-50 glass glass-bright glass-clear rounded-xl p-1.5"
          style={{ background: "var(--tint-solid)" }}
        >
          {canRename && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setDetails(true); }}
              className="w-full px-2.5 py-2 text-left text-[0.82rem] rounded-lg text-muted hover:text-text hover:bg-white/10 flex items-center gap-2"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
              {t("About this workspace…", "Über diesen Arbeitsbereich…")}
            </button>
          )}
          {canRename && (
            <button
              type="button"
              role="menuitem"
              onClick={toggleLock}
              className="w-full px-2.5 py-2 text-left text-[0.82rem] rounded-lg text-muted hover:text-text hover:bg-white/10 flex items-center gap-2"
            >
              {locked ? <LockIcon size={13} className="text-orange" /> : <UnlockIcon size={13} />}
              <span className="flex-1">
                {locked ? t("Locked (view only)", "Gesperrt (nur Ansicht)") : t("Unlocked (editable)", "Entsperrt (bearbeitbar)")}
              </span>
              <span className="text-[0.7rem] font-mono tracking-wider text-orange">
                {locked ? t("UNLOCK", "ENTSPERREN") : t("LOCK", "SPERREN")}
              </span>
            </button>
          )}
          <div role="separator" className="my-1.5 mx-1 h-px bg-white/20" />
          <button
            type="button"
            role="menuitem"
            onClick={() => router.push("/loomfloor")}
            className="w-full px-2.5 py-2 text-left text-[0.82rem] rounded-lg text-muted hover:text-text hover:bg-white/10"
          >
            {t("← Return to the Loom Floor", "← Zurück zum Loom Floor")}
          </button>
        </div>
      )}
    {details && <WorkspaceDetails orgId={orgId} onClose={() => setDetails(false)} />}
    </div>
  );
}
