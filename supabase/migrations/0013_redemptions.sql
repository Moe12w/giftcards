-- 0013_redemptions.sql
-- One redemption history for every fulfilment type, with the fulfilment logic
-- kept strictly separate.
--
--   redeem_monetary → money only,  writes a signed amount to the ledger
--   redeem_session  → sessions only, writes a signed session count
--   enterprise codes → a status event (see 0014)
--
-- Every function locks the voucher row, checks the balance or sessions,
-- writes the history row and updates the cached counter in one transaction.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.redemption_kind as enum (
    'monetary',
    'session',
    'enterprise_code'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.redemption_status as enum (
    'completed',
    'reversed'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- redemptions: the shared history
-- ---------------------------------------------------------------------------
create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  voucher_id uuid references public.vouchers (id) on delete set null,
  vendor_id uuid references public.vendors (id) on delete set null,
  staff_user_id uuid references auth.users (id) on delete set null,
  kind public.redemption_kind not null,
  -- Monetary redemptions.
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  -- Session redemptions.
  sessions integer check (sessions is null or sessions > 0),
  quantity integer not null default 1 check (quantity > 0),
  status public.redemption_status not null default 'completed',
  service_label text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists redemptions_voucher_idx on public.redemptions (voucher_id, occurred_at desc);
create index if not exists redemptions_vendor_idx on public.redemptions (vendor_id, occurred_at desc);
create index if not exists redemptions_staff_idx on public.redemptions (staff_user_id, occurred_at desc);

create table if not exists public.redemption_items (
  id uuid primary key default gen_random_uuid(),
  redemption_id uuid not null references public.redemptions (id) on delete cascade,
  voucher_id uuid references public.vouchers (id) on delete set null,
  sessions integer check (sessions is null or sessions > 0),
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  service_label text,
  staff_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists redemption_items_redemption_idx on public.redemption_items (redemption_id);

-- ---------------------------------------------------------------------------
-- Reference generator
-- ---------------------------------------------------------------------------
create or replace function public.make_redemption_reference()
returns text
language sql
volatile
as $$
  select 'RDM-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
$$;

-- ---------------------------------------------------------------------------
-- Validate a voucher before redemption.
-- The redemption screen calls this so staff always see the type before they
-- choose a redemption method.
-- ---------------------------------------------------------------------------
create or replace function public.voucher_for_redemption(p_code text)
returns table (
  voucher_id uuid,
  voucher_code text,
  product_name text,
  vendor_id uuid,
  vendor_name text,
  fulfilment_type public.fulfilment_type,
  status public.voucher_status,
  balance_minor bigint,
  total_sessions integer,
  remaining_sessions integer,
  expires_at timestamptz,
  multi_session_per_visit boolean,
  split_session_allowed boolean,
  booking_required boolean,
  can_redeem boolean,
  blocked_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_product public.products%rowtype;
  v_balance bigint;
  v_sessions integer;
begin
  select * into v_voucher
  from public.vouchers
  where voucher_code = upper(trim(p_code))
     or card_code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  limit 1;

  if v_voucher.id is null then
    raise exception 'voucher not found';
  end if;

  select * into v_product from public.products where id = v_voucher.product_id;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries where voucher_id = v_voucher.id;

  select coalesce(sum(sessions), 0) into v_sessions
  from public.ledger_entries where voucher_id = v_voucher.id;

  return query
  select
    v_voucher.id,
    v_voucher.voucher_code,
    v_product.title,
    v_voucher.vendor_id,
    (select name from public.vendors where id = v_voucher.vendor_id),
    v_voucher.fulfilment_type,
    v_voucher.status,
    case when v_voucher.fulfilment_type = 'monetary' then v_balance else null end,
    v_voucher.total_sessions,
    case when v_voucher.fulfilment_type = 'experience' then v_sessions else null end,
    v_voucher.expires_at,
    coalesce(v_product.multi_session_per_visit, true),
    coalesce(v_product.split_session_allowed, true),
    coalesce(v_product.booking_required, false),
    (
      v_voucher.status in ('claimed', 'issued', 'active', 'partially_redeemed')
      and (v_voucher.expires_at is null or v_voucher.expires_at > now())
      and (
        (v_voucher.fulfilment_type = 'monetary' and v_balance > 0)
        or (v_voucher.fulfilment_type = 'experience' and v_sessions > 0)
      )
    ),
    (
      case
        when v_voucher.status not in ('claimed', 'issued', 'active', 'partially_redeemed')
          then 'voucher not redeemable'
        when v_voucher.expires_at is not null and v_voucher.expires_at <= now()
          then 'voucher expired'
        when v_voucher.fulfilment_type = 'monetary' and v_balance <= 0
          then 'no balance left'
        when v_voucher.fulfilment_type = 'experience' and v_sessions <= 0
          then 'no sessions left'
        else null
      end
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Monetary redemption
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
  v_balance bigint;
  v_new_balance bigint;
  v_allowed boolean;
  v_redemption_id uuid;
  v_reference text;
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

  -- An experience voucher never uses the money path.
  if v_voucher.fulfilment_type <> 'monetary' then
    raise exception 'voucher is not a monetary voucher';
  end if;

  select exists (
    select 1
    from public.vendors v
    where v.id = v_voucher.vendor_id
      and public.can_redeem_for(v.id)
  ) into v_allowed;

  if not v_allowed then
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

  if v_balance <= 0 then
    raise exception 'no balance';
  end if;

  if p_amount_minor > v_balance then
    raise exception 'insufficient balance';
  end if;

  v_reference := public.make_redemption_reference();

  insert into public.redemptions (
    reference, voucher_id, vendor_id, staff_user_id, kind, amount_minor, quantity, notes
  )
  values (
    v_reference, p_voucher_id, v_voucher.vendor_id, auth.uid(), 'monetary', p_amount_minor, 1, p_notes
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
    'monetary_redemption', 'voucher', p_voucher_id::text,
    jsonb_build_object('balance_minor', v_balance, 'amount_minor', p_amount_minor),
    jsonb_build_object('balance_minor', v_new_balance, 'reference', v_reference)
  );

  return query
    select v_redemption_id, v_reference, v_new_balance,
      (select status from public.vouchers where id = p_voucher_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Session redemption (one visit can use several sessions)
-- ---------------------------------------------------------------------------
create or replace function public.redeem_sessions(
  p_voucher_id uuid,
  p_sessions integer,
  p_notes text default null,
  p_service_label text default null
)
returns table (
  redemption_id uuid,
  redemption_reference text,
  sessions_remaining integer,
  new_status public.voucher_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_product public.products%rowtype;
  v_remaining integer;
  v_allowed boolean;
  v_redemption_id uuid;
  v_reference text;
begin
  if p_sessions is null or p_sessions <= 0 then
    raise exception 'invalid session count';
  end if;

  select * into v_voucher
  from public.vouchers
  where id = p_voucher_id
  for update;

  if not found then
    raise exception 'voucher not found';
  end if;

  -- An experience voucher never uses the money path.
  if v_voucher.fulfilment_type <> 'experience' then
    raise exception 'voucher is not an experience voucher';
  end if;

  select * into v_product from public.products where id = v_voucher.product_id;

  select exists (
    select 1
    from public.vendors v
    where v.id = v_voucher.vendor_id
      and public.can_redeem_for(v.id)
  ) into v_allowed;

  if not v_allowed then
    raise exception 'not allowed';
  end if;

  if v_voucher.status not in ('claimed', 'issued', 'active', 'partially_redeemed') then
    raise exception 'voucher not redeemable';
  end if;

  if v_voucher.expires_at is not null and v_voucher.expires_at <= now() then
    raise exception 'voucher expired';
  end if;

  -- Rules the vendor configured on the product.
  if coalesce(v_product.multi_session_per_visit, true) = false and p_sessions > 1 then
    raise exception 'only one session may be used per visit';
  end if;

  select coalesce(sum(sessions), 0) into v_remaining
  from public.ledger_entries
  where voucher_id = p_voucher_id;

  if v_remaining <= 0 then
    raise exception 'no sessions left';
  end if;

  if p_sessions > v_remaining then
    raise exception 'not enough sessions on this voucher';
  end if;

  if coalesce(v_product.split_session_allowed, true) = false and p_sessions <> v_remaining then
    raise exception 'sessions on this voucher cannot be split';
  end if;

  v_reference := public.make_redemption_reference();

  insert into public.redemptions (
    reference, voucher_id, vendor_id, staff_user_id, kind, sessions, quantity,
    service_label, notes
  )
  values (
    v_reference, p_voucher_id, v_voucher.vendor_id, auth.uid(), 'session', p_sessions, p_sessions,
    p_service_label, p_notes
  )
  returning id into v_redemption_id;

  insert into public.redemption_items (
    redemption_id, voucher_id, sessions, service_label, staff_user_id
  )
  values (v_redemption_id, p_voucher_id, p_sessions, p_service_label, auth.uid());

  insert into public.ledger_entries (voucher_id, entry_type, amount_minor, sessions, redemption_id, staff_user_id)
  values (p_voucher_id, 'redeem', 0, -p_sessions, v_redemption_id, auth.uid());

  v_remaining := v_remaining - p_sessions;

  if v_remaining = 0 then
    update public.vouchers
    set status = 'redeemed', redeemed_at = now(), remaining_sessions = 0,
        used_sessions = used_sessions + p_sessions, updated_at = now()
    where id = p_voucher_id;
  else
    update public.vouchers
    set status = 'partially_redeemed', remaining_sessions = v_remaining,
        used_sessions = used_sessions + p_sessions, updated_at = now()
    where id = p_voucher_id;
  end if;

  perform public.write_audit(
    'session_redemption', 'voucher', p_voucher_id::text,
    jsonb_build_object('sessions_remaining', v_remaining + p_sessions, 'sessions', p_sessions),
    jsonb_build_object('sessions_remaining', v_remaining, 'reference', v_reference)
  );

  return query
    select v_redemption_id, v_reference, v_remaining,
      (select status from public.vouchers where id = p_voucher_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Convenience wrapper: one session, same rules.
-- The legacy single-session function is replaced so there is only one
-- session-redemption path, with the staff checks applied.
-- ---------------------------------------------------------------------------
drop function if exists public.redeem_session(uuid);

create or replace function public.redeem_session(p_card_id uuid)
returns table (
  card_id uuid,
  sessions_remaining integer,
  new_status public.voucher_status
)
language sql
security definer
set search_path = public
as $$
  select
    r.redemption_id as card_id,
    r.sessions_remaining,
    r.new_status
  from public.redeem_sessions(p_card_id, 1, null::text, null::text) r;
$$;

-- ---------------------------------------------------------------------------
-- Browser entry point: manual code entry from the vendor dashboard
-- ---------------------------------------------------------------------------
create or replace function public.redeem_voucher_by_code(
  p_code text,
  p_amount_minor bigint default null,
  p_sessions integer default null,
  p_notes text default null
)
returns table (
  redemption_id uuid,
  redemption_reference text,
  kind public.redemption_kind,
  remaining_value_minor bigint,
  sessions_remaining integer,
  new_status public.voucher_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_result record;
begin
  select * into v_voucher
  from public.vouchers
  where voucher_code = upper(trim(p_code))
     or card_code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  limit 1;

  if v_voucher.id is null then
    raise exception 'voucher not found';
  end if;

  if v_voucher.fulfilment_type = 'monetary' then
    select * into v_result
    from public.redeem_monetary(v_voucher.id, p_amount_minor, p_notes);
    return query
      select v_result.redemption_id, v_result.redemption_reference, 'monetary'::public.redemption_kind,
        v_result.new_balance_minor, null::integer, v_result.new_status;
  else
    select * into v_result
    from public.redeem_sessions(v_voucher.id, p_sessions, p_notes, null);
    return query
      select v_result.redemption_id, v_result.redemption_reference, 'session'::public.redemption_kind,
        null::bigint, v_result.sessions_remaining, v_result.new_status;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reconciliation: the cached counters must match the ledger.
-- Used by the test suite and the admin dashboard.
-- ---------------------------------------------------------------------------
create or replace function public.verify_voucher_balances()
returns table (
  voucher_id uuid,
  voucher_code text,
  cached_value bigint,
  ledger_value bigint,
  cached_sessions integer,
  ledger_sessions integer,
  is_consistent boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.voucher_code,
    coalesce(v.remaining_value_minor, 0),
    coalesce((select sum(amount_minor) from public.ledger_entries le where le.voucher_id = v.id), 0),
    coalesce(v.remaining_sessions, 0),
    coalesce((select sum(sessions) from public.ledger_entries le where le.voucher_id = v.id), 0),
    (
      coalesce(v.remaining_value_minor, 0)
        = coalesce((select sum(amount_minor) from public.ledger_entries le where le.voucher_id = v.id), 0)
      and coalesce(v.remaining_sessions, 0)
        = coalesce((select sum(sessions) from public.ledger_entries le where le.voucher_id = v.id), 0)
    )
  from public.vouchers v;
$$;

revoke all on function public.redeem_monetary(uuid, bigint, text) from public;
grant execute on function public.redeem_monetary(uuid, bigint, text) to authenticated;
revoke all on function public.redeem_sessions(uuid, integer, text, text) from public;
grant execute on function public.redeem_sessions(uuid, integer, text, text) to authenticated;
revoke all on function public.redeem_voucher_by_code(text, bigint, integer, text) from public;
grant execute on function public.redeem_voucher_by_code(text, bigint, integer, text) to authenticated;
revoke all on function public.voucher_for_redemption(text) from public;
grant execute on function public.voucher_for_redemption(text) to authenticated;
revoke all on function public.verify_voucher_balances() from public;
grant execute on function public.verify_voucher_balances() to authenticated, service_role;
