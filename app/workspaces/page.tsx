import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceCards } from "@/components/workspace-cards";
import type { Workspace, WorkspaceRole } from "@/lib/workspaces";
import type { OrgView } from "@/lib/organizations";
import { profileFromUser } from "@/lib/profile";

export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<{ redeem?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await sb.from("memberships").select("org_id, role, orgs(name, locked, archived)").eq("user_id", user.id);

  // Enterprise organizations this person owns/administers (empty for free accounts).
  const { data: oms } = await sb.from("organization_members").select("organization_id").eq("user_id", user.id);
  const organizations: OrgView[] = [];
  for (const m of oms ?? []) {
    const oid = (m as any).organization_id as string;
    const [ov, pp, ak] = await Promise.all([
      sb.rpc("org_overview", { p_org: oid }),
      sb.rpc("org_people", { p_org: oid }),
      sb.from("processor_acks").select("version, accepted_at").eq("organization_id", oid).order("accepted_at", { ascending: false }).limit(5),
    ]);
    if (ov.data) organizations.push({ ...(ov.data as any), people: (pp.data as any) ?? [], acks: (ak.data as any) ?? [] });
  }
  const { data: pa } = await sb.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();

  if ((!memberships || memberships.length === 0) && organizations.length === 0 && sp.redeem !== "1") redirect("/onboarding");
  const all = memberships ?? [];
  const workspaces: Workspace[] = all
    .filter((m: any) => !m.orgs?.archived)
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
  return <WorkspaceCards workspaces={workspaces} profile={profileFromUser(user)} organizations={organizations} isAdmin={!!pa} showRedeem={sp.redeem === "1"} />;
}
