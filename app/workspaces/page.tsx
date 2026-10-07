import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceCards } from "@/components/workspace-cards";
import type { Workspace, WorkspaceRole } from "@/lib/workspaces";

export default async function WorkspacesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await sb.from("memberships").select("org_id, role, orgs(name)").eq("user_id", user.id);
  if (!memberships || memberships.length === 0) redirect("/onboarding");
  const workspaces: Workspace[] = memberships
    .map((m: any) => ({ id: m.org_id as string, name: (m.orgs?.name as string | undefined) ?? "Workspace", role: m.role as WorkspaceRole }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return <WorkspaceCards workspaces={workspaces} />;
}
