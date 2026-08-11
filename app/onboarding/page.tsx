"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired. Sign in again.");
      setBusy(false);
      return;
    }

    const { data: org, error: orgErr } = await supabase
      .from("orgs")
      .insert({ name, slug: slugify(name) + "-" + user.id.slice(0, 6) })
      .select()
      .single();

    if (orgErr || !org) {
      setError(orgErr?.message ?? "Could not create the workspace.");
      setBusy(false);
      return;
    }

    const { error: memErr } = await supabase
      .from("memberships")
      .insert({ org_id: org.id, user_id: user.id, role: "owner" });

    setBusy(false);
    if (memErr) {
      setError(memErr.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-3xl w-full max-w-sm p-8">
        <h1 className="text-lg font-medium mb-1">Name your workspace</h1>
        <p className="text-muted text-sm font-light mb-6">
          One workspace per engagement, per client, or per team. You can invite others in after.
        </p>
        <form onSubmit={createOrg} className="space-y-3">
          <input
            required
            placeholder="Struinova Innovation"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm font-light px-3 py-2.5 outline-none focus:border-orange/50"
          />
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full text-white text-xs font-mono tracking-wider py-2.5"
            style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
          >
            {busy ? "CREATING…" : "CREATE WORKSPACE"}
          </button>
        </form>
      </div>
    </main>
  );
}
