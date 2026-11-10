-- 0002_functions_and_triggers.sql
-- Server-side invariants. These run in the database so they cannot be bypassed
-- by a buggy or malicious client.

-- ---------------------------------------------------------------------------
-- Append-only ledger
-- ---------------------------------------------------------------------------
create or replace function public.prevent_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ledger_entries is append-only';
end;
$$;

drop trigger if exists ledger_no_update on public.ledger_entries;
create trigger ledger_no_update
  before update or delete on public.ledger_entries
  for each row execute function public.prevent_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.vendors where owner_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Only admins may change vendor status / commission / exposure limit
-- ---------------------------------------------------------------------------
create or replace function public.guard_vendor_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status
      or new.commission_bps is distinct from old.commission_bps
      or new.max_unredeemed_minor is distinct from old.max_unredeemed_minor) then
    if not public.is_admin() then
      raise exception 'only admins may change vendor status, commission, or exposure limit';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_guard_admin_fields on public.vendors;
create trigger vendors_guard_admin_fields
  before update on public.vendors
  for each row execute function public.guard_vendor_admin_fields();

-- ---------------------------------------------------------------------------
-- Claim attempts (rate limiting)
-- ---------------------------------------------------------------------------
create table if not exists public.claim_attempts (
  id bigint generated always as identity primary key,
  token_hash text not null,
  identifier text,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists claim_attempts_token_idx on public.claim_attempts (token_hash, created_at desc);

create or replace function public.claim_card(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.gift_cards%rowtype;
  v_recent_failures int;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'invalid token';
  end if;

  -- Rate limit: at most 10 failed attempts per token per hour.
  select count(*) into v_recent_failures
  from public.claim_attempts
  where token_hash = p_token_hash
    and succeeded = false
    and created_at > now() - interval '1 hour';

  if v_recent_failures >= 10 then
    raise exception 'too many attempts';
  end if;

  select * into v_card
  from public.gift_cards
  where claim_token_hash = p_token_hash
  for update;

  if not found then
    insert into public.claim_attempts (token_hash, succeeded) values (p_token_hash, false);
    raise exception 'invalid token';
  end if;

  if v_card.claimed_by is not null or v_card.status <> 'issued' then
    insert into public.claim_attempts (token_hash, succeeded) values (p_token_hash, false);
    raise exception 'already claimed';
  end if;

  update public.gift_cards
  set status = 'claimed',
      claimed_by = auth.uid(),
      claimed_at = now(),
      claim_token_hash = null
  where id = v_card.id;

  insert into public.claim_attempts (token_hash, succeeded) values (p_token_hash, true);

  return v_card.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Redeem a card (atomic, row-locked)
-- ---------------------------------------------------------------------------
create or replace function public.redeem_card(p_card_id uuid, p_amount_minor bigint)
returns table (card_id uuid, new_balance_minor bigint, new_status public.card_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.gift_cards%rowtype;
  v_balance bigint;
  v_new_balance bigint;
  v_allowed boolean;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  -- Lock the card row so two redemptions cannot run at once.
  select * into v_card
  from public.gift_cards
  where id = p_card_id
  for update;

  if not found then
    raise exception 'card not found';
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

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries
  where card_id = p_card_id;

  if v_balance <= 0 then
    raise exception 'no balance';
  end if;

  if p_amount_minor > v_balance then
    raise exception 'insufficient balance';
  end if;

  insert into public.ledger_entries (card_id, entry_type, amount_minor)
  values (p_card_id, 'redeem', -p_amount_minor);

  v_new_balance := v_balance - p_amount_minor;

  if v_new_balance = 0 then
    update public.gift_cards set status = 'redeemed' where id = p_card_id;
  end if;

  return query
    select p_card_id, v_new_balance, (select status from public.gift_cards where id = p_card_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Issue a card + opening ledger entry (called by the payment webhook only)
-- ---------------------------------------------------------------------------
create or replace function public.issue_gift_card(
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
begin
  insert into public.gift_cards (
    offer_id, order_id, buyer_id, recipient_name, recipient_email,
    recipient_phone, original_value_minor, claim_token_hash, expires_at
  )
  values (
    p_offer_id, p_order_id, p_buyer_id, p_recipient_name, p_recipient_email,
    p_recipient_phone, p_original_value_minor, p_claim_token_hash, p_expires_at
  )
  returning id into v_card_id;

  insert into public.ledger_entries (card_id, order_id, entry_type, amount_minor)
  values (v_card_id, p_order_id, 'issue', p_original_value_minor);

  return v_card_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin audit helper
-- ---------------------------------------------------------------------------
create or replace function public.record_admin_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  insert into public.admin_actions (admin_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_details)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.redeem_card(uuid, bigint) from public;
grant execute on function public.redeem_card(uuid, bigint) to authenticated;

revoke all on function public.claim_card(text) from public;
grant execute on function public.claim_card(text) to anon, authenticated;

revoke all on function public.issue_gift_card(uuid, uuid, uuid, bigint, text, text, text, text, timestamptz) from public;
revoke all on function public.record_admin_action(text, text, uuid, jsonb) from public;
grant execute on function public.record_admin_action(text, text, uuid, jsonb) to authenticated;
