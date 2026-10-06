"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { NEXT_COOKIE } from "@/lib/workspaces";
import { LangToggle } from "@/components/lang-toggle";

const INPUT =
  "w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm font-light px-3 py-2.5 outline-none focus:border-orange/50";

export default function LoginPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function forgot() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setError(t("Enter your email above first.", "Geben Sie zuerst oben Ihre E-Mail ein."));
    setBusy(true);
    setError("");
    // The callback sends people to /reset-password once the link is verified.
    document.cookie = `${NEXT_COOKIE}=/reset-password; path=/; max-age=3600; samesite=lax`;
    const { error } = await createClient().auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setResetSent(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    if (signingUp) {
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) window.location.assign("/auth/continue");
      else setNeedsConfirm(true); // only if "Confirm email" is still on in Supabase
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setBusy(false);
    if (error) setError(t("Wrong email or password.", "E-Mail oder Passwort ist falsch."));
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
        <p className="text-muted text-sm font-light mb-6">
          {t(
            "Map how work really gets done — then find the knots worth untying.",
            "Zeigen Sie, wie Arbeit wirklich abläuft — und finden Sie die Knoten, die sich zu lösen lohnen."
          )}
        </p>

        {resetSent ? (
          <p className="text-sm font-light">
            {t("If an account exists for", "Falls ein Konto existiert für")} <b className="font-normal text-text">{email}</b>,{" "}
            {t("a reset link is on its way. Check spam if it doesn't show up in a minute.", "ist ein Link zum Zurücksetzen unterwegs. Prüfen Sie ggf. den Spam-Ordner.")}
          </p>
        ) : needsConfirm ? (
          <p className="text-sm font-light">
            {t("Account created for", "Konto erstellt für")} <b className="font-normal text-text">{email}</b>.{" "}
            {t("Check your email to confirm, then sign in.", "Bitte bestätigen Sie Ihre E-Mail und melden Sie sich dann an.")}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {signingUp && (
              <p className="text-[0.7rem] text-muted font-light">
                {t(
                  "Invited by a teammate? Create your account with the same email address the invite was sent to.",
                  "Von einem Teammitglied eingeladen? Erstellen Sie Ihr Konto mit derselben E-Mail-Adresse, an die die Einladung ging."
                )}
              </p>
            )}
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
            <input
              type="password"
              required
              minLength={8}
              autoComplete={signingUp ? "new-password" : "current-password"}
              placeholder={t("password (8+ characters)", "Passwort (mind. 8 Zeichen)")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
            />
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full text-white text-xs font-mono tracking-wider py-2.5"
              style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
            >
              {busy
                ? t("WORKING…", "BITTE WARTEN…")
                : signingUp
                  ? t("CREATE ACCOUNT", "KONTO ERSTELLEN")
                  : t("SIGN IN", "ANMELDEN")}
            </button>
            {!signingUp && (
              <button type="button" onClick={forgot} disabled={busy} className="w-full text-center text-[0.7rem] text-muted font-light hover:text-text">
                {t("Forgot your password?", "Passwort vergessen?")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSigningUp((s) => !s);
                setError("");
              }}
              className="w-full text-center text-[0.7rem] text-muted font-light"
            >
              {signingUp
                ? t("Have an account? Sign in", "Schon ein Konto? Anmelden")
                : t("No account yet? Create one", "Noch kein Konto? Erstellen")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
