import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThreadWorkspace } from "@/components/thread-workspace";
import type { NodeRow, ThreadRow } from "@/lib/types";

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

  const orgId = memberships[0].org_id;
  const orgName = (memberships[0] as any).orgs?.name ?? "Workspace";

  const { data: threadRows } = await supabase
    .from("threads")
    .select("id, name, state, step, context, questions, touched_at")
    .eq("org_id", orgId)
    .order("touched_at", { ascending: false });

  const threads = (threadRows ?? []) as unknown as ThreadRow[];
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

  // Vercel sets this automatically at build time for every deployment — no
  // config needed. Shown in the corner so a stale-looking browser can be
  // diagnosed by eye: if this doesn't match the commit you just pushed,
  // you're not looking at the deployment you think you are.
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

  return (
    <ThreadWorkspace
      orgId={orgId}
      orgName={orgName}
      buildSha={buildSha}
      threads={threads}
      nodesByThread={nodesByThread}
    />
  );
}
