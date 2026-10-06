import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NEXT_COOKIE, safeNextPath } from "@/lib/workspaces";

// Post-password-login landing: honors a remembered destination (such as an
// invite link), otherwise dashboard — or onboarding for brand-new users.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const jar = await cookies();
  const next = safeNextPath(jar.get(NEXT_COOKIE)?.value);
  if (next) {
    jar.delete(NEXT_COOKIE);
    return NextResponse.redirect(`${origin}${next}`);
  }

  const { data: memberships } = await supabase.from("memberships").select("org_id").eq("user_id", user.id);
  return NextResponse.redirect(`${origin}${memberships && memberships.length > 0 ? "/dashboard" : "/onboarding"}`);
}
