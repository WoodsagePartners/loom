export type OrgWorkspace = {
  id: string; name: string; description: string | null; goal: string | null; locked: boolean; archived: boolean;
  last_edited: string | null; members: number; processes: string[]; pursuits: number;
};
export type OrgPerson = { id: string; email: string; org_role: "owner" | "admin" | null; workspaces: number; deactivated: boolean };
export type OrgAck = { version: string; accepted_at: string };
export type OrgPursuit = { id: string; kind: string; status: string; headline: string | null; pursued_at: string; workspace: string; process: string };
export type OrgRole = { id: string; name: string; role: string | null; kind: string; color: string | null; workspace: string; steps: number };
export type OrgView = {
  org: { id: string; name: string; workspace_limit: number; user_limit: number; term_end: string | null; term_start: string | null; contact_name: string | null; contact_email: string | null; billing_notes: string | null; logo_path: string | null; ai_credits: number };
  my_role: "owner" | "admin" | null;
  users: number;
  workspaces: OrgWorkspace[];
  people: OrgPerson[];
  acks: OrgAck[];
  pursuits: OrgPursuit[];
  roles: OrgRole[];
};
export const PROCESSOR_VERSION = "2026-10";
