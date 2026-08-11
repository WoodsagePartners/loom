import { createBrowserClient } from "@supabase/ssr";

// Used in client components. Publishable key only — safe to ship to the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
