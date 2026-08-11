import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data: threads } = await supabase
    .from("threads")
    .select("id, name, state, questions")
    .eq("org_id", memberships[0].org_id)
    .order("touched_at", { ascending: false });

  return (
    <main className="min-h-screen p-8">
      <div className="font-semibold tracking-[0.16em] text-xs mb-8">
        THE <span className="text-orange">LOOM</span>
      </div>
      <h1 className="text-xl font-light mb-6">
        {(memberships[0] as any).orgs?.name ?? "Workspace"}
      </h1>
      {threads && threads.length > 0 ? (
        <div className="space-y-2">
          {threads.map((t) => (
            <div key={t.id} className="glass rounded-2xl p-4">
              <div className="text-xs font-mono text-muted mb-1">
                {t.state.toUpperCase()}
              </div>
              <div className="text-sm">
                {Array.isArray(t.questions) && t.questions.length > 0
                  ? t.questions[t.questions.length - 1]
                  : t.name}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm font-light">
          No threads yet. The canvas UI (nodes, wires, telemetry, walkthrough) from
          the-loom.html gets ported here next — this page is the landing spot.
        </p>
      )}
    </main>
  );
}
