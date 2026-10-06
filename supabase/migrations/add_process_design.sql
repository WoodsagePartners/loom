-- Process design: actors, process steps, and the flow between steps.
--
-- A thread can now carry a process map. Steps live on the thread; each step
-- is done by an ACTOR today (actor_id) and may be proposed to move to a
-- different actor (proposed_actor_id), which is how "this human step becomes
-- an AI/system step" is expressed. Swimlane view = lane by actor_id (as-is)
-- or by proposed_actor_id (to-be).
--
-- Tenancy: every row is reachable only through an org the caller belongs to,
-- using the same is_org_member() check as every other thread-scoped table.
-- Cross-tenant references (a step pointing at another client's actor) are
-- blocked in the WITH CHECK clauses, not just by app code.
--
-- NOT touched here: memberships roles, invites, org switching. Those need a
-- look at the live schema first (see the build plan).

-- ---------------------------------------------------------------- actors --
create table if not exists public.actors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  kind text not null check (kind in ('person', 'role', 'system', 'ai')),
  name text not null,
  member_user_id uuid references auth.users(id) on delete set null,
  color text,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- only a 'person' actor can be linked to a real workspace member
  constraint actors_member_only_for_person check (member_user_id is null or kind = 'person')
);

create index if not exists actors_org_id_idx on public.actors (org_id);
create unique index if not exists actors_org_member_uniq
  on public.actors (org_id, member_user_id) where member_user_id is not null;

alter table public.actors enable row level security;

drop policy if exists "actors_select" on public.actors;
create policy "actors_select" on public.actors
  for select using (is_org_member(org_id));

drop policy if exists "actors_insert" on public.actors;
create policy "actors_insert" on public.actors
  for insert with check (is_org_member(org_id));

drop policy if exists "actors_update" on public.actors;
create policy "actors_update" on public.actors
  for update using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists "actors_delete" on public.actors;
create policy "actors_delete" on public.actors
  for delete using (is_org_member(org_id));

-- --------------------------------------------------------- process_steps --
create table if not exists public.process_steps (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  title text not null,
  detail text,
  actor_id uuid references public.actors(id) on delete set null,
  proposed_actor_id uuid references public.actors(id) on delete set null,
  disposition text not null default 'undecided'
    check (disposition in ('undecided', 'keep', 'assist', 'automate', 'eliminate')),
  pain text,
  minutes_per_run numeric check (minutes_per_run is null or minutes_per_run >= 0),
  runs_per_month numeric check (runs_per_month is null or runs_per_month >= 0),
  seq integer not null default 0,
  position_x double precision,
  position_y double precision,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists process_steps_thread_id_idx on public.process_steps (thread_id);
create index if not exists process_steps_actor_id_idx on public.process_steps (actor_id);
create index if not exists process_steps_proposed_actor_id_idx on public.process_steps (proposed_actor_id);

alter table public.process_steps enable row level security;

drop policy if exists "process_steps_select" on public.process_steps;
create policy "process_steps_select" on public.process_steps
  for select using (
    exists (select 1 from public.threads t
            where t.id = process_steps.thread_id and is_org_member(t.org_id))
  );

-- Write check: caller is in the thread's org, AND any actor referenced
-- belongs to that same org (no pointing at another client's actors).
drop policy if exists "process_steps_insert" on public.process_steps;
create policy "process_steps_insert" on public.process_steps
  for insert with check (
    exists (select 1 from public.threads t
            where t.id = process_steps.thread_id and is_org_member(t.org_id))
    and (process_steps.actor_id is null or exists (
          select 1 from public.actors a join public.threads t on t.id = process_steps.thread_id
          where a.id = process_steps.actor_id and a.org_id = t.org_id))
    and (process_steps.proposed_actor_id is null or exists (
          select 1 from public.actors a join public.threads t on t.id = process_steps.thread_id
          where a.id = process_steps.proposed_actor_id and a.org_id = t.org_id))
  );

drop policy if exists "process_steps_update" on public.process_steps;
create policy "process_steps_update" on public.process_steps
  for update
  using (
    exists (select 1 from public.threads t
            where t.id = process_steps.thread_id and is_org_member(t.org_id))
  )
  with check (
    exists (select 1 from public.threads t
            where t.id = process_steps.thread_id and is_org_member(t.org_id))
    and (process_steps.actor_id is null or exists (
          select 1 from public.actors a join public.threads t on t.id = process_steps.thread_id
          where a.id = process_steps.actor_id and a.org_id = t.org_id))
    and (process_steps.proposed_actor_id is null or exists (
          select 1 from public.actors a join public.threads t on t.id = process_steps.thread_id
          where a.id = process_steps.proposed_actor_id and a.org_id = t.org_id))
  );

drop policy if exists "process_steps_delete" on public.process_steps;
create policy "process_steps_delete" on public.process_steps
  for delete using (
    exists (select 1 from public.threads t
            where t.id = process_steps.thread_id and is_org_member(t.org_id))
  );

-- keep updated_at honest without trusting the client
create or replace function public.touch_process_step()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists process_steps_touch on public.process_steps;
create trigger process_steps_touch
  before update on public.process_steps
  for each row execute function public.touch_process_step();

-- ------------------------------------------------------------ step_edges --
-- Flow between steps. Explicit rows (not implied by seq) so branches and
-- merges work and xyflow can draw them directly.
create table if not exists public.step_edges (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  from_step_id uuid not null references public.process_steps(id) on delete cascade,
  to_step_id uuid not null references public.process_steps(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  unique (from_step_id, to_step_id),
  check (from_step_id <> to_step_id)
);

create index if not exists step_edges_thread_id_idx on public.step_edges (thread_id);
create index if not exists step_edges_from_idx on public.step_edges (from_step_id);
create index if not exists step_edges_to_idx on public.step_edges (to_step_id);

alter table public.step_edges enable row level security;

drop policy if exists "step_edges_select" on public.step_edges;
create policy "step_edges_select" on public.step_edges
  for select using (
    exists (select 1 from public.threads t
            where t.id = step_edges.thread_id and is_org_member(t.org_id))
  );

-- Both endpoints must be steps of the SAME thread the edge claims.
drop policy if exists "step_edges_insert" on public.step_edges;
create policy "step_edges_insert" on public.step_edges
  for insert with check (
    exists (select 1 from public.threads t
            where t.id = step_edges.thread_id and is_org_member(t.org_id))
    and exists (select 1 from public.process_steps s
                where s.id = step_edges.from_step_id and s.thread_id = step_edges.thread_id)
    and exists (select 1 from public.process_steps s
                where s.id = step_edges.to_step_id and s.thread_id = step_edges.thread_id)
  );

drop policy if exists "step_edges_update" on public.step_edges;
create policy "step_edges_update" on public.step_edges
  for update
  using (
    exists (select 1 from public.threads t
            where t.id = step_edges.thread_id and is_org_member(t.org_id))
  )
  with check (
    exists (select 1 from public.process_steps s
            where s.id = step_edges.from_step_id and s.thread_id = step_edges.thread_id)
    and exists (select 1 from public.process_steps s
                where s.id = step_edges.to_step_id and s.thread_id = step_edges.thread_id)
  );

drop policy if exists "step_edges_delete" on public.step_edges;
create policy "step_edges_delete" on public.step_edges
  for delete using (
    exists (select 1 from public.threads t
            where t.id = step_edges.thread_id and is_org_member(t.org_id))
  );

-- ------------------------------------- knots can hang off a process step --
-- Lets a Loom provocation ("why does this step exist?") attach to the step
-- it was pulled from. Nullable, so every existing knot is untouched.
alter table public.nodes
  add column if not exists step_id uuid references public.process_steps(id) on delete set null;
create index if not exists nodes_step_id_idx on public.nodes (step_id);

-- --------------------------------------------------------------- realtime --
-- Live updates across teammates on the same thread. Each block tolerates the
-- table already being in the publication.
do $$ begin
  alter publication supabase_realtime add table public.actors;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.process_steps;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.step_edges;
exception when duplicate_object then null; when undefined_object then null; end $$;
