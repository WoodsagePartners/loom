-- Display names for team members (members of the org only). Safe to re-run.
create or replace function public.team_member_names(target_org uuid)
returns table(user_id uuid, full_name text)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, nullif(trim(coalesce(u.raw_user_meta_data->>'full_name','')), '')
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = target_org and private.is_org_member(target_org);
$$;
revoke all on function public.team_member_names(uuid) from public, anon;
grant execute on function public.team_member_names(uuid) to authenticated;
