-- 0177_integration_variable_conflict.sql
--
-- OUT parameters of these RPCs share names with columns they query
-- (`voucher_id`, `status`, `external_order_id`), causing SQLSTATE 42702.
-- Re-define them with the PL/pgSQL directive that resolves unqualified names
-- to columns. Only these three functions are changed.
--
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
#variable_conflict use_column
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
#variable_conflict use_column
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
#variable_conflict use_column
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
revoke all on function public.integration_card_state(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.integration_card_state(uuid,uuid,text,text) to service_role;

revoke all on function public.integration_reserve(uuid,uuid,text,text,text,bigint,bigint,text,integer,text) from public, anon, authenticated;
grant execute on function public.integration_reserve(uuid,uuid,text,text,text,bigint,bigint,text,integer,text) to service_role;

revoke all on function public.integration_process_order_event(uuid,text,text,text,text,bigint,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.integration_process_order_event(uuid,text,text,text,text,bigint,text,timestamptz,jsonb) to service_role;
