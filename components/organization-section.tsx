"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

const input = "bg-black/30 border border-white/10 rounded-xl text-text text-sm px-3 py-2 outline-none focus:border-orange/60";

export function RedeemBox() {
  const t = useT();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true);
    setErr("");
    const { error } = await createClient().rpc("redeem_license", { p_code: code });
    if (error) {
      setErr(t("That code didn't work. Check it, make sure you're signed in with the email it was issued to, or ask us for a new one.", "Dieser Code hat nicht funktioniert. Bitte prüfen Sie ihn, melden Sie sich mit der E-Mail-Adresse an, für die er ausgestellt wurde, oder fragen Sie nach einem neuen."));
      setBusy(false);
      return;
    }
    window.location.assign("/loomfloor");
  }
  return (
    <div className="glass rounded-2xl p-5 mb-6">
      <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-orange mb-2">{t("License code", "Lizenzcode")}</div>
      <p className="text-[0.85rem] text-muted mb-3">{t("Have an enterprise license code? Enter it to open your organization.", "Haben Sie einen Enterprise-Lizenzcode? Geben Sie ihn ein, um Ihre Organisation zu öffnen.")}</p>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" className={input + " flex-1 font-mono tracking-wider"} />
        <button disabled={busy || code.trim().length < 8} onClick={go} className="rounded-full text-white text-[0.72rem] font-mono tracking-wider px-4 py-2 disabled:opacity-40" style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}>
          {busy ? t("CHECKING…", "PRÜFE…") : t("REDEEM", "EINLÖSEN")}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
