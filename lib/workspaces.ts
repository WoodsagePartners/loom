export type WorkspaceRole = "owner" | "admin" | "member";

export type Workspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

// Remembers which workspace this browser last had open. The server verifies
// membership before honoring it, so it is a preference, never a permission.
export const ACTIVE_ORG_COOKIE = "loom_org";

// Where to send someone after sign-in (e.g. back to an invite link).
export const NEXT_COOKIE = "loom_next";

/** Only same-site, absolute paths. Blocks open redirects like //evil.com. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
