"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "link" | "password";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();

    if (signingUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      // "Confirm email" is on by default in Supabase — if it's still on,
      // signUp succeeds but there's no session yet, same deliverability
      // wall as the magic link. If it's off, session comes back immediately.
      if (data.session) router.push("/onboarding");
      else setSent(true);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
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

        <div className="flex gap-1 mb-5 font-mono text-[0.55rem] tracking-wider">
          {(["link", "password"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
                setSent(false);
              }}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                mode === m
                  ? "border-orange/50 text-orange bg-orange/10"
                  : "border-white/10 text-muted"
              }`}
            >
              {m === "link" ? "MAGIC LINK" : "PASSWORD"}
            </button>
          ))}
        </div>

        {mode === "link" ? (
          sent ? (
            <p className="text-sm font-light">
              Check <b className="font-normal text-text">{email}</b> for a sign-in link. Not
              there in a minute — check spam.
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
          )
        ) : sent ? (
          <p className="text-sm font-light">
            Account created for <b className="font-normal text-text">{email}</b>. Confirm your
            email to finish, or turn off "Confirm email" in Supabase Auth settings to skip that
            step entirely.
          </p>
        ) : (
          <form onSubmit={withPassword} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm font-light px-3 py-2.5 outline-none focus:border-orange/50"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm font-light px-3 py-2.5 outline-none focus:border-orange/50"
            />
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full text-white text-xs font-mono tracking-wider py-2.5"
              style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
            >
              {busy ? "WORKING…" : signingUp ? "CREATE ACCOUNT" : "SIGN IN"}
            </button>
            <button
              type="button"
              onClick={() => setSigningUp((s) => !s)}
              className="w-full text-center text-[0.7rem] text-muted font-light"
            >
              {signingUp ? "Have an account? Sign in" : "No account yet? Create one"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
