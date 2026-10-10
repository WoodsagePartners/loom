"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PALETTE } from "@/lib/flow";
import { avatarSrc, colorOf, initialsOf, type Profile } from "@/lib/profile";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export function Avatar({ p, size = 30, online }: { p: { id: string; name: string; email: string; avatarColor: string | null; avatarUrl?: string | null }; size?: number; online?: boolean }) {
  const c = colorOf(p);
  return (
    <span className="relative inline-flex flex-none" style={{ width: size, height: size }}>
      {p.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatarUrl} alt="" className="rounded-full object-cover w-full h-full" style={{ border: `1.5px solid ${c}` }} />
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-full font-mono font-medium select-none w-full h-full"
          style={{ background: `${c}33`, border: `1.5px solid ${c}`, color: c, fontSize: size * 0.36 }}
        >
          {initialsOf(p)}
        </span>
      )}
      {online && <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-[#4ade80] border-2" style={{ borderColor: "var(--tint-solid)" }} />}
    </span>
  );
}

/** Crop to a centered square, shrink to 256px and re-encode as JPEG (also strips EXIF/location data). */
async function toAvatarBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("unreadable image"));
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ADJ = 220;
type Adj = { src: string; w: number; h: number; revoke: boolean };

/** Drag-to-pan + zoom editor; resolves to a 384px JPEG of exactly what's inside the circle. */
function PhotoAdjuster({ adj, onCancel, onSave, busy }: { adj: Adj; onCancel: () => void; onSave: (b: Blob) => void; busy: boolean }) {
  const t = useT();
  const base = ADJ / Math.min(adj.w, adj.h);
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const clamp = (x: number, y: number, zz: number) => {
    const mx = Math.max(0, (adj.w * base * zz - ADJ) / 2);
    const my = Math.max(0, (adj.h * base * zz - ADJ) / 2);
    return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };
  const setZoom = (nz: number) => {
    const zz = Math.min(4, Math.max(1, nz));
    setZ(zz);
    setPos((p) => clamp(p.x, p.y, zz));
  };
  async function save() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
      img.src = adj.src;
    });
    const k = base * z;
    const side = ADJ / k;
    const cx = adj.w / 2 - pos.x / k;
    const cy = adj.h / 2 - pos.y / k;
    const c = document.createElement("canvas");
    c.width = c.height = 384;
    c.getContext("2d")!.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, 384, 384);
    c.toBlob((b) => b && onSave(b), "image/jpeg", 0.88);
  }
  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-black/10 p-4 flex flex-col items-center gap-3">
      <div
        className="relative overflow-hidden rounded-full cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ width: ADJ, height: ADJ, boxShadow: "0 0 0 2px rgb(var(--c-white) / .25)" }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setPos(clamp(d.ox + e.clientX - d.px, d.oy + e.clientY - d.py, z));
        }}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => setZoom(z - e.deltaY * 0.002)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={adj.src}
          alt=""
          draggable={false}
          className="absolute max-w-none pointer-events-none"
          style={{ width: adj.w * base * z, height: adj.h * base * z, left: ADJ / 2 - (adj.w * base * z) / 2 + pos.x, top: ADJ / 2 - (adj.h * base * z) / 2 + pos.y }}
        />
      </div>
      <div className="flex items-center gap-2 w-full max-w-[260px]">
        <span className="text-muted text-xs">−</span>
        <input type="range" min={1} max={4} step={0.01} value={z} onChange={(e) => setZoom(parseFloat(e.target.value))} className="flex-1 accent-orange" aria-label={t("Zoom", "Zoom")} />
        <span className="text-muted text-xs">+</span>
      </div>
      <div className="text-caption text-muted">{t("Drag to reposition · scroll or slide to zoom", "Ziehen zum Verschieben · Scrollen oder Regler zum Zoomen")}</div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="rounded-full px-4 py-1.5 text-caption font-mono font-semibold tracking-wider text-onorange disabled:opacity-60" style={{ background: "linear-gradient(135deg, #f8991d, #e0771a)" }}>
          {t("SAVE PHOTO", "FOTO SPEICHERN")}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="text-caption text-muted hover:text-text">
          {t("Cancel", "Abbrechen")}
        </button>
      </div>
    </div>
  );
}

export function AccountMenu({ profile, onAccount, onSignOut, onTeam, onGuide }: { profile: Profile; onAccount: () => void; onSignOut: () => void; onTeam: () => void; onGuide: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 250);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const row = "w-full text-left px-3 py-2 text-small rounded-lg hover:bg-white/10 transition-colors";
  return (
    <div className="relative" ref={ref} onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
      <button onClick={hoverOpen} aria-haspopup="menu" aria-expanded={open} title={t("Account", "Konto")} className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-0.5 hover:scale-105 transition-transform">
        <Avatar p={profile} size={38} />
        <span className="max-w-[4.5rem] truncate text-label leading-none text-muted">{(profile.name || profile.email.split("@")[0]).split(" ")[0]}</span>
      </button>
      {open && (
        <div role="menu" style={{ background: "var(--tint-solid)" }} className="absolute right-0 top-[3.6rem] z-50 w-60 glass glass-bright glass-clear rounded-2xl p-1.5">
          <div className="px-3 pt-2 pb-2.5 border-b border-white/10 mb-1">
            <div className="text-body font-medium truncate">{profile.name || profile.email.split("@")[0]}</div>
          </div>
          <button role="menuitem" className={row} onClick={() => { setOpen(false); onAccount(); }}>
            {t("Account", "Konto")}
          </button>
          <div className="border-t border-white/10 my-1.5" />
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-caption text-muted">{t("Language", "Sprache")}</span>
            <LangToggle />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-caption text-muted">{t("Theme", "Darstellung")}</span>
            <ThemeToggle />
          </div>
          <div className="border-t border-white/10 my-1.5" />
          <button role="menuitem" className={row + " text-muted hover:text-text"} onClick={onSignOut}>
            {t("Sign out", "Abmelden")}
          </button>
        </div>
      )}
    </div>
  );
}

const FIELD =
  "w-full bg-black/25 border border-white/10 rounded-lg text-body px-3 py-2 outline-none focus:border-orange/50 placeholder:text-muted/50";
const LABEL = "block font-mono text-micro tracking-[0.14em] uppercase text-muted/80 mb-1";

export function AccountModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const t = useT();
  const sb = useRef(createClient()).current;
  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [color, setColor] = useState<string | null>(profile.avatarColor);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(profile.avatarUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const id = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(id);
  }, [msg]);
  const [adj, setAdj] = useState<Adj | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const draft: Profile = { ...profile, name, title, phone, avatarColor: color, avatarUrl: photo };

  async function saveProfile() {
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.updateUser({ data: { full_name: name.trim(), title: title.trim(), phone: phone.trim(), avatar_color: color } });
    setBusy(false);
    if (error) return setMsg({ kind: "err", text: error.message });
    onSaved({ ...draft, name: name.trim(), title: title.trim(), phone: phone.trim() });
    const newEmail = email.trim().toLowerCase();
    if (newEmail && newEmail !== profile.email.toLowerCase()) {
      const r = await sb.auth.updateUser({ email: newEmail }, { emailRedirectTo: `${window.location.origin}/auth/callback` });
      if (r.error) return setMsg({ kind: "err", text: r.error.message });
      setEmail(profile.email);
      return setMsg({ kind: "ok", text: t("Saved. Confirm the change via the link we emailed you.", "Gespeichert. Bestätigen Sie die Änderung über den gesendeten Link.") });
    }
    setMsg({ kind: "ok", text: t("Saved.", "Gespeichert.") });
  }

  function closeAdj() {
    setAdj((a) => {
      if (a?.revoke) URL.revokeObjectURL(a.src);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMsg({ kind: "err", text: t("Please choose an image file.", "Bitte wählen Sie eine Bilddatei.") });
    setMsg(null);
    const src = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setAdj({ src, w: i.width, h: i.height, revoke: true });
    i.onerror = () => {
      URL.revokeObjectURL(src);
      setMsg({ kind: "err", text: t("Could not read that image.", "Das Bild konnte nicht gelesen werden.") });
    };
    i.src = src;
  }

  function adjustCurrent() {
    if (!photo) return;
    const src = photo + (photo.includes("?") ? "&" : "?") + "adj=1";
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setAdj({ src, w: i.width, h: i.height, revoke: false });
    i.onerror = () => setMsg({ kind: "err", text: t("Could not load the current photo.", "Das aktuelle Foto konnte nicht geladen werden.") });
    i.src = src;
  }

  async function uploadPhoto(blob: Blob) {
    setBusy(true);
    setMsg(null);
    try {
      const path = `${profile.id}/avatar-${Date.now()}.jpg`;
      const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (up.error) throw up.error;
      const marker = path.split("/")[1];
      const url = avatarSrc(profile.id, marker);
      const { error } = await sb.auth.updateUser({ data: { avatar_url: marker } });
      if (error) throw error;
      // tidy: drop earlier photos so only the newest remains
      const old = await sb.storage.from("avatars").list(profile.id);
      const stale = (old.data ?? []).map((o) => `${profile.id}/${o.name}`).filter((n) => n !== path);
      if (stale.length) await sb.storage.from("avatars").remove(stale);
      setPhoto(url);
      onSaved({ ...draft, avatarUrl: url });
      setMsg({ kind: "ok", text: t("Photo updated.", "Foto aktualisiert.") });
      closeAdj();
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? t("Could not upload the photo.", "Das Foto konnte nicht hochgeladen werden.") });
    }
    setBusy(false);
  }

  async function removePhoto() {
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.updateUser({ data: { avatar_url: null } });
    if (!error) {
      const old = await sb.storage.from("avatars").list(profile.id);
      const all = (old.data ?? []).map((o) => `${profile.id}/${o.name}`);
      if (all.length) await sb.storage.from("avatars").remove(all);
      setPhoto(null);
      onSaved({ ...draft, avatarUrl: null });
    } else setMsg({ kind: "err", text: error.message });
    setBusy(false);
  }

  async function savePassword() {
    if (pw.length < 8) return setMsg({ kind: "err", text: t("Use at least 8 characters.", "Mindestens 8 Zeichen verwenden.") });
    if (pw !== pw2) return setMsg({ kind: "err", text: t("The two passwords don't match.", "Die beiden Passwörter stimmen nicht überein.") });
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ kind: "err", text: error.message });
    setPw("");
    setPw2("");
    setMsg({ kind: "ok", text: t("Password updated.", "Passwort aktualisiert.") });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 backdrop-blur-[3px] p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg max-h-[88vh] quiet-scroll overflow-y-auto glass glass-bright rounded-2xl p-6 text-sm">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <Avatar p={draft} size={56} />
            <div>
              <div className="text-small tracking-[0.14em] text-muted/70">{t("ACCOUNT", "KONTO")}</div>
              <div className="text-base font-semibold">{name.trim() || profile.email.split("@")[0]}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-lg leading-none" aria-label={t("Close", "Schließen")}>×</button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="rounded-full border border-white/20 px-4 py-1.5 text-caption font-mono tracking-wider hover:border-orange/50 disabled:opacity-50">
            {photo ? t("CHANGE PHOTO", "FOTO ÄNDERN") : t("ADD PHOTO", "FOTO HINZUFÜGEN")}
          </button>
          {photo && !adj && (
            <button type="button" disabled={busy} onClick={adjustCurrent} className="text-caption text-muted hover:text-orange">
              {t("Adjust", "Anpassen")}
            </button>
          )}
          {photo && (
            <button type="button" disabled={busy} onClick={removePhoto} className="text-caption text-muted hover:text-red-300">
              {t("Remove", "Entfernen")}
            </button>
          )}
        </div>
        {adj && <PhotoAdjuster adj={adj} busy={busy} onCancel={closeAdj} onSave={uploadPhoto} />}
        <div className="mb-4">
          <div className={LABEL}>{t("Avatar color", "Avatarfarbe")}</div>
          <div className="flex gap-1.5">
            {PALETTE.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110" style={{ background: c, borderColor: (color ?? colorOf(profile)) === c ? "rgb(var(--c-white))" : "transparent" }} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <label className={LABEL}>{t("Name", "Name")}</label>
            <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Your full name", "Ihr vollständiger Name")} />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>{t("Email", "E-Mail")}</label>
            <input className={FIELD} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>{t("Title", "Position")}</label>
            <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Operations lead", "z. B. Leitung Betrieb")} />
          </div>
          <div>
            <label className={LABEL}>{t("Phone", "Telefon")}</label>
            <input className={FIELD} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+43 …" />
          </div>
        </div>
        <button onClick={saveProfile} disabled={busy} className="rounded-full px-5 py-2 text-small font-mono font-semibold tracking-wider text-onorange disabled:opacity-60" style={{ background: "linear-gradient(135deg, #f8991d, #e0771a)" }}>
          {t("SAVE PROFILE", "PROFIL SPEICHERN")}
        </button>

        <div className="border-t border-white/10 mt-6 pt-5">
          <div className="text-small tracking-[0.14em] text-muted/70 mb-3">{t("PASSWORD", "PASSWORT")}</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={LABEL}>{t("New password", "Neues Passwort")}</label>
              <input className={FIELD} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>{t("Repeat it", "Wiederholen")}</label>
              <input className={FIELD} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
          </div>
          <button onClick={savePassword} disabled={busy || !pw} className="rounded-full border border-white/20 px-5 py-2 text-small font-mono tracking-wider hover:border-orange/50 disabled:opacity-50">
            {t("SET PASSWORD", "PASSWORT SETZEN")}
          </button>
        </div>

        <div className="mt-4 h-9" aria-live="polite">
          {msg && (
            <div className={`rounded-lg px-3 py-2 text-xs border truncate ${msg.kind === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-red-400/30 bg-red-500/10 text-red-300"}`}>
              {msg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
