import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/workspaces";

const DELETE_KEYWORD = "DELETE";



// Permanently deletes a workspace. Only its owner may do this (also enforced by
// the orgs_delete RLS policy). Foreign keys cascade to processes, lanes, roles,
// steps, lines, plans, phases, memberships, invites and cached translations.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const orgId = body && typeof body.orgId === "string" ? body.orgId : null;
  const keyword = body && typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!orgId) return NextResponse.json({ error: "orgId is required." }, { status: 400 });
  if (keyword !== DELETE_KEYWORD) return NextResponse.json({ error: "Keyword does not match." }, { status: 400 });

  const { data: m } = await sb.from("memberships").select("role").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!m || m.role !== "owner") return NextResponse.json({ error: "Only the workspace owner can delete it." }, { status: 403 });

  const { data: gone, error } = await sb.from("orgs").delete().eq("id", orgId).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!gone || gone.length === 0) return NextResponse.json({ error: "Nothing was deleted." }, { status: 500 });

  const jar = await cookies();
  if (jar.get(ACTIVE_ORG_COOKIE)?.value === orgId) jar.delete(ACTIVE_ORG_COOKIE);
  return NextResponse.json({ ok: true });
}
