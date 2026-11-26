-- 0171_basket_book.sql
-- Turns the basket's greeting card into a book everyone can add to, and gives
-- the basket a cover design chosen by whoever created it.
--
-- A page is either writing (kind = 'text') or one piece of media (photo, GIF,
-- video or voice note) described by `media` in the same shape as a card's
-- stored media: { type, url, mimeType, durationMs }.

alter table public.gift_baskets
  add column if not exists cover_id text;

alter table public.gift_basket_messages
  add column if not exists kind text not null default 'text',
  add column if not exists media jsonb;

-- The text-only check from 0170 was auto-named. It is dropped by name and,
-- in case a project named it differently, by definition too: any check that
-- limits the length of `text` but knows nothing about `kind` is the old one.
alter table public.gift_basket_messages
  drop constraint if exists gift_basket_messages_text_check;

do $$
declare
  found_name text;
begin
  for found_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'gift_basket_messages'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%char_length(trim%'
      and pg_get_constraintdef(con.oid) not ilike '%kind%'
  loop
    execute format('alter table public.gift_basket_messages drop constraint %I', found_name);
  end loop;
end $$;

alter table public.gift_basket_messages
  alter column text drop not null;

alter table public.gift_basket_messages
  drop constraint if exists gift_basket_messages_kind_check;
alter table public.gift_basket_messages
  add constraint gift_basket_messages_kind_check
  check (kind in ('text', 'photo', 'gif', 'video', 'audio'));

alter table public.gift_basket_messages
  drop constraint if exists gift_basket_messages_body_check;
alter table public.gift_basket_messages
  add constraint gift_basket_messages_body_check
  check (
    (
      kind = 'text'
      and char_length(trim(coalesce(text, ''))) between 1 and 500
      and media is null
    )
    or (
      kind <> 'text'
      and media is not null
    )
  );
