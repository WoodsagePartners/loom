"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Workspace, WorkspaceRole } from "@/lib/workspaces";
import { TeamPanel } from "@/components/team-panel";

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
  const [open, setOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-muted hover:text-white text-xs font-light uppercase tracking-[0.04em] transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{orgName}</span>
        <span className="text-[0.55rem]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-72 z-50 rounded-md border border-white/10 bg-[#0b1020] shadow-xl py-1"
        >
          <div className="px-3 py-1.5 text-[0.6rem] tracking-[0.12em] text-muted/60">WORKSPACES</div>
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitem"
              disabled={switching}
              onClick={() => switchTo(w.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 disabled:opacity-50"
            >
              <span className="w-3 text-orange">{w.id === orgId ? "✓" : ""}</span>
              <span className="flex-1 truncate">{w.name}</span>
              <span className="text-[0.55rem] tracking-[0.1em] text-muted/60">{ROLE_LABEL[w.role]}</span>
            </button>
          ))}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => router.push("/onboarding")}
            className="w-full px-3 py-2 text-left text-xs hover:bg-white/5"
          >
            + New workspace
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setTeamOpen(true);
            }}
            className="w-full px-3 py-2 text-left text-xs hover:bg-white/5"
          >
            Team &amp; invites
          </button>
        </div>
      )}

      {teamOpen && (
        <TeamPanel orgId={orgId} orgName={orgName} role={role} onClose={() => setTeamOpen(false)} />
      )}
    </div>
  );
}
