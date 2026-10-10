-- 1. Enterprise roles are protected in the database, not only in the UI.
--    Signed-in users may change only the color of an enterprise role copy; only the
--    organization functions (security definer) may add, rename or remove them.
create or replace function private.guard_enterprise_actor() returns trigger language plpgsql as $f$
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' then
      if new.enterprise_id is not null then raise exception 'enterprise roles are managed by the organization'; end if;
      return new;
    elsif tg_op = 'UPDATE' then
      if old.enterprise_id is not null and (new.name is distinct from old.name or new.role is distinct from old.role
         or new.kind is distinct from old.kind or new.enterprise_id is distinct from old.enterprise_id or new.org_id is distinct from old.org_id) then
        raise exception 'enterprise roles can only change color here';
      end if;
      if old.enterprise_id is null and new.enterprise_id is not null then raise exception 'not allowed'; end if;
      return new;
    else
      if old.enterprise_id is not null then raise exception 'enterprise roles are managed by the organization'; end if;
      return old;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $f$;

drop trigger if exists guard_enterprise_actor on public.actors;
create trigger guard_enterprise_actor before insert or update or delete on public.actors
  for each row execute function private.guard_enterprise_actor();

-- 2. Expired license terms: everything except the License tab is closed.
create or replace function public.my_expired_workspaces() returns json
language sql stable security definer set search_path to 'public' as $f$
  select coalesce(json_agg(json_build_object(
    'id', o.id, 'name', o.name, 'org', g.name, 'term_end', g.term_end,
    'contacts', (select coalesce(json_agg(json_build_object('email', u.email, 'name', u.raw_user_meta_data->>'full_name')), '[]'::json)
                 from organization_members om join auth.users u on u.id = om.user_id
                 where om.organization_id = g.id and om.role = 'owner'))), '[]'::json)
  from memberships m
  join orgs o on o.id = m.org_id
  join organizations g on g.id = o.organization_id
  where m.user_id = auth.uid()
    and g.term_end is not null and g.term_end < current_date
    and not private.is_platform_admin();
$f$;
