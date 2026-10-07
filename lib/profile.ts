import { PALETTE } from "@/lib/flow";

export type Profile = {
  id: string;
  email: string;
  name: string;
  title: string;
  phone: string;
  avatarColor: string | null;
  avatarUrl: string | null;
};

// Photos are private: the stored value is just a version marker; the image is served by /api/avatar/<id>.
export function avatarSrc(id: string, marker: string) {
  const v = marker.match(/avatar-(\d+)/)?.[1] ?? marker.replace(/\D/g, "").slice(-13) ?? "1";
  return `/api/avatar/${id}?v=${v}`;
}

export function profileFromUser(u: { id: string; email?: string | null; user_metadata?: Record<string, any> | null }): Profile {
  const m = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? "",
    name: typeof m.full_name === "string" ? m.full_name : "",
    title: typeof m.title === "string" ? m.title : "",
    phone: typeof m.phone === "string" ? m.phone : "",
    avatarColor: typeof m.avatar_color === "string" ? m.avatar_color : null,
    avatarUrl: typeof m.avatar_url === "string" && m.avatar_url ? avatarSrc(u.id, m.avatar_url) : null,
  };
}

export function initialsOf(p: { name: string; email: string }) {
  const src = p.name.trim() || p.email.split("@")[0] || "?";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const two = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : src.slice(0, 2);
  return two.toUpperCase();
}

export function colorOf(p: { id: string; avatarColor: string | null }) {
  if (p.avatarColor) return p.avatarColor;
  let h = 0;
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
