-- Comments on steps (shown as a badge on the step). Anyone in the workspace can read and
-- write; people delete their own comments, owners/admins can delete any.
create table if not exists public.flow_comments (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  node_id uuid not null references public.flow_nodes(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists flow_comments_node_idx on public.flow_comments (node_id, created_at);
create index if not exists flow_comments_workflow_idx on public.flow_comments (workflow_id);

alter table public.flow_comments enable row level security;

create policy "flow_comments_select" on public.flow_comments for select to authenticated
  using (exists (select 1 from public.workflows w where w.id = flow_comments.workflow_id and private.is_org_member(w.org_id)));

create policy "flow_comments_insert" on public.flow_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.workflows w where w.id = flow_comments.workflow_id and private.is_org_member(w.org_id))
  );

create policy "flow_comments_delete" on public.flow_comments for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.workflows w where w.id = flow_comments.workflow_id and private.org_role(w.org_id) in ('owner','admin'))
  );
