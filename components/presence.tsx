"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/account";
import { useT } from "@/lib/i18n";
import type { Profile } from "@/lib/profile";

type Peer = { id: string; name: string; email: string; avatarColor: string | null; avatarUrl: string | null };

/** Who is in this workspace right now — Supabase Realtime presence on a private, membership-gated channel. */
export function usePresence(orgId: string, me: Profile, onJoin?: (p: Peer) => void) {
  const joinRef = useRef(onJoin);
  joinRef.current = onJoin;
  const sb = useMemo(() => createClient(), []);
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;
    (async () => {
      try {
        await sb.realtime.setAuth();
      } catch {
        /* session refresh failed — the subscribe below simply won't authorize */
      }
      if (cancelled) return;
      channel = sb.channel(`presence:org:${orgId}`, { config: { private: true, presence: { key: me.id } } });
      const sync = () => {
        const state = channel!.presenceState<Peer>();
        const list: Peer[] = Object.values(state).map((arr) => arr[0]).filter(Boolean);
        setPeers(list);
      };
      let ready = false; // ignore the initial roll-call; only announce people who arrive later
      channel
        .on("presence", { event: "sync" }, () => { sync(); setTimeout(() => { ready = true; }, 1500); })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          if (!ready || key === me.id) return;
          const p = (newPresences?.[0] ?? null) as unknown as Peer | null;
          if (p) joinRef.current?.(p);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ id: me.id, name: me.name, email: me.email, avatarColor: me.avatarColor, avatarUrl: me.avatarUrl });
          }
        });
    })();
    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
    // re-announce when the person's own name/color changes
  }, [sb, orgId, me.id, me.name, me.email, me.avatarColor, me.avatarUrl]);

  return peers;
}

export function PresenceStack({ peers, meId }: { peers: Peer[]; meId: string }) {
  const t = useT();
  const sorted = [...peers].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.name.localeCompare(b.name)));
  if (sorted.length === 0) return null;
  const shown = sorted.slice(0, 5);
  const extra = sorted.length - shown.length;
  const label = sorted.map((p) => (p.name || p.email) + (p.id === meId ? ` (${t("you", "Sie")})` : "")).join(", ");
  return (
    <div className="flex items-center" title={`${t("Online now", "Jetzt online")}: ${label}`}>
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <span key={p.id} className="inline-flex flex-none rounded-full" style={{ boxShadow: "0 0 0 2px var(--tint-solid)" }}>
            <Avatar p={p} size={26} online />
          </span>
        ))}
      </div>
      {extra > 0 && <span className="ml-2 text-[0.72rem] text-muted">+{extra}</span>}
    </div>
  );
}
