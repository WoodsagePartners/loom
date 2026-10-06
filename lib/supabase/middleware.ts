import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refreshes the Supabase auth session on every request so server components
// always see a valid, non-expired user. Called from middleware.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /auth/callback must stay reachable while signed out — it is the page that
  // turns a magic-link code into a session.
  const isPublic = path.startsWith("/login") || path.startsWith("/auth/");
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Remember where they were headed (e.g. an invite link) so sign-in can
    // bring them back. Cookie, not a query param: it survives the magic-link
    // round trip regardless of Supabase's redirect allowlist.
    if (path !== "/" && path !== "/dashboard") {
      redirect.cookies.set("loom_next", path, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 3600 });
    }
    return redirect;
  }

  return response;
}
