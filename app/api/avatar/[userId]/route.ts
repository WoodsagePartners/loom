import { createClient } from "@/lib/supabase/server";

// Profile photos live in a private bucket. This route streams a photo only to
// signed-in users who share a workspace with its owner (enforced by storage RLS).
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return new Response("Not found", { status: 404 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return new Response("Unauthorized", { status: 401 });

  const { data: files } = await sb.storage.from("avatars").list(userId, { limit: 20 });
  const latest = (files ?? []).filter((f) => f.name.startsWith("avatar-")).sort((a, b) => (a.name < b.name ? 1 : -1))[0];
  if (!latest) return new Response("Not found", { status: 404 });
  const { data: blob } = await sb.storage.from("avatars").download(`${userId}/${latest.name}`);
  if (!blob) return new Response("Not found", { status: 404 });
  return new Response(blob, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" } });
}
