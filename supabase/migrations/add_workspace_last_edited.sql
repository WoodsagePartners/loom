-- "Last edited" for each workspace, shown on the Workspaces page.
-- Any change to a workspace's processes, lanes, steps, lines, roles, plans or comments
-- stamps orgs.last_edited_at (at most once every 30 seconds, so dragging stays cheap).
alter table public.orgs add column if not exists last_edited_at timestamptz;

create or replace function private.touch_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_org uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_table_name in ('workflows', 'actors') then
    v_org := r.org_id;
  else
    select w.org_id into v_org from public.workflows w where w.id = r.workflow_id;
  end if;
  if v_org is not null then
    update public.orgs
       set last_edited_at = now()
     where id = v_org
       and (last_edited_at is null or last_edited_at < now() - interval '30 seconds');
  end if;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['workflows','actors','lanes','flow_nodes','flow_edges','roadmaps','roadmap_phases','phase_nodes','flow_comments']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists touch_org_%1$s on public.%1$I', t);
      execute format('create trigger touch_org_%1$s after insert or update or delete on public.%1$I for each row execute function private.touch_org()', t);
    end if;
  end loop;
end $$;

-- start every existing workspace at its latest known activity
update public.orgs o
   set last_edited_at = coalesce(
     (select max(w.created_at) from public.workflows w where w.org_id = o.id),
     o.created_at)
 where last_edited_at is null;
