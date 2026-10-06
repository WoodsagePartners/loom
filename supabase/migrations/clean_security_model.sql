-- Applied to the live Loom project 2026-10-06, as a series of statements.
-- (Written with ALTER POLICY rather than DROP; DROP statements stall behind a
-- confirmation prompt in the Supabase tooling.)
--
-- ROLE MODEL     owner > admin > member
--   owner   everything; the workspace creator is the first owner and can
--           invite teammates, make co-owners, remove anyone.
--   admin   invite/remove members, change member<->admin. Cannot touch
--           owners, cannot grant owner, cannot edit own role.
--   member  work in the workspace. Cannot see invites or tokens.
-- Nobody adds another user directly. You join by accepting an invite
-- (public.accept_invite) or by creating a workspace you own.
-- A workspace always keeps at least one owner.
-- Tenancy columns (org_id, thread_id, ...) are frozen after insert, so a
-- member of two client workspaces can't move data between them.
--
-- EXPOSURE       helper functions live in schema "private" (not reachable via
--   the REST API). anon has no table or function access at all. authenticated
--   has no TRUNCATE/TRIGGER/REFERENCES. All policies are TO authenticated.
--   public.accept_invite is the single intentional RPC.
--
-- IMPORTANT for future migrations: call private.is_org_member(...) and
-- private.org_role(...), not public.*. A policy on table X must never query X
-- directly (infinite recursion); use a SECURITY DEFINER helper such as
-- private.node_in_thread().

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_org_member(uuid) set schema private;
alter function public.org_role(uuid) set schema private;
alter function public.org_has_members(uuid) set schema private;
revoke all on function private.is_org_member(uuid), private.org_role(uuid), private.org_has_members(uuid) from public, anon;
grant execute on function private.is_org_member(uuid), private.org_role(uuid), private.org_has_members(uuid) to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
revoke truncate, trigger, references on all tables in schema public from authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('alter policy %I on public.%I to authenticated', r.policyname, r.tablename);
  end loop;
end $$;

alter policy "memberships_update" on public.memberships
  using (private.org_role(org_id) = 'owner'
         or (private.org_role(org_id) = 'admin' and role <> 'owner' and user_id <> auth.uid()))
  with check (private.org_role(org_id) = 'owner'
              or (private.org_role(org_id) = 'admin' and role <> 'owner'));

alter policy "memberships_delete" on public.memberships
  using (private.org_role(org_id) = 'owner'
         or (private.org_role(org_id) = 'admin' and role <> 'owner')
         or user_id = auth.uid());

alter policy "memberships_insert_admin" on public.memberships rename to "memberships_insert_blocked_use_invites";
alter policy "memberships_insert_blocked_use_invites" on public.memberships with check (false);

alter policy "invites_select" on public.invites using (private.org_role(org_id) in ('owner', 'admin'));
alter policy "invites_insert" on public.invites
  with check (invited_by = auth.uid()
              and private.org_role(org_id) in ('owner', 'admin')
              and (role <> 'owner' or private.org_role(org_id) = 'owner')
              and position('@' in email) > 1);

create unique index if not exists invites_open_org_email_uniq
  on public.invites (org_id, lower(email)) where accepted_at is null;

create or replace function private.freeze_cols()
returns trigger language plpgsql set search_path = public
as $$
declare c text;
begin
  foreach c in array tg_argv loop
    if to_jsonb(new) -> c is distinct from to_jsonb(old) -> c then
      raise exception 'Column "%" on % cannot be changed.', c, tg_table_name using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

create trigger orgs_freeze before update on public.orgs for each row execute function private.freeze_cols('id', 'created_by');
create trigger memberships_freeze before update on public.memberships for each row execute function private.freeze_cols('org_id', 'user_id');
create trigger invites_freeze before update on public.invites for each row execute function private.freeze_cols('org_id', 'token', 'email', 'role', 'invited_by');
create trigger threads_freeze before update on public.threads for each row execute function private.freeze_cols('org_id');
create trigger nodes_freeze before update on public.nodes for each row execute function private.freeze_cols('thread_id');
create trigger node_edges_freeze before update on public.node_edges for each row execute function private.freeze_cols('thread_id');
create trigger fibers_freeze before update on public.fibers for each row execute function private.freeze_cols('thread_id');
create trigger library_techniques_freeze before update on public.library_techniques for each row execute function private.freeze_cols('org_id');
create trigger job_queue_freeze before update on public.job_queue for each row execute function private.freeze_cols('org_id');
create trigger proposed_threads_freeze before update on public.proposed_threads for each row execute function private.freeze_cols('org_id');
create trigger actors_freeze before update on public.actors for each row execute function private.freeze_cols('org_id');
create trigger process_steps_freeze before update on public.process_steps for each row execute function private.freeze_cols('thread_id');
create trigger step_edges_freeze before update on public.step_edges for each row execute function private.freeze_cols('thread_id');

create or replace function private.guard_last_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if exists (select 1 from orgs o where o.id = old.org_id)
       and not exists (select 1 from memberships m where m.org_id = old.org_id and m.role = 'owner' and m.id <> old.id) then
      raise exception 'A workspace must keep at least one owner. Make someone else an owner first.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger memberships_last_owner before update or delete on public.memberships
  for each row execute function private.guard_last_owner();

create or replace function private.node_in_thread(target_node uuid, target_thread uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from nodes n where n.id = target_node and n.thread_id = target_thread); $$;
revoke all on function private.node_in_thread(uuid, uuid) from public, anon;
grant execute on function private.node_in_thread(uuid, uuid) to authenticated;

alter policy "nodes_insert" on public.nodes
  with check (exists (select 1 from threads t where t.id = nodes.thread_id and private.is_org_member(t.org_id))
              and (nodes.parent_id is null or private.node_in_thread(nodes.parent_id, nodes.thread_id)));

alter policy "node_edges_insert" on public.node_edges
  with check (exists (select 1 from threads t where t.id = node_edges.thread_id and private.is_org_member(t.org_id))
              and private.node_in_thread(node_edges.from_node_id, node_edges.thread_id)
              and private.node_in_thread(node_edges.to_node_id, node_edges.thread_id));
