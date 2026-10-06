import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ThreadWorkspace } from "@/components/thread-workspace";
import { ACTIVE_ORG_COOKIE, type Workspace, type WorkspaceRole } from "@/lib/workspaces";
import type { EdgeRow, NodeRow, ThreadRow } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role, orgs(name)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) redirect("/onboarding");

  const workspaces: Workspace[] = memberships
    .map((m: any) => ({
      id: m.org_id as string,
      name: (m.orgs?.name as string | undefined) ?? "Workspace",
      role: m.role as WorkspaceRole,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // The cookie is only a preference — it's honored only if it matches a
  // membership this user really has (RLS enforces the real boundary).
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = workspaces.find((w) => w.id === preferred) ?? workspaces[0];
  const orgId = active.id;
  const orgName = active.name;

  const { data: threadRows } = await supabase
    .from("threads")
    .select("id, name, state, step, context, questions, touched_at")
    .eq("org_id", orgId)
    .order("touched_at", { ascending: false });

  let threads = (threadRows ?? []) as unknown as ThreadRow[];

  // A brand-new workspace should never land on an empty screen: seed one
  // thread so the process map is ready to fill in on first visit.
  if (threads.length === 0) {
    const { data: seeded } = await supabase
      .from("threads")
      .insert({
        org_id: orgId,
        name: "Our process",
        context: "Map how this work really gets done today, step by step, and who does each step.",
        questions: ["Where does this process slow down, and what could change?"],
        created_by: user.id,
      })
      .select("id, name, state, step, context, questions, touched_at")
      .single();
    if (seeded) threads = [seeded as unknown as ThreadRow];
  }
  const threadIds = threads.map((t) => t.id);

  const nodesByThread: Record<string, NodeRow[]> = {};
  if (threadIds.length > 0) {
    const { data: nodeRows } = await supabase
      .from("nodes")
      .select(
        "id, thread_id, parent_id, tech, base, items, pulled, state, ready, cond, folded, by, by_label, position_x, position_y, created_at"
      )
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true });

    for (const n of (nodeRows ?? []) as unknown as NodeRow[]) {
      (nodesByThread[n.thread_id] ??= []).push(n);
    }
  }

  // Secondary DAG edges — anything beyond a knot's one primary parent_id.
  // Empty on every thread until a "combine" feature actually writes to this
  // table, but the fetch is wired up now so the canvas is ready the day it
  // does. See lib/layout.ts secondaryEdges().
  const edgesByThread: Record<string, EdgeRow[]> = {};
  if (threadIds.length > 0) {
    const { data: edgeRows } = await supabase
      .from("node_edges")
      .select("id, thread_id, from_node_id, to_node_id, relation, created_at")
      .in("thread_id", threadIds);

    for (const e of (edgeRows ?? []) as unknown as EdgeRow[]) {
      (edgesByThread[e.thread_id] ??= []).push(e);
    }
  }

  // Vercel sets this automatically at build time for every deployment — no
  // config needed. Shown in the corner so a stale-looking browser can be
  // diagnosed by eye: if this doesn't match the commit you just pushed,
  // you're not looking at the deployment you think you are.
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

  return (
    <ThreadWorkspace
      key={orgId}
      orgId={orgId}
      workspaces={workspaces}
      role={active.role}
      orgName={orgName}
      buildSha={buildSha}
      threads={threads}
      nodesByThread={nodesByThread}
      edgesByThread={edgesByThread}
    />
  );
}
