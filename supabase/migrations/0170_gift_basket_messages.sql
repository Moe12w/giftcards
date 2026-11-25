-- 0170_gift_basket_messages.sql
-- Collaborative greeting card: every participant can leave a short message
-- on the basket that is shown to the recipient as "To <name>".

create table if not exists public.gift_basket_messages (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.gift_baskets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  text text not null check (char_length(trim(text)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists gift_basket_messages_basket_idx
  on public.gift_basket_messages (basket_id, created_at);

alter table public.gift_basket_messages enable row level security;

drop policy if exists gift_basket_messages_select on public.gift_basket_messages;
create policy gift_basket_messages_select on public.gift_basket_messages
  for select using (
    public.is_basket_participant(basket_id) or public.is_admin()
  );

drop policy if exists gift_basket_messages_insert on public.gift_basket_messages;
create policy gift_basket_messages_insert on public.gift_basket_messages
  for insert with check (
    author_id = auth.uid()
    and public.is_basket_participant(basket_id)
  );

drop policy if exists gift_basket_messages_delete on public.gift_basket_messages;
create policy gift_basket_messages_delete on public.gift_basket_messages
  for delete using (
    author_id = auth.uid()
    or exists (
      select 1 from public.gift_baskets b
      where b.id = basket_id and b.creator_id = auth.uid()
    )
    or public.is_admin()
  );

-- Realtime so new messages appear live for everyone.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.gift_basket_messages;
    exception when duplicate_object then null; end;
  end if;
end $$;
