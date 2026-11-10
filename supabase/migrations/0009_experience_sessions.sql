-- 0009_experience_sessions.sql
-- Experience gift cards are redeemed one session at a time.
--
-- A value card holds money: each redemption spends an amount. An experience
-- card (a massage, a class, a night at the hotel) holds *sessions* instead:
-- the price of the package is still money, but what the holder spends is one
-- session, and the card is finished when the last session is used.
--
-- Both live in the same append-only ledger, so a card's history is one log.

-- ---------------------------------------------------------------------------
-- Offers: how is the card redeemed?
-- ---------------------------------------------------------------------------
alter table public.offers
  add column if not exists redemption_mode text not null default 'value'
    check (redemption_mode in ('value', 'sessions'));

alter table public.offers
  add column if not exists session_count integer
    check (session_count is null or session_count > 0);

-- A session offer must say how many sessions it includes.
alter table public.offers
  drop constraint if exists offers_session_count_matches_mode;

alter table public.offers
  add constraint offers_session_count_matches_mode
    check (
      (redemption_mode = 'value' and session_count is null)
      or (redemption_mode = 'sessions' and session_count is not null)
    );

create index if not exists offers_redemption_mode_idx
  on public.offers (redemption_mode);

-- ---------------------------------------------------------------------------
-- Gift cards: the sessions included on the card
-- ---------------------------------------------------------------------------
alter table public.gift_cards
  add column if not exists redemption_mode text not null default 'value'
    check (redemption_mode in ('value', 'sessions'));

alter table public.gift_cards
  add column if not exists sessions_total integer
    check (sessions_total is null or sessions_total > 0);

-- The remaining count is derived from the ledger, never edited directly.
alter table public.gift_cards
  drop constraint if exists gift_cards_sessions_total_matches_mode;

alter table public.gift_cards
  add constraint gift_cards_sessions_total_matches_mode
    check (
      (redemption_mode = 'value' and sessions_total is null)
      or (redemption_mode = 'sessions' and sessions_total is not null)
    );

-- ---------------------------------------------------------------------------
-- Ledger: sessions are booked the same way money is
-- ---------------------------------------------------------------------------
alter table public.ledger_entries
  add column if not exists sessions integer not null default 0;

create or replace view public.card_balances
with (security_invoker = true) as
select
  c.id as card_id,
  coalesce(sum(le.amount_minor), 0)::bigint as balance_minor,
  coalesce(sum(le.sessions), 0)::integer as sessions_remaining
from public.gift_cards c
left join public.ledger_entries le on le.card_id = c.id
group by c.id;

-- ---------------------------------------------------------------------------
-- Redeem one session (atomic, row-locked)
-- ---------------------------------------------------------------------------
create or replace function public.redeem_session(p_card_id uuid)
returns table (card_id uuid, sessions_remaining integer, new_status public.card_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.gift_cards%rowtype;
  v_remaining integer;
  v_allowed boolean;
begin
  -- Lock the card row so two redemptions cannot run at once.
  select * into v_card
  from public.gift_cards
  where id = p_card_id
  for update;

  if not found then
    raise exception 'card not found';
  end if;

  if v_card.redemption_mode <> 'sessions' then
    raise exception 'card is not a session card';
  end if;

  -- Only the vendor that owns the offer, or an admin, may redeem.
  select exists (
    select 1
    from public.offers o
    join public.vendors v on v.id = o.vendor_id
    where o.id = v_card.offer_id
      and (v.owner_id = auth.uid() or public.is_admin())
  ) into v_allowed;

  if not v_allowed then
    raise exception 'not allowed';
  end if;

  if v_card.status not in ('claimed', 'issued') then
    raise exception 'card not redeemable';
  end if;

  select coalesce(sum(sessions), 0) into v_remaining
  from public.ledger_entries
  where card_id = p_card_id;

  if v_remaining <= 0 then
    raise exception 'no sessions left';
  end if;

  -- One redemption always uses exactly one session.
  insert into public.ledger_entries (card_id, entry_type, amount_minor, sessions)
  values (p_card_id, 'redeem', 0, -1);

  v_remaining := v_remaining - 1;

  if v_remaining = 0 then
    update public.gift_cards set status = 'redeemed' where id = p_card_id;
  end if;

  return query
    select
      p_card_id,
      v_remaining,
      (select status from public.gift_cards where id = p_card_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Issue a session card
-- ---------------------------------------------------------------------------
create or replace function public.issue_session_card(
  p_offer_id uuid,
  p_order_id uuid,
  p_buyer_id uuid,
  p_original_value_minor bigint,
  p_claim_token_hash text,
  p_recipient_name text,
  p_recipient_email text,
  p_recipient_phone text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_id uuid;
  v_sessions integer;
begin
  select session_count into v_sessions
  from public.offers
  where id = p_offer_id and redemption_mode = 'sessions';

  if v_sessions is null then
    raise exception 'offer is not a session offer';
  end if;

  insert into public.gift_cards (
    offer_id, order_id, buyer_id, recipient_name, recipient_email,
    recipient_phone, original_value_minor, claim_token_hash, expires_at,
    redemption_mode, sessions_total
  )
  values (
    p_offer_id, p_order_id, p_buyer_id, p_recipient_name, p_recipient_email,
    p_recipient_phone, p_original_value_minor, p_claim_token_hash, p_expires_at,
    'sessions', v_sessions
  )
  returning id into v_card_id;

  -- The price is money, the entitlement is sessions.
  insert into public.ledger_entries (card_id, order_id, entry_type, amount_minor, sessions)
  values (v_card_id, p_order_id, 'issue', p_original_value_minor, v_sessions);

  return v_card_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vendor view of the cards it has to serve
-- ---------------------------------------------------------------------------
create or replace view public.vendor_cards
with (security_invoker = true) as
select
  c.id as card_id,
  c.offer_id,
  o.vendor_id,
  c.recipient_name,
  c.recipient_email,
  c.status,
  c.redemption_mode,
  c.sessions_total,
  c.expires_at,
  coalesce(b.balance_minor, 0)::bigint as balance_minor,
  coalesce(b.sessions_remaining, 0)::integer as sessions_remaining
from public.gift_cards c
join public.offers o on o.id = c.offer_id
left join public.card_balances b on b.card_id = c.id;

revoke all on function public.redeem_session(uuid) from public;
grant execute on function public.redeem_session(uuid) to authenticated;

revoke all on function public.issue_session_card(uuid, uuid, uuid, bigint, text, text, text, text, timestamptz) from public;
grant execute on function public.issue_session_card(uuid, uuid, uuid, bigint, text, text, text, text, timestamptz) to authenticated;

-- The vendor may read the cards it owns.
drop policy if exists vendor_cards_read on public.gift_cards;
create policy vendor_cards_read on public.gift_cards
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.offers o
      join public.vendors v on v.id = o.vendor_id
      where o.id = gift_cards.offer_id
        and (v.owner_id = auth.uid() or public.is_admin())
    )
  );
