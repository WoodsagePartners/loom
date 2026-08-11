import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the magic-link redirect: exchanges the code for a session, then
// sends first-time users into org setup and everyone else to the dashboard.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: memberships } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user?.id ?? "");

      const dest = memberships && memberships.length > 0 ? "/dashboard" : "/onboarding";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
