-- Applied to the live Loom project 2026-10-06 (via ALTER POLICY, not DROP).
--
-- Bug: memberships_insert_self compared m2.org_id = m2.org_id (always true).
-- Effect: anyone already in ANY org could never create another workspace, and
-- a user with no memberships could add themselves to ANY org they had the id
-- of. Fix: you may add yourself only as OWNER of an org YOU created that has
-- no members yet. org_has_members() is SECURITY DEFINER so RLS can't hide
-- existing members from the check.

create unique index if not exists memberships_org_user_uniq
  on public.memberships (org_id, user_id);

create or replace function public.org_has_members(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from memberships m where m.org_id = target_org); $$;

revoke all on function public.org_has_members(uuid) from public, anon;
grant execute on function public.org_has_members(uuid) to authenticated;

alter policy "memberships_insert_self" on public.memberships
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (select 1 from public.orgs o where o.id = memberships.org_id and o.created_by = auth.uid())
    and not public.org_has_members(memberships.org_id)
  );

-- Invitees can't read invites (RLS is members-only), so this is the one way
-- in: token + signed-in email matches + unused + under 14 days old.
create or replace function public.accept_invite(invite_token uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  inv invites%rowtype;
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if uid is null then raise exception 'Not signed in.'; end if;

  select * into inv from invites where token = invite_token for update;
  if not found then raise exception 'Invite not found.'; end if;
  if inv.accepted_at is not null then raise exception 'This invite was already used.'; end if;
  if inv.created_at < now() - interval '14 days' then raise exception 'This invite has expired.'; end if;
  if lower(inv.email) <> mail then raise exception 'This invite was sent to a different email address.'; end if;

  insert into memberships (org_id, user_id, role)
  values (inv.org_id, uid, inv.role)
  on conflict (org_id, user_id) do nothing;

  update invites set accepted_at = now() where id = inv.id;
  return inv.org_id;
end $$;

revoke all on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;
