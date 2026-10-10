import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { FlowApp } from "@/components/flow/flow-app";
import { RejoinToast } from "@/components/flow/rejoin-toast";
import type { Actor, FlowEdge, FlowNode, Lane, PhaseNode, Roadmap, RoadmapPhase, Workflow } from "@/lib/flow";
import { profileFromUser } from "@/lib/profile";
import { ACTIVE_ORG_COOKIE, type Workspace, type WorkspaceRole } from "@/lib/workspaces";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ wf?: string; pin?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role, orgs(name, locked, archived)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) redirect("/loomfloor");

  // Workspaces of an organization whose license term has ended are closed.
  const { data: exp } = await supabase.rpc("my_expired_workspaces");
  const expiredIds = new Set(((exp as any) ?? []).map((w: any) => w.id as string));
  const workspaces: Workspace[] = memberships
    .filter((m: any) => !m.orgs?.archived && !expiredIds.has(m.org_id))
    .map((m: any) => ({
      id: m.org_id as string,
      name: (m.orgs?.name as string | undefined) ?? "Workspace",
      role: m.role as WorkspaceRole,
      locked: !!m.orgs?.locked,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (workspaces.length === 0) redirect("/loomfloor");

  // The cookie is only a preference — it's honored only if it matches a
  // membership this user really has (RLS enforces the real boundary).
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = workspaces.find((w) => w.id === preferred) ?? workspaces[0];
  const orgId = active.id;
  const orgName = active.name;

  const { data: wfRows } = await supabase
    .from("workflows")
    .select("id, org_id, name, description, color, locked, locked_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  const workflows = (wfRows ?? []) as unknown as Workflow[];
  const wfIds = workflows.map((w) => w.id);

  const [actorsRes, lanesRes, nodesRes, edgesRes, countRes, rmRes, phRes, pnRes] = await Promise.all([
    supabase.from("actors").select("id, org_id, kind, name, role, color, notes, enterprise_id").eq("org_id", orgId).order("created_at"),
    wfIds.length ? supabase.from("lanes").select("*").in("workflow_id", wfIds).order("position") : Promise.resolve({ data: [] }),
    wfIds.length ? supabase.from("flow_nodes").select("*").in("workflow_id", wfIds) : Promise.resolve({ data: [] }),
    wfIds.length ? supabase.from("flow_edges").select("*").in("workflow_id", wfIds) : Promise.resolve({ data: [] }),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    wfIds.length ? supabase.from("roadmaps").select("*").in("workflow_id", wfIds).order("position") : Promise.resolve({ data: [] }),
    wfIds.length ? supabase.from("roadmap_phases").select("*").in("workflow_id", wfIds).order("position") : Promise.resolve({ data: [] }),
    wfIds.length ? supabase.from("phase_nodes").select("*").in("workflow_id", wfIds) : Promise.resolve({ data: [] }),
  ]);

  // Vercel sets this automatically at build time; shown in the corner so a
  // stale-looking browser can be diagnosed by eye.
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

  return (
    <>
    <RejoinToast orgName={orgName} />
    <FlowApp
      key={orgId}
      orgId={orgId}
      orgName={orgName}
      workspaces={workspaces}
      role={active.role}
      orgLocked={!!active.locked}
      memberCount={countRes.count ?? 1}
      startFocus={sp.wf && sp.pin && workflows.some((w) => w.id === sp.wf) ? { workflowId: sp.wf, pinId: sp.pin } : null}
      buildSha={buildSha}
      profile={profileFromUser(user)}
      initial={{
        workflows,
        actors: (actorsRes.data ?? []) as unknown as Actor[],
        lanes: (lanesRes.data ?? []) as unknown as Lane[],
        nodes: (nodesRes.data ?? []) as unknown as FlowNode[],
        edges: (edgesRes.data ?? []) as unknown as FlowEdge[],
        roadmaps: (rmRes.data ?? []) as unknown as Roadmap[],
        phases: (phRes.data ?? []) as unknown as RoadmapPhase[],
        phaseNodes: (pnRes.data ?? []) as unknown as PhaseNode[],
      }}
    />
    </>
  );
}
