"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-3xl w-full max-w-sm p-8">
        <div className="font-semibold tracking-[0.16em] text-xs mb-1">
          THE <span className="text-orange">LOOM</span>
        </div>
        <p className="text-muted text-sm font-light mb-6">
          Keep a line of inquiry alive when the facilitator is not in the room.
        </p>

        {sent ? (
          <p className="text-sm font-light">
            Check <b className="font-normal text-text">{email}</b> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={sendLink} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm font-light px-3 py-2.5 outline-none focus:border-orange/50"
            />
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full text-white text-xs font-mono tracking-wider py-2.5"
              style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
            >
              {busy ? "SENDING…" : "SEND SIGN-IN LINK"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
