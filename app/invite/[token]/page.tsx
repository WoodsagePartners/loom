"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Landing page for an invite link. Signed-out visitors never reach this
// component: middleware sends them to /login and brings them back here.
// Accepting is one database call (accept_invite) that only succeeds if the
// invite is unused, under 14 days old, and addressed to the signed-in email.
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return; // dev strict-mode runs effects twice
    started.current = true;
    (async () => {
      const supabase = createClient();
      const { data: orgId, error } = await supabase.rpc("accept_invite", { invite_token: token });
      if (error || !orgId) {
        setError(error?.message ?? "Could not accept this invite.");
        return;
      }
      await fetch("/api/workspace/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      router.replace("/dashboard");
    })();
  }, [token, router]);

  async function useDifferentAccount() {
    await createClient().auth.signOut();
    document.cookie = `loom_next=${encodeURIComponent(`/invite/${token}`)}; path=/; max-age=3600; samesite=lax`;
    router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-3xl w-full max-w-sm p-8">
        <div className="font-semibold tracking-[0.16em] text-xs mb-3">
          THE <span className="text-orange">LOOM</span>
        </div>
        {error ? (
          <>
            <h1 className="text-lg font-medium mb-2">This invite didn&apos;t work</h1>
            <p className="text-sm font-light text-red-300 mb-5">{error}</p>
            <p className="text-muted text-xs font-light mb-4">
              Invites only work for the email address they were sent to, once, within 14 days. Ask
              your workspace owner for a fresh one, or sign in with the invited address.
            </p>
            <button
              onClick={useDifferentAccount}
              className="w-full rounded-full border border-white/15 text-xs font-mono tracking-wider py-2.5"
            >
              SIGN IN WITH A DIFFERENT EMAIL
            </button>
          </>
        ) : (
          <p className="text-sm font-light text-muted">Joining the workspace…</p>
        )}
      </div>
    </main>
  );
}
