-- DAG support: node_edges generalizes a knot's lineage beyond its one
-- primary parent_id. parent_id stays as-is (still drives the tree layout
-- and is untouched by this migration) — node_edges is where a future
-- "combine two lines of inquiry" feature will add a second (or third)
-- incoming edge to a synthesis knot. Until that feature writes to it, this
-- table mirrors the existing parent_id relationships and nothing more.

create table if not exists public.node_edges (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  from_node_id uuid not null references public.nodes(id) on delete cascade,
  to_node_id uuid not null references public.nodes(id) on delete cascade,
  relation text not null default 'derived',
  created_at timestamptz not null default now(),
  unique (from_node_id, to_node_id)
);

create index if not exists node_edges_to_node_id_idx on public.node_edges (to_node_id);
create index if not exists node_edges_from_node_id_idx on public.node_edges (from_node_id);
create index if not exists node_edges_thread_id_idx on public.node_edges (thread_id);

alter table public.node_edges enable row level security;

-- Same org-membership check every other thread-scoped table uses.
create policy "node_edges_select" on public.node_edges
  for select
  using (exists (select 1 from threads t where t.id = node_edges.thread_id and is_org_member(t.org_id)));

create policy "node_edges_insert" on public.node_edges
  for insert
  with check (exists (select 1 from threads t where t.id = node_edges.thread_id and is_org_member(t.org_id)));

create policy "node_edges_update" on public.node_edges
  for update
  using (exists (select 1 from threads t where t.id = node_edges.thread_id and is_org_member(t.org_id)));

create policy "node_edges_delete" on public.node_edges
  for delete
  using (exists (select 1 from threads t where t.id = node_edges.thread_id and is_org_member(t.org_id)));

-- Backfill: one edge per existing parent_id relationship. Root-level knots
-- (parent_id is null, attached straight to the question) get no row here —
-- the question isn't a real node, so there's nothing to point from.
insert into public.node_edges (thread_id, from_node_id, to_node_id, relation)
select thread_id, parent_id, id, 'derived'
from public.nodes
where parent_id is not null
on conflict (from_node_id, to_node_id) do nothing;
