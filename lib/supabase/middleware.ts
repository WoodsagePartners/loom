import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refreshes the Supabase auth session on every request so server components
// always see a valid, non-expired user. Called from middleware.ts.
export async function updateSession(request: NextRequest) {
  // "Keep me signed in" unchecked: login sets loom_session_only (persistent) and
  // loom_alive (a session cookie that vanishes when the browser closes). If the
  // flag is there but the session cookie is gone, the browser was restarted, so
  // the sign-in is dropped.
  const staleAuth: string[] = [];
  if (request.cookies.get("loom_session_only")?.value === "1" && !request.cookies.get("loom_alive")) {
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-")) {
        staleAuth.push(c.name);
        request.cookies.delete(c.name);
      }
    }
  }
  const expire = <T extends NextResponse>(res: T): T => {
    staleAuth.forEach((n) => res.cookies.set(n, "", { path: "/", maxAge: 0 }));
    return res;
  };
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
  const isPublic = path.startsWith("/login") || path.startsWith("/auth/") || ["/privacy", "/terms", "/processor"].includes(path);
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Invite links open the login screen in "create your account" mode.
    if (path.startsWith("/invite/")) url.searchParams.set("invite", path.slice("/invite/".length).split("/")[0] || "1");
    const redirect = NextResponse.redirect(url);
    // Remember where they were headed (e.g. an invite link) so sign-in can
    // bring them back. Cookie, not a query param: it survives the magic-link
    // round trip regardless of Supabase's redirect allowlist.
    if (path !== "/" && path !== "/dashboard") {
      redirect.cookies.set("loom_next", path, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 3600 });
    }
    return expire(redirect);
  }

  return expire(response);
}
