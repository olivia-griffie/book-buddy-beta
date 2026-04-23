create table if not exists public.user_projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_projects_user_updated_idx
  on public.user_projects (user_id, updated_at desc);

alter table public.user_projects enable row level security;

drop policy if exists "users can read their own projects" on public.user_projects;
create policy "users can read their own projects"
  on public.user_projects
  for select
  using (auth.uid() = user_id);

drop policy if exists "users can create their own projects" on public.user_projects;
create policy "users can create their own projects"
  on public.user_projects
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update their own projects" on public.user_projects;
create policy "users can update their own projects"
  on public.user_projects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete their own projects" on public.user_projects;
create policy "users can delete their own projects"
  on public.user_projects
  for delete
  using (auth.uid() = user_id);
