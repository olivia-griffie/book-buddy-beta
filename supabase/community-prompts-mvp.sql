create extension if not exists pgcrypto;

create table if not exists public.community_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  genre text not null,
  plot_point text not null,
  prompt text not null,
  target_word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_prompt_favorites (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.community_prompts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (prompt_id, user_id)
);

create table if not exists public.community_prompt_completions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.community_prompts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  responder_id uuid not null references public.profiles(id) on delete cascade,
  project_title text not null default '',
  chapter_title text not null default '',
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists community_prompts_updated_at_idx
  on public.community_prompts (updated_at desc, created_at desc);

create index if not exists community_prompt_favorites_user_idx
  on public.community_prompt_favorites (user_id, created_at desc);

create index if not exists community_prompt_completions_author_idx
  on public.community_prompt_completions (author_id, created_at desc);

alter table public.community_prompts enable row level security;
alter table public.community_prompt_favorites enable row level security;
alter table public.community_prompt_completions enable row level security;

drop policy if exists "community prompts are readable by everyone" on public.community_prompts;
create policy "community prompts are readable by everyone"
  on public.community_prompts
  for select
  using (true);

drop policy if exists "authenticated users can create community prompts" on public.community_prompts;
create policy "authenticated users can create community prompts"
  on public.community_prompts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update their own community prompts" on public.community_prompts;
create policy "users can update their own community prompts"
  on public.community_prompts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete their own community prompts" on public.community_prompts;
create policy "users can delete their own community prompts"
  on public.community_prompts
  for delete
  using (auth.uid() = user_id);

drop policy if exists "users can read their prompt favorites" on public.community_prompt_favorites;
create policy "users can read their prompt favorites"
  on public.community_prompt_favorites
  for select
  using (auth.uid() = user_id);

drop policy if exists "users can favorite prompts for themselves" on public.community_prompt_favorites;
create policy "users can favorite prompts for themselves"
  on public.community_prompt_favorites
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can remove their prompt favorites" on public.community_prompt_favorites;
create policy "users can remove their prompt favorites"
  on public.community_prompt_favorites
  for delete
  using (auth.uid() = user_id);

drop policy if exists "authors can read prompt completions" on public.community_prompt_completions;
create policy "authors can read prompt completions"
  on public.community_prompt_completions
  for select
  using (auth.uid() = author_id or auth.uid() = responder_id);

drop policy if exists "authenticated users can record prompt completions" on public.community_prompt_completions;
create policy "authenticated users can record prompt completions"
  on public.community_prompt_completions
  for insert
  with check (
    auth.uid() = responder_id
    and auth.uid() <> author_id
  );
