create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz null,
  last_message_preview text not null default ''
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc nulls last, updated_at desc);

create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants (user_id, conversation_id);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at asc);

create index if not exists direct_messages_unread_idx
  on public.direct_messages (conversation_id, read_at)
  where read_at is null;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.direct_messages enable row level security;

create policy "conversation participants can read conversations"
  on public.conversations
  for select
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

create policy "authenticated users can create conversations"
  on public.conversations
  for insert
  with check (auth.uid() is not null);

create policy "participants can update their conversations"
  on public.conversations
  for update
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

create policy "participants can read conversation participants"
  on public.conversation_participants
  for select
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "participants can add conversation participants"
  on public.conversation_participants
  for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "participants can read direct messages"
  on public.direct_messages
  for select
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = direct_messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "participants can send direct messages"
  on public.direct_messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = direct_messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "participants can mark received messages as read"
  on public.direct_messages
  for update
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = direct_messages.conversation_id
        and cp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = direct_messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );
