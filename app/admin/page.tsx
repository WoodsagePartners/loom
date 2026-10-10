import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminView } from "@/components/admin-view";

export default async function AdminPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: pa } = await sb.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) redirect("/workspaces");
  const { data, error } = await sb.rpc("admin_overview");
  if (error || !data) redirect("/workspaces");
  return <AdminView data={data as any} />;
}
