-- Email notifications via Supabase Edge Function + pg_net
-- Run this in the Supabase Dashboard → SQL Editor after deploying the Edge Function.
--
-- Prerequisites:
--   1. pg_net extension enabled (Supabase enables this by default on new projects)
--   2. Edge Function deployed: supabase functions deploy notify-email
--   3. Secrets set:
--        supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
--        supabase secrets set TRIGGER_SECRET=<random string you choose>
--   4. This same TRIGGER_SECRET stored as a DB setting (run the ALTER below once):
--        ALTER DATABASE postgres SET app.trigger_secret = '<same random string>';
--      Then reload config: SELECT pg_reload_conf();

create extension if not exists pg_net;

-- ── Direct message notification ───────────────────────────────────────────────

create or replace function public.notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id    uuid;
  recipient_email text;
  recipient_name  text;
  sender_name     text;
  edge_url        text := 'https://lwbnsagjmbqptjbbrcmd.supabase.co/functions/v1/notify-email';
  trigger_secret  text := current_setting('app.trigger_secret', true);
begin
  -- Find the other participant in this conversation
  select cp.user_id into recipient_id
  from public.conversation_participants cp
  where cp.conversation_id = NEW.conversation_id
    and cp.user_id <> NEW.sender_id
  limit 1;

  if recipient_id is null then return NEW; end if;

  -- Get recipient email from auth.users (security definer gives us access)
  select email into recipient_email
  from auth.users
  where id = recipient_id;

  if recipient_email is null then return NEW; end if;

  select display_name into recipient_name from public.profiles where id = recipient_id;
  select display_name into sender_name   from public.profiles where id = NEW.sender_id;

  perform net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-trigger-secret', trigger_secret
    ),
    body    := jsonb_build_object(
      'type',           'message',
      'recipientEmail', recipient_email,
      'recipientName',  coalesce(recipient_name, ''),
      'senderName',     coalesce(sender_name, 'Someone'),
      'preview',        left(NEW.body, 140)
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_new_message on public.direct_messages;
create trigger trg_notify_on_new_message
  after insert on public.direct_messages
  for each row execute function public.notify_on_new_message();


-- ── Chapter comment notification ──────────────────────────────────────────────

create or replace function public.notify_on_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_owner_id uuid;
  recipient_email  text;
  recipient_name   text;
  commenter_name   text;
  chapter_label    text;
  edge_url         text := 'https://lwbnsagjmbqptjbbrcmd.supabase.co/functions/v1/notify-email';
  trigger_secret   text := current_setting('app.trigger_secret', true);
begin
  -- Get the project owner
  select owner_id into project_owner_id
  from public.projects
  where id = NEW.project_id;

  -- Skip if author is commenting on their own work
  if project_owner_id is null or project_owner_id = NEW.user_id then
    return NEW;
  end if;

  select email into recipient_email
  from auth.users
  where id = project_owner_id;

  if recipient_email is null then return NEW; end if;

  select display_name into recipient_name from public.profiles where id = project_owner_id;
  select display_name into commenter_name from public.profiles where id = NEW.user_id;

  -- Try to get a readable chapter title from published_chapters, fall back to chapter_ref
  select coalesce(pc.chapter_title, NEW.chapter_ref) into chapter_label
  from public.published_chapters pc
  where pc.project_id = NEW.project_id
    and pc.chapter_id  = NEW.chapter_ref
  limit 1;

  chapter_label := coalesce(chapter_label, NEW.chapter_ref, 'your chapter');

  perform net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-trigger-secret', trigger_secret
    ),
    body    := jsonb_build_object(
      'type',           'comment',
      'recipientEmail', recipient_email,
      'recipientName',  coalesce(recipient_name, ''),
      'senderName',     coalesce(commenter_name, 'Someone'),
      'preview',        left(NEW.content, 140),
      'chapterTitle',   chapter_label
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_new_comment on public.comments;
create trigger trg_notify_on_new_comment
  after insert on public.comments
  for each row execute function public.notify_on_new_comment();
