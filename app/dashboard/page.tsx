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

  return (
    <div className="min-h-screen flex flex-col">
      <div className="glass-chrome h-12 flex-none flex items-center gap-3 px-5 border-b border-white/10">
        <span className="font-semibold tracking-[0.16em] text-xs">
          THE <span className="text-orange">LOOM</span>
        </span>
        <span className="text-muted text-xs font-light ml-2">{orgName}</span>
      </div>
      <div className="flex-1 min-h-0">
        {threads.length > 0 ? (
          <ThreadWorkspace orgId={orgId} threads={threads} nodesByThread={nodesByThread} />
        ) : (
          <div className="p-8 text-muted text-sm font-light">
            No threads yet in this workspace. The composer for starting a new thread is next on
            the list — for now this is the live view once one exists.
          </div>
        )}
      </div>
    </div>
  );
}
