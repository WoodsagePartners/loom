export type OrgWorkspace = { id: string; name: string; description: string | null; locked: boolean; archived: boolean; members: number };
export type OrgPerson = { id: string; email: string; org_role: "owner" | "admin" | null; workspaces: number };
export type OrgAck = { version: string; accepted_at: string; email?: string | null };
export type OrgView = {
  org: { id: string; name: string; workspace_limit: number; user_limit: number; term_end: string | null; contact_name: string | null; contact_email: string | null; ai_credits: number };
  my_role: "owner" | "admin" | null;
  users: number;
  workspaces: OrgWorkspace[];
  people: OrgPerson[];
  acks: OrgAck[];
};
export const PROCESSOR_VERSION = "2026-10";
