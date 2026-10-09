-- Layer (z=1): Questions, Insights and Ideas pinned to steps and lines.
-- Signals (Loom's own suggestions) are computed in the app; promoting or dismissing one
-- leaves a pin whose `origin` is the signal key, so it never reappears.

create table if not exists public.flow_pins (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  node_id uuid references public.flow_nodes(id) on delete cascade,
  edge_id uuid references public.flow_edges(id) on delete cascade,
  parent_id uuid references public.flow_pins(id) on delete cascade,
  kind text not null check (kind in ('question', 'insight', 'idea')),
  body text not null default '',
  status text not null default 'open' check (status in ('open', 'active', 'done', 'dismissed')),
  origin text,
  author_id uuid not null default auth.uid(),
  author_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (node_id is not null or edge_id is not null)
);
create index if not exists flow_pins_workflow_idx on public.flow_pins (workflow_id);
create index if not exists flow_pins_node_idx on public.flow_pins (node_id);
create index if not exists flow_pins_edge_idx on public.flow_pins (edge_id);

alter table public.flow_pins enable row level security;
drop policy if exists flow_pins_select on public.flow_pins;
drop policy if exists flow_pins_insert on public.flow_pins;
drop policy if exists flow_pins_update on public.flow_pins;
drop policy if exists flow_pins_delete on public.flow_pins;
create policy flow_pins_select on public.flow_pins for select using (private.workflow_member(workflow_id));
create policy flow_pins_insert on public.flow_pins for insert with check (private.workflow_member(workflow_id) and author_id = auth.uid());
create policy flow_pins_update on public.flow_pins for update using (private.workflow_member(workflow_id)) with check (private.workflow_member(workflow_id));
create policy flow_pins_delete on public.flow_pins for delete using (private.workflow_member(workflow_id));

-- v2: "insight" kind renamed "finding"; ideas can carry a short reason ("support")
-- and, once worth pursuing, a plan phase they are scheduled into.
alter table public.flow_pins drop constraint if exists flow_pins_kind_check;
update public.flow_pins set kind = 'finding' where kind = 'insight';
alter table public.flow_pins add constraint flow_pins_kind_check check (kind in ('question', 'finding', 'idea'));
alter table public.flow_pins add column if not exists support text;
alter table public.flow_pins add column if not exists phase_id uuid references public.roadmap_phases(id) on delete set null;

-- v3: pursuits. Any pin can be pursued; the lineage (signal > question > finding > idea, plus the step) is frozen at that moment.
alter table public.flow_pins add column if not exists pursued_at timestamptz;
alter table public.flow_pins add column if not exists lineage jsonb;

-- v4: a three-word headline for each pursuit
alter table public.flow_pins add column if not exists headline text;
