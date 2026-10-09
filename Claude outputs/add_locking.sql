-- Locking: owners/admins can lock a single process or a whole workspace.
-- Enforced in the database (not just the UI). Comments stay open on locked processes.

alter table public.workflows add column if not exists locked boolean not null default false;
alter table public.workflows add column if not exists locked_at timestamptz;
alter table public.workflows add column if not exists locked_by uuid;
alter table public.orgs add column if not exists locked boolean not null default false;
alter table public.orgs add column if not exists locked_at timestamptz;
alter table public.orgs add column if not exists locked_by uuid;

create or replace function public.loom_is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- Only owners/admins may flip a lock; stamps who and when.
create or replace function public.loom_guard_lock_toggle()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if new.locked is distinct from old.locked then
    v_org := case when tg_table_name = 'orgs' then new.id else new.org_id end;
    if auth.uid() is not null and not public.loom_is_org_admin(v_org) then
      raise exception 'Only owners and admins can lock or unlock.';
    end if;
    new.locked_at := case when new.locked then now() else null end;
    new.locked_by := case when new.locked then auth.uid() else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists loom_lock_toggle on public.workflows;
create trigger loom_lock_toggle before update on public.workflows
  for each row execute function public.loom_guard_lock_toggle();
drop trigger if exists loom_lock_toggle on public.orgs;
create trigger loom_lock_toggle before update on public.orgs
  for each row execute function public.loom_guard_lock_toggle();

-- Blocks changes to locked processes / locked workspaces.
create or replace function public.loom_enforce_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb;
  v_wf uuid;
  v_org uuid;
  v_wf_locked boolean := false;
  v_org_locked boolean := false;
begin
  -- service role / system jobs and cascades (e.g. deleting a workspace) pass through
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  j := to_jsonb(case when tg_op = 'DELETE' then old else new end);

  if tg_table_name = 'actors' then
    v_org := (j ->> 'org_id')::uuid;
  elsif tg_table_name = 'workflows' then
    v_wf := (j ->> 'id')::uuid;
    v_org := (j ->> 'org_id')::uuid;
    if tg_op = 'UPDATE' then
      -- lock/unlock itself is allowed (admin check lives in loom_guard_lock_toggle)
      if (to_jsonb(new) - 'locked' - 'locked_at' - 'locked_by')
         is not distinct from (to_jsonb(old) - 'locked' - 'locked_at' - 'locked_by') then
        return new;
      end if;
    end if;
  else
    v_wf := (j ->> 'workflow_id')::uuid;
  end if;

  if v_wf is not null and tg_table_name <> 'workflows' then
    select w.org_id into v_org from public.workflows w where w.id = v_wf;
  end if;
  if v_org is not null then
    select o.locked into v_org_locked from public.orgs o where o.id = v_org;
  end if;
  if v_org_locked then
    raise exception 'This workspace is locked. Unlock it to make changes.';
  end if;

  if v_wf is not null then
    if tg_table_name = 'workflows' then
      if tg_op in ('UPDATE', 'DELETE') then
        select locked into v_wf_locked from public.workflows where id = v_wf;
      end if;
    else
      select locked into v_wf_locked from public.workflows where id = v_wf;
    end if;
    if coalesce(v_wf_locked, false) then
      raise exception 'This process is locked. Unlock it to make changes.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['flow_nodes', 'flow_edges', 'lanes', 'roadmaps', 'roadmap_phases', 'phase_nodes', 'workflows', 'actors']
  loop
    execute format('drop trigger if exists loom_enforce_lock on public.%I', t);
    execute format('create trigger loom_enforce_lock before insert or update or delete on public.%I for each row execute function public.loom_enforce_lock()', t);
  end loop;
end $$;
