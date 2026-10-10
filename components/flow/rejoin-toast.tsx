"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

// Shown once per browser session when someone lands back in Loom without signing in just now
// (e.g. reopening the browser while "Keep me signed in" is on). Skipped right after a sign-in.
export function RejoinToast({ orgName }: { orgName: string }) {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("loom_rejoin_seen") === "1";
      sessionStorage.setItem("loom_rejoin_seen", "1");
    } catch {}
    const fromLogin = /\/(login|auth|reset-password|invite)/.test(document.referrer);
    if (seen || fromLogin) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 3600);
    return () => clearTimeout(id);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[95] rounded-full glass glass-bright px-5 py-2 text-[0.82rem] text-text shadow-lg" role="status">
      {t(`You're securely rejoining ${orgName}.`, `Sie kehren sicher zu ${orgName} zurück.`)}
    </div>
  );
}
