import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceCards } from "@/components/workspace-cards";
import type { Workspace, WorkspaceRole } from "@/lib/workspaces";
import { profileFromUser } from "@/lib/profile";

export default async function WorkspacesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await sb.from("memberships").select("org_id, role, orgs(name, locked)").eq("user_id", user.id);
  if (!memberships || memberships.length === 0) redirect("/onboarding");
  const workspaces: Workspace[] = memberships
    .map((m: any) => ({ id: m.org_id as string, name: (m.orgs?.name as string | undefined) ?? "Workspace", role: m.role as WorkspaceRole, locked: !!m.orgs?.locked }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // description / last-edited come from columns that may not exist yet on an older database: ask for
  // the most we can get and quietly fall back, so this page never breaks over a missing column.
  const ids = workspaces.map((w) => w.id);
  let extra: any[] | null = null;
  for (const cols of ["id, description, created_at, last_edited_at", "id, description, created_at", "id, description"]) {
    const r = await sb.from("orgs").select(cols).in("id", ids);
    if (!r.error) {
      extra = r.data as any[];
      break;
    }
  }
  const byId = new Map((extra ?? []).map((o) => [o.id as string, o]));
  for (const w of workspaces) {
    const o = byId.get(w.id);
    w.description = (o?.description as string | null | undefined) ?? null;
    w.lastEdited = (o?.last_edited_at as string | null | undefined) ?? (o?.created_at as string | null | undefined) ?? null;
  }
  return <WorkspaceCards workspaces={workspaces} profile={profileFromUser(user)} />;
}
