-- Run this once in the Supabase SQL editor (the assistant's connection stalls on statements that delete rows).
-- Adds: remove a person from an organization, delete a role, delete a workspace (organization owners only).

create or replace function public.org_remove_user(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if private.organization_role(p_org) is null then raise exception 'not allowed'; end if;
  if p_user = auth.uid() then raise exception 'use another owner to remove yourself'; end if;
  if exists (select 1 from organization_members where organization_id = p_org and user_id = p_user and role = 'owner')
     and private.organization_role(p_org) <> 'owner' then raise exception 'only owners can remove owners'; end if;
  delete from organization_members where organization_id = p_org and user_id = p_user;
  delete from memberships where user_id = p_user and org_id in (select id from orgs where organization_id = p_org);
end $$;

create or replace function public.org_delete_role(p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  select o.organization_id into oid from actors a join orgs o on o.id = a.org_id where a.id = p_actor;
  if oid is null or private.organization_role(oid) is null then raise exception 'not allowed'; end if;
  delete from actors where id = p_actor;
end $$;

revoke all on function public.org_remove_user(uuid,uuid), public.org_delete_role(uuid) from public, anon;
grant execute on function public.org_remove_user(uuid,uuid), public.org_delete_role(uuid) to authenticated;

create or replace function public.org_delete_enterprise_role(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  select organization_id into oid from organization_roles where id = p_id;
  if oid is null or private.organization_role(oid) is null then raise exception 'not allowed'; end if;
  delete from actors where enterprise_id = p_id;
  delete from organization_roles where id = p_id;
end $$;

revoke all on function public.org_delete_enterprise_role(uuid) from public, anon;
grant execute on function public.org_delete_enterprise_role(uuid) to authenticated;
