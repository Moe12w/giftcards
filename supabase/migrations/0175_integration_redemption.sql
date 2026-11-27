-- 0175_integration_redemption.sql
--
-- Phase 4 of the external-platform integration: reservations, capture, release,
-- redemption reversal and order events.
--
-- This migration is additive. It reuses the existing gift-card engine:
--   * `ledger_entries` stays the only balance ledger;
--   * `redemptions` stays the only redemption history;
--   * `redeem_monetary` keeps its exact signature and authorisation.
--
-- The one refactor is that `redeem_monetary` becomes a thin wrapper around
-- `redeem_monetary_internal`, which takes a verified vendor id instead of
-- reading `auth.uid()`. External capture and staff redemption therefore share
-- one money path; nothing else writes a `redeem` ledger entry.
--
-- External redemptions never create orders or invoices and never touch the
-- purchase/fulfilment path.

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
create table if not exists public.integration_reservations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  platform_id uuid not null references public.integration_platforms (id) on delete restrict,
  mapping_id uuid not null references public.integration_vendor_mappings (id) on delete restrict,
  voucher_id uuid not null references public.vouchers (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  external_order_id text not null,
  external_branch_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  status text not null default 'active'
    check (status in ('active', 'captured', 'released', 'expired', 'reconciliation')),
  idempotency_key text not null,
  expires_at timestamptz not null,
  capture_started_at timestamptz,
  captured_at timestamptz,
  released_at timestamptz,
  release_reason text,
  redemption_id uuid references public.redemptions (id) on delete set null,
  external_payment_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_id, idempotency_key)
);

create unique index if not exists integration_reservation_one_active
  on public.integration_reservations (platform_id, external_order_id, voucher_id)
  where status = 'active';

create index if not exists integration_reservation_voucher_idx
  on public.integration_reservations (voucher_id, status);
create index if not exists integration_reservation_expiry_idx
  on public.integration_reservations (status, expires_at);
create index if not exists integration_reservation_vendor_idx
  on public.integration_reservations (vendor_id, created_at desc);

comment on table public.integration_reservations is
  'A temporary hold on gift-card value while an external platform completes checkout. Holds never write to the ledger; only capture does.';

-- ---------------------------------------------------------------------------
-- Idempotency / operation replay
-- ---------------------------------------------------------------------------
create table if not exists public.integration_operations (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (platform_id, operation, idempotency_key)
);

create index if not exists integration_operations_platform_idx
  on public.integration_operations (platform_id, created_at desc);

comment on table public.integration_operations is
  'Stored response for an idempotent external operation. A null response_status means the operation is still in flight.';

-- ---------------------------------------------------------------------------
-- External orders (state mirror, never an internal order)
-- ---------------------------------------------------------------------------
create table if not exists public.integration_external_orders (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  mapping_id uuid references public.integration_vendor_mappings (id) on delete set null,
  external_order_id text not null,
  external_branch_id text,
  currency text not null,
  order_amount_minor bigint not null default 0 check (order_amount_minor >= 0),
  eligible_amount_minor bigint not null default 0 check (eligible_amount_minor >= 0),
  status text not null default 'initiated'
    check (status in ('initiated', 'pending_payment', 'paid', 'cancelled', 'refunded', 'unknown')),
  payment_status text,
  reservation_id uuid references public.integration_reservations (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_id, external_order_id)
);

comment on table public.integration_external_orders is
  'A mirror of the platform order state for reconciliation. It is not an internal order and never triggers purchase fulfilment.';

-- ---------------------------------------------------------------------------
-- Redemption reversals
-- ---------------------------------------------------------------------------
create table if not exists public.integration_refunds (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete restrict,
  reservation_id uuid references public.integration_reservations (id) on delete set null,
  redemption_id uuid not null references public.redemptions (id) on delete restrict,
  voucher_id uuid not null references public.vouchers (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  external_order_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'reconciliation')),
  idempotency_key text not null,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (platform_id, idempotency_key)
);

create index if not exists integration_refunds_redemption_idx
  on public.integration_refunds (redemption_id, status);
create index if not exists integration_refunds_vendor_idx
  on public.integration_refunds (vendor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Reconciliation cases
-- ---------------------------------------------------------------------------
create table if not exists public.integration_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  reservation_id uuid references public.integration_reservations (id) on delete set null,
  external_order_id text,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'resolved_captured', 'resolved_released', 'resolved_refunded', 'ignored')),
  evidence jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists integration_reconciliation_open_idx
  on public.integration_reconciliation_cases (status, created_at desc);
create index if not exists integration_reconciliation_reservation_idx
  on public.integration_reconciliation_cases (reservation_id);

-- ---------------------------------------------------------------------------
-- Additive columns on the existing redemption history
-- ---------------------------------------------------------------------------
alter table public.redemptions
  add column if not exists channel text not null default 'staff'
    check (channel in ('staff', 'external_platform', 'admin', 'system'));
alter table public.redemptions
  add column if not exists platform_id uuid references public.integration_platforms (id) on delete set null;
alter table public.redemptions
  add column if not exists external_order_id text;
alter table public.redemptions
  add column if not exists external_branch_id text;
alter table public.redemptions
  add column if not exists reservation_id uuid references public.integration_reservations (id) on delete set null;
alter table public.redemptions
  add column if not exists idempotency_key text;
alter table public.redemptions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- One reservation can produce at most one redemption. This is the last line of
-- defence against a gateway bug calling capture twice.
create unique index if not exists redemptions_reservation_once
  on public.redemptions (reservation_id)
  where reservation_id is not null;

create index if not exists redemptions_platform_idx
  on public.redemptions (platform_id, external_order_id)
  where platform_id is not null;

-- ---------------------------------------------------------------------------
-- Reference helper
-- ---------------------------------------------------------------------------
create or replace function public.integration_make_reservation_reference()
returns text
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select 'RSV-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
$$;

revoke all on function public.integration_make_reservation_reference() from public, anon, authenticated;
grant execute on function public.integration_make_reservation_reference() to service_role;

-- ---------------------------------------------------------------------------
-- Internal monetary redemption
--
-- The only function that writes a monetary `redeem` ledger entry. The caller
-- must already have verified the vendor (staff authorisation or an active
-- platform mapping). It never reads auth.uid() for authorisation.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_monetary_internal(
  p_voucher_id uuid,
  p_amount_minor bigint,
  p_vendor_id uuid,
  p_notes text default null,
  p_channel text default 'external_platform',
  p_platform_id uuid default null,
  p_external_order_id text default null,
  p_external_branch_id text default null,
  p_reservation_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  redemption_id uuid,
  redemption_reference text,
  new_balance_minor bigint,
  new_status public.voucher_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_balance bigint;
  v_reserved bigint;
  v_available bigint;
  v_new_balance bigint;
  v_redemption_id uuid;
  v_reference text;
  v_existing public.redemptions%rowtype;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  -- A retried capture must return the original redemption, never deduct twice.
  if p_reservation_id is not null then
    select * into v_existing
    from public.redemptions
    where reservation_id = p_reservation_id
    limit 1;

    if v_existing.id is not null then
      return query
        select v_existing.id, v_existing.reference,
          coalesce((select sum(amount_minor) from public.ledger_entries where voucher_id = v_existing.voucher_id), 0),
          (select status from public.vouchers where id = v_existing.voucher_id);
      return;
    end if;
  end if;

  select * into v_voucher
  from public.vouchers
  where id = p_voucher_id
  for update;

  if not found then
    raise exception 'voucher not found';
  end if;

  if v_voucher.fulfilment_type <> 'monetary' then
    raise exception 'voucher is not a monetary voucher';
  end if;

  -- The verified vendor comes from the caller, never from the request body.
  if p_vendor_id is null or v_voucher.vendor_id <> p_vendor_id then
    raise exception 'not allowed';
  end if;

  if v_voucher.status not in ('claimed', 'issued', 'active', 'partially_redeemed') then
    raise exception 'voucher not redeemable';
  end if;

  if v_voucher.expires_at is not null and v_voucher.expires_at <= now() then
    raise exception 'voucher expired';
  end if;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries
  where voucher_id = p_voucher_id;

  -- Holds belonging to the reservation being captured do not reduce the money
  -- available to that same reservation.
  select coalesce(sum(amount_minor), 0) into v_reserved
  from public.integration_reservations
  where voucher_id = p_voucher_id
    and status = 'active'
    and (p_reservation_id is null or id <> p_reservation_id);

  v_available := v_balance - v_reserved;

  if v_available <= 0 then
    raise exception 'no balance';
  end if;

  if p_amount_minor > v_available then
    raise exception 'insufficient balance';
  end if;

  v_reference := public.make_redemption_reference();

  insert into public.redemptions (
    reference, voucher_id, vendor_id, staff_user_id, kind, amount_minor, quantity,
    notes, channel, platform_id, external_order_id, external_branch_id,
    reservation_id, idempotency_key, metadata
  )
  values (
    v_reference, p_voucher_id, v_voucher.vendor_id, auth.uid(), 'monetary', p_amount_minor, 1,
    p_notes, coalesce(p_channel, 'external_platform'), p_platform_id, p_external_order_id,
    p_external_branch_id, p_reservation_id, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_redemption_id;

  insert into public.redemption_items (redemption_id, voucher_id, amount_minor, staff_user_id)
  values (v_redemption_id, p_voucher_id, p_amount_minor, auth.uid());

  insert into public.ledger_entries (voucher_id, entry_type, amount_minor, redemption_id, staff_user_id)
  values (p_voucher_id, 'redeem', -p_amount_minor, v_redemption_id, auth.uid());

  v_new_balance := v_balance - p_amount_minor;

  if v_new_balance = 0 then
    update public.vouchers
    set status = 'redeemed', redeemed_at = now(), remaining_value_minor = 0, updated_at = now()
    where id = p_voucher_id;
  else
    update public.vouchers
    set status = 'partially_redeemed', remaining_value_minor = v_new_balance, updated_at = now()
    where id = p_voucher_id;
  end if;

  perform public.write_audit(
    case when coalesce(p_channel, 'external_platform') = 'external_platform'
      then 'external_monetary_redemption' else 'monetary_redemption' end,
    'voucher',
    p_voucher_id::text,
    jsonb_build_object('balance_minor', v_balance, 'amount_minor', p_amount_minor),
    jsonb_build_object(
      'balance_minor', v_new_balance,
      'reference', v_reference,
      'channel', coalesce(p_channel, 'external_platform'),
      'platform_id', p_platform_id,
      'external_order_id', p_external_order_id,
      'reservation_id', p_reservation_id
    )
  );

  return query
    select v_redemption_id, v_reference, v_new_balance,
      (select status from public.vouchers where id = p_voucher_id);
end;
$$;

revoke all on function public.redeem_monetary_internal(uuid, bigint, uuid, text, text, uuid, text, text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.redeem_monetary_internal(uuid, bigint, uuid, text, text, uuid, text, text, uuid, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Staff wrapper: identical signature and behaviour to 0013.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_monetary(
  p_voucher_id uuid,
  p_amount_minor bigint,
  p_notes text default null
)
returns table (
  redemption_id uuid,
  redemption_reference text,
  new_balance_minor bigint,
  new_status public.voucher_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select * into v_voucher
  from public.vouchers
  where id = p_voucher_id
  for update;

  if not found then
    raise exception 'voucher not found';
  end if;

  -- Preserve the original check order: a non-monetary voucher is rejected
  -- before the caller's permission is considered.
  if v_voucher.fulfilment_type <> 'monetary' then
    raise exception 'voucher is not a monetary voucher';
  end if;

  if not exists (
    select 1
    from public.vendors v
    where v.id = v_voucher.vendor_id
      and public.can_redeem_for(v.id)
  ) then
    raise exception 'not allowed';
  end if;

  return query
    select *
    from public.redeem_monetary_internal(
      p_voucher_id,
      p_amount_minor,
      v_voucher.vendor_id,
      p_notes,
      'staff',
      null,
      null,
      null,
      null,
      null,
      '{}'::jsonb
    );
end;
$$;

revoke all on function public.redeem_monetary(uuid, bigint, text) from public;
grant execute on function public.redeem_monetary(uuid, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Read-only card state (validate)
-- ---------------------------------------------------------------------------
create or replace function public.integration_card_state(
  p_platform_id uuid,
  p_mapping_id uuid,
  p_card_code text,
  p_currency text default null
)
returns table (
  found boolean,
  valid boolean,
  reason text,
  voucher_id uuid,
  masked_code text,
  vendor_name text,
  currency text,
  balance_minor bigint,
  reserved_minor bigint,
  available_minor bigint,
  expires_at timestamptz,
  monetary boolean,
  partial_allowed boolean
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_mapping public.integration_vendor_mappings%rowtype;
  v_voucher public.vouchers%rowtype;
  v_balance bigint;
  v_reserved bigint;
  v_available bigint;
  v_valid boolean := false;
  v_reason text;
  v_code text;
begin
  select * into v_mapping
  from public.integration_vendor_mappings
  where id = p_mapping_id
    and platform_id = p_platform_id;

  if v_mapping.id is null then
    raise exception 'mapping not found';
  end if;
  if v_mapping.status <> 'active' then
    raise exception 'mapping not active';
  end if;

  v_code := upper(trim(coalesce(p_card_code, '')));

  select * into v_voucher
  from public.vouchers
  where voucher_code = v_code
     or card_code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
  limit 1;

  if v_voucher.id is null then
    return query
      select false, false, 'not_found'::text, null::uuid, null::text, null::text,
        null::text, null::bigint, null::bigint, null::bigint, null::timestamptz,
        null::boolean, null::boolean;
    return;
  end if;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries
  where voucher_id = v_voucher.id;

  select coalesce(sum(amount_minor), 0) into v_reserved
  from public.integration_reservations
  where voucher_id = v_voucher.id
    and status = 'active';

  v_available := greatest(v_balance - v_reserved, 0);

  if v_mapping.vendor_id is distinct from v_voucher.vendor_id then
    v_reason := 'wrong_business';
  elsif v_voucher.fulfilment_type <> 'monetary' then
    v_reason := 'not_monetary';
  elsif v_voucher.status not in ('claimed', 'issued', 'active', 'partially_redeemed') then
    v_reason := 'inactive';
  elsif v_voucher.expires_at is not null and v_voucher.expires_at <= now() then
    v_reason := 'expired';
  elsif p_currency is not null and upper(p_currency) <> upper(v_voucher.currency) then
    v_reason := 'currency_mismatch';
  elsif v_available <= 0 then
    v_reason := 'no_balance';
  else
    v_valid := true;
    v_reason := null;
  end if;

  return query
    select
      true,
      v_valid,
      v_reason,
      v_voucher.id,
      left(coalesce(v_voucher.voucher_code, 'GFT'), 4)
        || '••••'
        || right(coalesce(v_voucher.voucher_code, ''), 6),
      (select name from public.vendors where id = v_voucher.vendor_id),
      v_voucher.currency,
      v_balance,
      v_reserved,
      v_available,
      v_voucher.expires_at,
      (v_voucher.fulfilment_type = 'monetary'),
      true;
end;
$$;

revoke all on function public.integration_card_state(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.integration_card_state(uuid, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Preview (read-only eligible amount)
-- ---------------------------------------------------------------------------
create or replace function public.integration_preview(
  p_platform_id uuid,
  p_mapping_id uuid,
  p_card_code text,
  p_order_amount_minor bigint,
  p_requested_amount_minor bigint default null,
  p_currency text default null
)
returns table (
  found boolean,
  valid boolean,
  reason text,
  masked_code text,
  vendor_name text,
  currency text,
  balance_minor bigint,
  reserved_minor bigint,
  available_minor bigint,
  order_amount_minor bigint,
  applied_amount_minor bigint,
  remaining_order_amount_minor bigint,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state record;
  v_order bigint;
  v_requested bigint;
  v_applied bigint;
begin
  if p_order_amount_minor is null or p_order_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;
  if p_requested_amount_minor is not null and p_requested_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select * into v_state
  from public.integration_card_state(p_platform_id, p_mapping_id, p_card_code, p_currency);

  v_order := p_order_amount_minor;
  v_requested := coalesce(p_requested_amount_minor, v_order);

  if not v_state.found or not v_state.valid then
    return query
      select v_state.found, false, v_state.reason, v_state.masked_code,
        v_state.vendor_name, v_state.currency, v_state.balance_minor,
        v_state.reserved_minor, v_state.available_minor, v_order, 0::bigint,
        v_order, v_state.expires_at;
    return;
  end if;

  v_applied := least(v_requested, v_state.available_minor, v_order);

  if v_applied <= 0 then
    return query
      select true, false, 'no_balance'::text, v_state.masked_code,
        v_state.vendor_name, v_state.currency, v_state.balance_minor,
        v_state.reserved_minor, v_state.available_minor, v_order, 0::bigint,
        v_order, v_state.expires_at;
    return;
  end if;

  return query
    select true, true, null::text, v_state.masked_code, v_state.vendor_name,
      v_state.currency, v_state.balance_minor, v_state.reserved_minor,
      v_state.available_minor, v_order, v_applied, v_order - v_applied,
      v_state.expires_at;
end;
$$;

revoke all on function public.integration_preview(uuid, uuid, text, bigint, bigint, text)
  from public, anon, authenticated;
grant execute on function public.integration_preview(uuid, uuid, text, bigint, bigint, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Reserve
-- ---------------------------------------------------------------------------
create or replace function public.integration_reserve(
  p_platform_id uuid,
  p_mapping_id uuid,
  p_card_code text,
  p_external_order_id text,
  p_external_branch_id text,
  p_order_amount_minor bigint,
  p_requested_amount_minor bigint,
  p_currency text,
  p_ttl_seconds integer,
  p_idempotency_key text
)
returns table (
  reservation_id uuid,
  reservation_reference text,
  status text,
  voucher_id uuid,
  masked_code text,
  vendor_name text,
  currency text,
  amount_minor bigint,
  balance_minor bigint,
  reserved_minor bigint,
  available_minor bigint,
  order_amount_minor bigint,
  remaining_order_amount_minor bigint,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_platform public.integration_platforms%rowtype;
  v_mapping public.integration_vendor_mappings%rowtype;
  v_voucher public.vouchers%rowtype;
  v_existing public.integration_reservations%rowtype;
  v_balance bigint;
  v_reserved bigint;
  v_available bigint;
  v_amount bigint;
  v_ttl integer;
  v_reference text;
  v_id uuid;
  v_code text;
begin
  select * into v_platform
  from public.integration_platforms
  where id = p_platform_id;

  if v_platform.id is null or v_platform.status <> 'active' then
    raise exception 'platform not active';
  end if;

  select * into v_mapping
  from public.integration_vendor_mappings
  where id = p_mapping_id
    and platform_id = p_platform_id;

  if v_mapping.id is null then
    raise exception 'mapping not found';
  end if;
  if v_mapping.status <> 'active' or v_mapping.vendor_id is null then
    raise exception 'mapping not active';
  end if;

  if p_external_order_id is null or trim(p_external_order_id) = '' then
    raise exception 'invalid request';
  end if;
  if p_idempotency_key is null or trim(p_idempotency_key) = '' then
    raise exception 'invalid request';
  end if;
  if p_order_amount_minor is null or p_order_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;
  if p_requested_amount_minor is not null and p_requested_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  v_code := upper(trim(coalesce(p_card_code, '')));

  select * into v_voucher
  from public.vouchers
  where voucher_code = v_code
     or card_code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
  limit 1
  for update;

  if v_voucher.id is null then
    raise exception 'voucher not found';
  end if;
  if v_voucher.vendor_id is distinct from v_mapping.vendor_id then
    raise exception 'wrong business';
  end if;
  if v_voucher.fulfilment_type <> 'monetary' then
    raise exception 'voucher not redeemable';
  end if;
  if v_voucher.status not in ('claimed', 'issued', 'active', 'partially_redeemed') then
    raise exception 'voucher not redeemable';
  end if;
  if v_voucher.expires_at is not null and v_voucher.expires_at <= now() then
    raise exception 'voucher expired';
  end if;
  if p_currency is null or upper(p_currency) <> upper(v_voucher.currency) then
    raise exception 'currency mismatch';
  end if;

  -- Expire stale holds, but never touch one whose capture has already started.
  update public.integration_reservations
  set status = 'expired', released_at = now(), release_reason = 'expired', updated_at = now()
  where voucher_id = v_voucher.id
    and status = 'active'
    and expires_at <= now()
    and capture_started_at is null;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries
  where voucher_id = v_voucher.id;

  select coalesce(sum(amount_minor), 0) into v_reserved
  from public.integration_reservations
  where voucher_id = v_voucher.id
    and status = 'active';

  v_available := greatest(v_balance - v_reserved, 0);
  v_amount := least(
    coalesce(p_requested_amount_minor, p_order_amount_minor),
    p_order_amount_minor,
    v_available
  );

  if v_amount <= 0 then
    raise exception 'insufficient balance';
  end if;

  v_ttl := greatest(60, least(coalesce(
    p_ttl_seconds,
    (v_platform.config ->> 'ttl_seconds')::integer,
    600
  ), 1800));

  -- The same checkout may be retried with a new idempotency key. One active
  -- hold per platform order and voucher is enough; return it instead of
  -- creating a second hold.
  select * into v_existing
  from public.integration_reservations
  where platform_id = p_platform_id
    and external_order_id = trim(p_external_order_id)
    and voucher_id = v_voucher.id
    and status = 'active'
  limit 1;

  if v_existing.id is not null then
    select coalesce(sum(amount_minor), 0) into v_balance
    from public.ledger_entries
    where voucher_id = v_voucher.id;

    select coalesce(sum(amount_minor), 0) into v_reserved
    from public.integration_reservations
    where voucher_id = v_voucher.id
      and status = 'active';

    v_available := greatest(v_balance - v_reserved, 0);

    return query
      select v_existing.id, v_existing.reference, v_existing.status,
        v_voucher.id,
        left(coalesce(v_voucher.voucher_code, 'GFT'), 4) || '••••' || right(coalesce(v_voucher.voucher_code, ''), 6),
        (select name from public.vendors where id = v_voucher.vendor_id),
        v_existing.currency, v_existing.amount_minor, v_balance, v_reserved,
        v_available, p_order_amount_minor,
        greatest(p_order_amount_minor - v_existing.amount_minor, 0),
        v_existing.expires_at;
    return;
  end if;

  v_reference := public.integration_make_reservation_reference();

  insert into public.integration_reservations (
    reference, platform_id, mapping_id, voucher_id, vendor_id,
    external_order_id, external_branch_id, amount_minor, currency,
    status, idempotency_key, expires_at
  )
  values (
    v_reference, p_platform_id, p_mapping_id, v_voucher.id, v_mapping.vendor_id,
    trim(p_external_order_id), nullif(trim(coalesce(p_external_branch_id, '')), ''),
    v_amount, upper(p_currency), 'active', p_idempotency_key,
    now() + make_interval(secs => v_ttl)
  )
  on conflict (platform_id, idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existing
    from public.integration_reservations
    where platform_id = p_platform_id
      and idempotency_key = p_idempotency_key;

    if v_existing.id is null then
      raise exception 'idempotency conflict';
    end if;
    if v_existing.voucher_id <> v_voucher.id
       or v_existing.external_order_id <> trim(p_external_order_id) then
      raise exception 'idempotency conflict';
    end if;

    v_id := v_existing.id;
    v_reference := v_existing.reference;
    v_amount := v_existing.amount_minor;

    select coalesce(sum(amount_minor), 0) into v_balance
    from public.ledger_entries
    where voucher_id = v_voucher.id;

    select coalesce(sum(amount_minor), 0) into v_reserved
    from public.integration_reservations
    where voucher_id = v_voucher.id
      and status = 'active';

    v_available := greatest(v_balance - v_reserved, 0);

    return query
      select v_existing.id, v_existing.reference, v_existing.status,
        v_voucher.id,
        left(coalesce(v_voucher.voucher_code, 'GFT'), 4) || '••••' || right(coalesce(v_voucher.voucher_code, ''), 6),
        (select name from public.vendors where id = v_voucher.vendor_id),
        v_existing.currency, v_existing.amount_minor, v_balance, v_reserved,
        v_available, p_order_amount_minor,
        greatest(p_order_amount_minor - v_existing.amount_minor, 0),
        v_existing.expires_at;
    return;
  end if;

  perform public.write_audit(
    'integration_reservation_created',
    'integration_reservation',
    v_id::text,
    null,
    jsonb_build_object(
      'platform_id', p_platform_id,
      'mapping_id', p_mapping_id,
      'voucher_id', v_voucher.id,
      'amount_minor', v_amount,
      'external_order_id', p_external_order_id
    )
  );

  return query
    select v_id, v_reference, 'active'::text, v_voucher.id,
      left(coalesce(v_voucher.voucher_code, 'GFT'), 4) || '••••' || right(coalesce(v_voucher.voucher_code, ''), 6),
      (select name from public.vendors where id = v_voucher.vendor_id),
      upper(p_currency), v_amount, v_balance, v_reserved,
      greatest(v_available - v_amount, 0), p_order_amount_minor,
      greatest(p_order_amount_minor - v_amount, 0),
      now() + make_interval(secs => v_ttl);
end;
$$;

revoke all on function public.integration_reserve(uuid, uuid, text, text, text, bigint, bigint, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.integration_reserve(uuid, uuid, text, text, text, bigint, bigint, text, integer, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Capture
-- ---------------------------------------------------------------------------
create or replace function public.integration_capture(
  p_platform_id uuid,
  p_reservation_reference text,
  p_external_payment_reference text,
  p_confirmed_order_amount_minor bigint,
  p_currency text,
  p_idempotency_key text,
  p_mapping_id uuid default null
)
returns table (
  reservation_id uuid,
  reservation_reference text,
  status text,
  redemption_id uuid,
  redemption_reference text,
  amount_minor bigint,
  currency text,
  masked_code text,
  vendor_name text,
  new_balance_minor bigint,
  captured_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_platform public.integration_platforms%rowtype;
  v_mapping public.integration_vendor_mappings%rowtype;
  v_res public.integration_reservations%rowtype;
  v_voucher public.vouchers%rowtype;
  v_redemption public.redemptions%rowtype;
  v_result record;
  v_grace integer;
  v_balance bigint;
  v_reason text;
begin
  select * into v_platform
  from public.integration_platforms
  where id = p_platform_id;

  if v_platform.id is null or v_platform.status <> 'active' then
    raise exception 'platform not active';
  end if;

  select * into v_res
  from public.integration_reservations
  where reference = p_reservation_reference
    and platform_id = p_platform_id
  for update;

  if v_res.id is null then
    raise exception 'reservation not found';
  end if;

  if p_mapping_id is not null then
    select * into v_mapping
    from public.integration_vendor_mappings
    where id = p_mapping_id
      and platform_id = p_platform_id;

    if v_mapping.id is null then
      raise exception 'mapping not found';
    end if;
    if v_mapping.status <> 'active' then
      raise exception 'mapping not active';
    end if;
    if v_res.vendor_id is distinct from v_mapping.vendor_id then
      raise exception 'wrong business';
    end if;
  end if;

  select * into v_voucher from public.vouchers where id = v_res.voucher_id;

  if v_res.status = 'captured' then
    select * into v_redemption from public.redemptions where id = v_res.redemption_id;

    select coalesce(sum(amount_minor), 0) into v_balance
    from public.ledger_entries
    where voucher_id = v_res.voucher_id;

    return query
      select v_res.id, v_res.reference, v_res.status, v_res.redemption_id,
        v_redemption.reference, v_res.amount_minor, v_res.currency,
        left(coalesce(v_voucher.voucher_code, 'GFT'), 4) || '••••' || right(coalesce(v_voucher.voucher_code, ''), 6),
        (select name from public.vendors where id = v_res.vendor_id),
        v_balance, v_res.captured_at;
    return;
  end if;

  if v_res.status in ('released', 'expired') then
    raise exception 'reservation not capturable';
  end if;

  if v_res.status = 'reconciliation' then
    return query
      select v_res.id, v_res.reference, v_res.status, v_res.redemption_id,
        null::text, v_res.amount_minor, v_res.currency,
        left(coalesce(v_voucher.voucher_code, 'GFT'), 4) || '••••' || right(coalesce(v_voucher.voucher_code, ''), 6),
        (select name from public.vendors where id = v_res.vendor_id),
        null::bigint, v_res.captured_at;
    return;
  end if;

  if p_currency is null or upper(p_currency) <> upper(v_res.currency) then
    raise exception 'currency mismatch';
  end if;

  v_grace := coalesce((v_platform.config ->> 'capture_grace_seconds')::integer, 900);

  if v_res.expires_at <= now()
     and now() > v_res.expires_at + make_interval(secs => greatest(v_grace, 0)) then
    update public.integration_reservations
    set status = 'reconciliation', updated_at = now()
    where id = v_res.id;

    insert into public.integration_reconciliation_cases (
      platform_id, reservation_id, external_order_id, reason, evidence
    )
    values (
      p_platform_id, v_res.id, v_res.external_order_id, 'capture_after_expiry',
      jsonb_build_object('expires_at', v_res.expires_at, 'grace_seconds', v_grace)
    );

    return query
      select v_res.id, v_res.reference, 'reconciliation'::text, null::uuid,
        null::text, v_res.amount_minor, v_res.currency,
        left(coalesce(v_voucher.voucher_code, 'GFT'), 4) || '••••' || right(coalesce(v_voucher.voucher_code, ''), 6),
        (select name from public.vendors where id = v_res.vendor_id),
        null::bigint, null::timestamptz;
    return;
  end if;

  update public.integration_reservations
  set capture_started_at = coalesce(capture_started_at, now()), updated_at = now()
  where id = v_res.id;

  begin
    select * into v_result
    from public.redeem_monetary_internal(
      v_res.voucher_id,
      v_res.amount_minor,
      v_res.vendor_id,
      'External platform capture ' || v_res.reference,
      'external_platform',
      p_platform_id,
      v_res.external_order_id,
      v_res.external_branch_id,
      v_res.id,
      p_idempotency_key,
      jsonb_build_object(
        'external_payment_reference', p_external_payment_reference,
        'confirmed_order_amount_minor', p_confirmed_order_amount_minor
      )
    );
  exception when others then
    v_reason := sqlerrm;

    if v_reason in (
      'insufficient balance', 'no balance', 'voucher not redeemable',
      'voucher expired', 'voucher is not a monetary voucher', 'not allowed'
    ) then
      update public.integration_reservations
      set status = 'reconciliation', updated_at = now()
      where id = v_res.id;

      insert into public.integration_reconciliation_cases (
        platform_id, reservation_id, external_order_id, reason, evidence
      )
      values (
        p_platform_id, v_res.id, v_res.external_order_id, 'capture_failed_' || v_reason,
        jsonb_build_object('error', v_reason, 'amount_minor', v_res.amount_minor)
      );

      return query
        select v_res.id, v_res.reference, 'reconciliation'::text, null::uuid,
          null::text, v_res.amount_minor, v_res.currency,
          left(coalesce(v_voucher.voucher_code, 'GFT'), 4) || '••••' || right(coalesce(v_voucher.voucher_code, ''), 6),
          (select name from public.vendors where id = v_res.vendor_id),
          null::bigint, null::timestamptz;
      return;
    end if;

    raise;
  end;

  update public.integration_reservations
  set status = 'captured',
      redemption_id = v_result.redemption_id,
      captured_at = now(),
      external_payment_reference = p_external_payment_reference,
      updated_at = now()
  where id = v_res.id;

  update public.integration_external_orders
  set reservation_id = v_res.id,
      payment_status = 'captured',
      updated_at = now()
  where platform_id = p_platform_id
    and external_order_id = v_res.external_order_id;

  perform public.write_audit(
    'integration_reservation_captured',
    'integration_reservation',
    v_res.id::text,
    jsonb_build_object('status', 'active'),
    jsonb_build_object(
      'status', 'captured',
      'redemption_id', v_result.redemption_id,
      'amount_minor', v_res.amount_minor
    )
  );

  return query
    select v_res.id, v_res.reference, 'captured'::text, v_result.redemption_id,
      v_result.redemption_reference, v_res.amount_minor, v_res.currency,
      left(coalesce(v_voucher.voucher_code, 'GFT'), 4) || '••••' || right(coalesce(v_voucher.voucher_code, ''), 6),
      (select name from public.vendors where id = v_res.vendor_id),
      v_result.new_balance_minor, now();
end;
$$;

revoke all on function public.integration_capture(uuid, text, text, bigint, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.integration_capture(uuid, text, text, bigint, text, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Release
-- ---------------------------------------------------------------------------
create or replace function public.integration_release(
  p_platform_id uuid,
  p_reservation_reference text,
  p_reason text,
  p_idempotency_key text,
  p_mapping_id uuid default null
)
returns table (
  reservation_id uuid,
  reservation_reference text,
  status text,
  released_at timestamptz,
  release_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform public.integration_platforms%rowtype;
  v_mapping public.integration_vendor_mappings%rowtype;
  v_res public.integration_reservations%rowtype;
begin
  select * into v_platform
  from public.integration_platforms
  where id = p_platform_id;

  if v_platform.id is null or v_platform.status <> 'active' then
    raise exception 'platform not active';
  end if;

  select * into v_res
  from public.integration_reservations
  where reference = p_reservation_reference
    and platform_id = p_platform_id
  for update;

  if v_res.id is null then
    raise exception 'reservation not found';
  end if;

  if p_mapping_id is not null then
    select * into v_mapping
    from public.integration_vendor_mappings
    where id = p_mapping_id
      and platform_id = p_platform_id;

    if v_mapping.id is null then
      raise exception 'mapping not found';
    end if;
    if v_mapping.status <> 'active' then
      raise exception 'mapping not active';
    end if;
    if v_res.vendor_id is distinct from v_mapping.vendor_id then
      raise exception 'wrong business';
    end if;
  end if;

  if v_res.status = 'captured' then
    raise exception 'reservation already captured';
  end if;

  if v_res.status = 'reconciliation' then
    raise exception 'reconciliation required';
  end if;

  if v_res.status = 'active' then
    update public.integration_reservations
    set status = 'released',
        released_at = now(),
        release_reason = coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'released'),
        updated_at = now()
    where id = v_res.id;

    perform public.write_audit(
      'integration_reservation_released',
      'integration_reservation',
      v_res.id::text,
      jsonb_build_object('status', 'active'),
      jsonb_build_object('status', 'released', 'reason', p_reason)
    );

    select * into v_res from public.integration_reservations where id = v_res.id;
  end if;

  return query
    select v_res.id, v_res.reference, v_res.status, v_res.released_at, v_res.release_reason;
end;
$$;

revoke all on function public.integration_release(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.integration_release(uuid, text, text, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Status
-- ---------------------------------------------------------------------------
create or replace function public.integration_status(
  p_platform_id uuid,
  p_reservation_reference text
)
returns table (
  reservation_id uuid,
  reservation_reference text,
  status text,
  external_order_id text,
  amount_minor bigint,
  currency text,
  expires_at timestamptz,
  captured_at timestamptz,
  released_at timestamptz,
  redemption_id uuid,
  redemption_reference text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res public.integration_reservations%rowtype;
  v_redemption public.redemptions%rowtype;
begin
  select * into v_res
  from public.integration_reservations
  where reference = p_reservation_reference
    and platform_id = p_platform_id;

  if v_res.id is null then
    raise exception 'reservation not found';
  end if;

  if v_res.redemption_id is not null then
    select * into v_redemption from public.redemptions where id = v_res.redemption_id;
  end if;

  return query
    select v_res.id, v_res.reference, v_res.status, v_res.external_order_id,
      v_res.amount_minor, v_res.currency, v_res.expires_at, v_res.captured_at,
      v_res.released_at, v_res.redemption_id, v_redemption.reference;
end;
$$;

revoke all on function public.integration_status(uuid, text)
  from public, anon, authenticated;
grant execute on function public.integration_status(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Refund (redemption reversal)
-- ---------------------------------------------------------------------------
create or replace function public.integration_refund(
  p_platform_id uuid,
  p_redemption_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_idempotency_key text,
  p_mapping_id uuid default null
)
returns table (
  refund_id uuid,
  redemption_id uuid,
  amount_minor bigint,
  new_balance_minor bigint,
  new_status public.voucher_status,
  fully_refunded boolean,
  already_refunded_minor bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform public.integration_platforms%rowtype;
  v_mapping public.integration_vendor_mappings%rowtype;
  v_redemption public.redemptions%rowtype;
  v_voucher public.vouchers%rowtype;
  v_existing public.integration_refunds%rowtype;
  v_refund_id uuid;
  v_already bigint;
  v_balance bigint;
  v_new_balance bigint;
  v_new_status public.voucher_status;
  v_full boolean;
begin
  select * into v_platform
  from public.integration_platforms
  where id = p_platform_id;

  if v_platform.id is null or v_platform.status <> 'active' then
    raise exception 'platform not active';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select * into v_redemption
  from public.redemptions
  where id = p_redemption_id
  for update;

  if v_redemption.id is null then
    raise exception 'redemption not found';
  end if;
  if v_redemption.kind <> 'monetary'
     or v_redemption.channel <> 'external_platform'
     or v_redemption.platform_id is distinct from p_platform_id then
    raise exception 'refund not allowed';
  end if;

  if p_mapping_id is not null then
    select * into v_mapping
    from public.integration_vendor_mappings
    where id = p_mapping_id
      and platform_id = p_platform_id;

    if v_mapping.id is null then
      raise exception 'mapping not found';
    end if;
    if v_mapping.status <> 'active' then
      raise exception 'mapping not active';
    end if;
    if v_redemption.vendor_id is distinct from v_mapping.vendor_id then
      raise exception 'wrong business';
    end if;
  end if;

  select * into v_voucher
  from public.vouchers
  where id = v_redemption.voucher_id
  for update;

  if v_voucher.id is null then
    raise exception 'voucher not found';
  end if;

  -- Replay the original response for the same idempotency key.
  select * into v_existing
  from public.integration_refunds
  where platform_id = p_platform_id
    and idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    select coalesce(sum(amount_minor), 0) into v_balance
    from public.ledger_entries
    where voucher_id = v_voucher.id;

    return query
      select v_existing.id, v_existing.redemption_id, v_existing.amount_minor,
        v_balance, v_voucher.status,
        (v_redemption.status = 'reversed'),
        coalesce((
          select sum(amount_minor) from public.integration_refunds
          where redemption_id = v_redemption.id and status = 'completed'
        ), 0);
    return;
  end if;

  select coalesce(sum(amount_minor), 0) into v_already
  from public.integration_refunds
  where redemption_id = v_redemption.id
    and status = 'completed';

  if p_amount_minor > coalesce(v_redemption.amount_minor, 0) - v_already then
    raise exception 'invalid amount';
  end if;

  insert into public.integration_refunds (
    platform_id, reservation_id, redemption_id, voucher_id, vendor_id,
    external_order_id, amount_minor, currency, status, idempotency_key,
    reason, created_by
  )
  values (
    p_platform_id, v_redemption.reservation_id, v_redemption.id, v_redemption.voucher_id,
    v_redemption.vendor_id, v_redemption.external_order_id, p_amount_minor,
    v_voucher.currency, 'completed', p_idempotency_key, p_reason, auth.uid()
  )
  returning id into v_refund_id;

  -- A reversal is a positive refund entry. It is deliberately separate from the
  -- purchase-refund trigger in 0135, which reacts to negative financial_ledger
  -- refunds and is untouched.
  insert into public.ledger_entries (voucher_id, entry_type, amount_minor, redemption_id, staff_user_id)
  values (v_voucher.id, 'refund', p_amount_minor, v_redemption.id, auth.uid());

  select coalesce(sum(amount_minor), 0) into v_new_balance
  from public.ledger_entries
  where voucher_id = v_voucher.id;

  if v_new_balance <= 0 then
    v_new_status := 'redeemed';
  elsif v_new_balance >= coalesce(v_voucher.initial_value_minor, v_new_balance) then
    v_new_status := 'active';
  else
    v_new_status := 'partially_redeemed';
  end if;

  update public.vouchers
  set remaining_value_minor = greatest(v_new_balance, 0),
      status = v_new_status,
      redeemed_at = case when v_new_balance > 0 then null else redeemed_at end,
      updated_at = now()
  where id = v_voucher.id;

  v_full := (v_already + p_amount_minor) >= coalesce(v_redemption.amount_minor, 0);

  if v_full then
    update public.redemptions
    set status = 'reversed'
    where id = v_redemption.id;
  end if;

  perform public.write_audit(
    'integration_redemption_refunded',
    'redemption',
    v_redemption.id::text,
    jsonb_build_object('amount_minor', v_redemption.amount_minor, 'already_refunded_minor', v_already),
    jsonb_build_object(
      'refund_id', v_refund_id,
      'amount_minor', p_amount_minor,
      'new_balance_minor', v_new_balance,
      'fully_refunded', v_full
    )
  );

  return query
    select v_refund_id, v_redemption.id, p_amount_minor, v_new_balance,
      v_new_status, v_full, v_already + p_amount_minor;
end;
$$;

revoke all on function public.integration_refund(uuid, uuid, bigint, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.integration_refund(uuid, uuid, bigint, text, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Reservation expiry (cron)
-- ---------------------------------------------------------------------------
create or replace function public.integration_expire_reservations(p_limit integer default 500)
returns table (expired_count integer, reconciliation_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer := 0;
  v_reconciliation integer := 0;
begin
  with stale as (
    select id
    from public.integration_reservations
    where status = 'active'
      and expires_at <= now()
      and capture_started_at is null
    order by expires_at
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  )
  update public.integration_reservations r
  set status = 'expired',
      released_at = now(),
      release_reason = 'expired',
      updated_at = now()
  from stale
  where r.id = stale.id;

  GET DIAGNOSTICS v_expired = ROW_COUNT;

  with stuck as (
    select id
    from public.integration_reservations
    where status = 'active'
      and expires_at <= now()
      and capture_started_at is not null
    order by expires_at
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  ),
  moved as (
    update public.integration_reservations r
    set status = 'reconciliation', updated_at = now()
    from stuck
    where r.id = stuck.id
    returning r.id, r.platform_id, r.external_order_id, r.expires_at
  )
  insert into public.integration_reconciliation_cases (
    platform_id, reservation_id, external_order_id, reason, evidence
  )
  select platform_id, id, external_order_id, 'capture_started_then_expired',
    jsonb_build_object('expires_at', expires_at)
  from moved;

  GET DIAGNOSTICS v_reconciliation = ROW_COUNT;

  return query select v_expired, v_reconciliation;
end;
$$;

revoke all on function public.integration_expire_reservations(integer)
  from public, anon, authenticated;
grant execute on function public.integration_expire_reservations(integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- Order events
-- ---------------------------------------------------------------------------
create or replace function public.integration_process_order_event(
  p_platform_id uuid,
  p_event_id text,
  p_event_type text,
  p_external_order_id text,
  p_reservation_reference text default null,
  p_amount_minor bigint default null,
  p_currency text default null,
  p_occurred_at timestamptz default null,
  p_payload jsonb default '{}'::jsonb
)
returns table (
  duplicate boolean,
  event_type text,
  external_order_id text,
  order_status text,
  reservation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform public.integration_platforms%rowtype;
  v_order public.integration_external_orders%rowtype;
  v_res public.integration_reservations%rowtype;
  v_event_id uuid;
  v_type text := lower(trim(coalesce(p_event_type, '')));
begin
  select * into v_platform
  from public.integration_platforms
  where id = p_platform_id;

  if v_platform.id is null or v_platform.status <> 'active' then
    raise exception 'platform not active';
  end if;
  if p_event_id is null or trim(p_event_id) = '' then
    raise exception 'invalid request';
  end if;
  if p_external_order_id is null or trim(p_external_order_id) = '' then
    raise exception 'invalid request';
  end if;
  if p_currency is null or trim(p_currency) = '' then
    raise exception 'invalid request';
  end if;

  insert into public.webhook_events (provider, event_id, event_type, payload, processed_at)
  values (
    'integration:' || v_platform.code,
    trim(p_event_id),
    v_type,
    coalesce(p_payload, '{}'::jsonb),
    now()
  )
  on conflict (provider, event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select * into v_order
    from public.integration_external_orders
    where platform_id = p_platform_id
      and external_order_id = trim(p_external_order_id);

    if p_reservation_reference is not null then
      select * into v_res
      from public.integration_reservations
      where platform_id = p_platform_id
        and reference = p_reservation_reference;
    end if;

    return query
      select true, v_type, trim(p_external_order_id),
        v_order.status, v_res.status;
    return;
  end if;

  insert into public.integration_external_orders (
    platform_id, external_order_id, currency, order_amount_minor,
    eligible_amount_minor, status, metadata
  )
  values (
    p_platform_id, trim(p_external_order_id), upper(p_currency),
    greatest(coalesce(p_amount_minor, 0), 0), 0, 'initiated',
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (platform_id, external_order_id) do update
  set order_amount_minor = greatest(integration_external_orders.order_amount_minor, excluded.order_amount_minor),
      metadata = integration_external_orders.metadata || excluded.metadata,
      updated_at = now()
  returning * into v_order;

  if upper(v_order.currency) <> upper(p_currency) then
    raise exception 'currency mismatch';
  end if;

  if p_reservation_reference is not null then
    select * into v_res
    from public.integration_reservations
    where platform_id = p_platform_id
      and reference = p_reservation_reference
    for update;

    if v_res.id is not null then
      update public.integration_external_orders
      set reservation_id = v_res.id,
          mapping_id = coalesce(mapping_id, v_res.mapping_id),
          updated_at = now()
      where id = v_order.id;
    end if;
  end if;

  if v_type = 'order.paid' then
    update public.integration_external_orders
    set status = 'paid', payment_status = 'paid', updated_at = now()
    where id = v_order.id;
  elsif v_type in ('order.cancelled', 'order.canceled') then
    update public.integration_external_orders
    set status = 'cancelled', updated_at = now()
    where id = v_order.id;

    if v_res.id is not null and v_res.status = 'active' then
      update public.integration_reservations
      set status = 'released',
          released_at = now(),
          release_reason = 'order_cancelled',
          updated_at = now()
      where id = v_res.id;

      perform public.write_audit(
        'integration_reservation_released',
        'integration_reservation',
        v_res.id::text,
        jsonb_build_object('status', 'active'),
        jsonb_build_object('status', 'released', 'reason', 'order_cancelled')
      );
    end if;
  elsif v_type = 'order.refunded' then
    update public.integration_external_orders
    set status = 'refunded', updated_at = now()
    where id = v_order.id;

    if v_res.id is not null and v_res.status = 'captured' then
      insert into public.integration_reconciliation_cases (
        platform_id, reservation_id, external_order_id, reason, evidence
      )
      values (
        p_platform_id, v_res.id, trim(p_external_order_id), 'order_refunded_requires_reversal',
        jsonb_build_object('event_id', p_event_id, 'payload', p_payload)
      );
    end if;
  elsif v_type in ('order.pending', 'order.created') then
    update public.integration_external_orders
    set status = 'pending_payment', updated_at = now()
    where id = v_order.id;
  elsif v_type not in ('order.paid', 'order.cancelled', 'order.canceled', 'order.refunded') then
    -- Unknown event types are stored but never invent a state transition.
    null;
  end if;

  select * into v_order from public.integration_external_orders where id = v_order.id;
  if v_res.id is not null then
    select * into v_res from public.integration_reservations where id = v_res.id;
  end if;

  return query
    select false, v_type, trim(p_external_order_id), v_order.status, v_res.status;
end;
$$;

revoke all on function public.integration_process_order_event(uuid, text, text, text, text, bigint, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.integration_process_order_event(uuid, text, text, text, text, bigint, text, timestamptz, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Idempotency operations
-- ---------------------------------------------------------------------------
create or replace function public.integration_claim_operation(
  p_platform_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  state text,
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_row public.integration_operations%rowtype;
begin
  if p_idempotency_key is null or trim(p_idempotency_key) = '' then
    raise exception 'invalid request';
  end if;

  insert into public.integration_operations (
    platform_id, operation, idempotency_key, request_hash
  )
  values (p_platform_id, p_operation, p_idempotency_key, p_request_hash)
  on conflict (platform_id, operation, idempotency_key) do nothing
  returning id into v_id;

  if v_id is not null then
    return query select 'claimed'::text, null::integer, null::jsonb, null::text, null::uuid;
    return;
  end if;

  select * into v_row
  from public.integration_operations
  where platform_id = p_platform_id
    and operation = p_operation
    and idempotency_key = p_idempotency_key;

  if v_row.request_hash <> p_request_hash then
    return query select 'conflict'::text, null::integer, null::jsonb, null::text, null::uuid;
    return;
  end if;

  if v_row.response_status is null then
    return query select 'in_progress'::text, null::integer, null::jsonb, v_row.resource_type, v_row.resource_id;
    return;
  end if;

  return query
    select 'replay'::text, v_row.response_status, v_row.response_body,
      v_row.resource_type, v_row.resource_id;
end;
$$;

create or replace function public.integration_complete_operation(
  p_platform_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_response_status integer,
  p_response_body jsonb,
  p_resource_type text default null,
  p_resource_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.integration_operations
  set response_status = p_response_status,
      response_body = p_response_body,
      resource_type = p_resource_type,
      resource_id = p_resource_id,
      completed_at = now()
  where platform_id = p_platform_id
    and operation = p_operation
    and idempotency_key = p_idempotency_key;
end;
$$;

create or replace function public.integration_abandon_operation(
  p_platform_id uuid,
  p_operation text,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.integration_operations
  where platform_id = p_platform_id
    and operation = p_operation
    and idempotency_key = p_idempotency_key
    and response_status is null;
end;
$$;

revoke all on function public.integration_claim_operation(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.integration_complete_operation(uuid, text, text, integer, jsonb, text, uuid)
  from public, anon, authenticated;
revoke all on function public.integration_abandon_operation(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.integration_claim_operation(uuid, text, text, text) to service_role;
grant execute on function public.integration_complete_operation(uuid, text, text, integer, jsonb, text, uuid) to service_role;
grant execute on function public.integration_abandon_operation(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.integration_reservations enable row level security;
alter table public.integration_operations enable row level security;
alter table public.integration_external_orders enable row level security;
alter table public.integration_refunds enable row level security;
alter table public.integration_reconciliation_cases enable row level security;

drop policy if exists integration_reservations_select on public.integration_reservations;
create policy integration_reservations_select on public.integration_reservations
  for select to authenticated
  using (public.is_admin() or public.can_manage_vendor(vendor_id));

drop policy if exists integration_operations_admin_select on public.integration_operations;
create policy integration_operations_admin_select on public.integration_operations
  for select to authenticated
  using (public.is_admin());

drop policy if exists integration_external_orders_select on public.integration_external_orders;
create policy integration_external_orders_select on public.integration_external_orders
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.integration_reservations r
      where r.id = integration_external_orders.reservation_id
        and public.can_manage_vendor(r.vendor_id)
    )
  );

drop policy if exists integration_refunds_select on public.integration_refunds;
create policy integration_refunds_select on public.integration_refunds
  for select to authenticated
  using (public.is_admin() or public.can_manage_vendor(vendor_id));

drop policy if exists integration_reconciliation_admin_select on public.integration_reconciliation_cases;
create policy integration_reconciliation_admin_select on public.integration_reconciliation_cases
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin-friendly read view
-- ---------------------------------------------------------------------------
create or replace view public.integration_vendor_connections
with (security_invoker = true) as
select
  m.id as mapping_id,
  p.code as platform_code,
  p.name as platform_name,
  p.status as platform_status,
  m.status as mapping_status,
  m.vendor_id,
  v.name as vendor_name,
  m.external_vendor_id,
  m.external_vendor_name,
  m.external_branch_id,
  m.internal_location_id,
  m.verification_method,
  m.verified_at,
  m.activated_at,
  m.suspended_at,
  m.disconnected_at,
  m.created_at,
  m.updated_at
from public.integration_vendor_mappings m
join public.integration_platforms p on p.id = m.platform_id
left join public.vendors v on v.id = m.vendor_id;

grant select on public.integration_vendor_connections to authenticated, service_role;
