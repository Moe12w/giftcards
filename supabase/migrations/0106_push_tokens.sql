-- 0106_push_tokens.sql
-- Where a customer's device registers itself for push notifications.
--
-- Used to nudge the buyer on the day a scheduled gift comes due, so a gift
-- that has to be sent by hand (WhatsApp, SMS or a link) does not sit unseen
-- until they open the app.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "users manage their own push tokens"
  on public.push_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
