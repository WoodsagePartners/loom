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

        <div className="ml-auto flex items-center gap-2">
          <div className="group relative">
            <button
              disabled
              className="flex items-center gap-1.5 font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1.5 rounded-full border border-white/10 text-muted/70 cursor-not-allowed"
            >
              ⇪ Upload context
            </button>
            <div className="pointer-events-none absolute right-0 top-8 w-56 rounded-xl border border-white/10 bg-[#0d1420]/95 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-20">
              <span className="block font-mono text-[0.42rem] tracking-[0.1em] text-orange uppercase mb-1">
                Soon
              </span>
              <span className="text-[0.68rem] font-light text-[#dbe7f2] leading-snug">
                Upload org documents to prime every pull with real context.
              </span>
            </div>
          </div>

          <div className="group relative">
            <button
              disabled
              className="flex items-center gap-1.5 font-mono text-[0.5rem] tracking-[0.1em] uppercase px-2.5 py-1.5 rounded-full border border-white/10 text-muted/70 cursor-not-allowed"
            >
              ◈ Library
            </button>
            <div className="pointer-events-none absolute right-0 top-8 w-56 rounded-xl border border-white/10 bg-[#0d1420]/95 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-20">
              <span className="block font-mono text-[0.42rem] tracking-[0.1em] text-orange uppercase mb-1">
                Soon
              </span>
              <span className="text-[0.68rem] font-light text-[#dbe7f2] leading-snug">
                Browse and customize the shared technique knowledge base.
              </span>
            </div>
          </div>
        </div>
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
