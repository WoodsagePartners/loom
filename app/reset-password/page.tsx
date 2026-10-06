"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";

const INPUT =
  "w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm font-light px-3 py-2.5 outline-none focus:border-orange/50";

export default function ResetPasswordPage() {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError(t("Passwords don't match.", "Die Passwörter stimmen nicht überein."));
    setBusy(true);
    setError("");
    // Reaching this page means the emailed link was verified and a session exists.
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else window.location.assign("/auth/continue");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-3xl w-full max-w-sm p-8">
        <div className="flex items-start justify-between mb-1">
          <div className="font-semibold tracking-[0.16em] text-xs">
            THE <span className="text-orange">LOOM</span>
          </div>
          <LangToggle />
        </div>
        <p className="text-muted text-sm font-light mb-6">{t("Choose a new password.", "Wählen Sie ein neues Passwort.")}</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t("new password (8+ characters)", "neues Passwort (mind. 8 Zeichen)")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t("repeat password", "Passwort wiederholen")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={INPUT}
          />
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full text-white text-xs font-mono tracking-wider py-2.5"
            style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
          >
            {busy ? t("SAVING…", "SPEICHERT…") : t("SAVE PASSWORD", "PASSWORT SPEICHERN")}
          </button>
        </form>
      </div>
    </main>
  );
}
