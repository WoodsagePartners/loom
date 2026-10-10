import { redirect } from "next/navigation";

// The page used to live at /workspaces; keep old links and bookmarks working.
export default async function OldWorkspacesRedirect({ searchParams }: { searchParams: Promise<{ redeem?: string }> }) {
  const sp = await searchParams;
  redirect(sp.redeem === "1" ? "/loomfloor?redeem=1" : "/loomfloor");
}
