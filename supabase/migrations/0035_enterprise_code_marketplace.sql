-- ---------------------------------------------------------------------------
-- Enterprise codes are a marketplace, not a gift card
--
-- A partner (Snoonu, Talabat, Rafeeq) brings the codes it generated in its own
-- system, we sell them like any other gift, and the customer types the
-- partner's code into the partner's app. We do not measure usage: when the
-- code is used, the whole value is spent, so the code simply closes.
--
-- Until now the partner's code stayed encrypted and the buyer received a
-- Giftly code, so nothing could actually be used in the partner's app.
-- These functions hand the partner's own code to the buyer, close it from
-- either side, and keep the stock and the money straight.
-- ---------------------------------------------------------------------------

drop function if exists public.issue_enterprise_code(uuid, uuid);
drop function if exists public.reveal_enterprise_code(uuid);

-- ---------------------------------------------------------------------------
-- Issue a partner code for a paid order.
--
-- Reserves one of the partner's available codes, creates the buyer's gift and
-- returns the partner's own code so it can be shown and delivered.
-- ---------------------------------------------------------------------------
create or replace function public.issue_enterprise_code(
  p_order_id uuid,
  p_order_item_id uuid
)
returns table (
  voucher_id uuid,
  code text,
  denomination_minor bigint,
  currency text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_partner uuid;
  v_enterprise_product uuid;
  v_denomination bigint;
  v_currency text;
  v_expiry_days integer;
  v_expires_at timestamptz;
  v_row public.enterprise_code_inventory%rowtype;
  v_code text;
  v_voucher uuid;
  v_catalogue_product uuid;
begin
  select * into v_item from public.order_items where id = p_order_item_id;
  if not found then
    raise exception 'order item not found';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;

  if v_order.status <> 'paid' then
    raise exception 'order is not paid';
  end if;

  -- The catalogue product carries the partner's enterprise product.
  select p.enterprise_product_id, p.id
    into v_enterprise_product, v_catalogue_product
  from public.products p
  where p.id = v_item.product_id;

  if v_enterprise_product is null then
    raise exception 'this gift is not a partner code';
  end if;

  select ep.partner_id, ep.denomination_minor, ep.currency, ep.expiry_days
    into v_partner, v_denomination, v_currency, v_expiry_days
  from public.enterprise_products ep
  where ep.id = v_enterprise_product;

  if v_partner is null then
    raise exception 'partner product not found';
  end if;

  -- One code per order item.
  if exists (
    select 1 from public.vouchers
    where order_item_id = p_order_item_id
      and fulfilment_type = 'enterprise_code'
  ) then
    select id into v_voucher
    from public.vouchers
    where order_item_id = p_order_item_id
      and fulfilment_type = 'enterprise_code'
    limit 1;
    select public.decrypt_enterprise_code(ci.code_ciphertext), ci.denomination_minor, ci.currency
      into v_code, v_denomination, v_currency
    from public.enterprise_code_inventory ci
    where ci.allocated_order_item_id = p_order_item_id
    limit 1;
    return query select v_voucher, v_code, v_denomination, v_currency, v_expires_at;
    return;
  end if;

  select * into v_row
  from public.enterprise_code_inventory
  where partner_id = v_partner
    and enterprise_product_id = v_enterprise_product
    and status = 'available'
  order by created_at
  for update skip locked
  limit 1;

  if v_row.id is null then
    raise exception 'no available codes for this product';
  end if;

  update public.enterprise_code_inventory
  set
    status = 'sold',
    allocated_order_id = p_order_id,
    allocated_order_item_id = p_order_item_id,
    allocated_at = now(),
    updated_at = now()
  where id = v_row.id;

  insert into public.enterprise_code_events (inventory_id, partner_id, event_type, order_id, actor_user_id)
  values (v_row.id, v_partner, 'allocated', p_order_id, auth.uid());

  insert into public.vouchers (
    product_id, order_id, order_item_id, buyer_id, recipient_name, recipient_email,
    recipient_phone, initial_value_minor, remaining_value_minor, expires_at,
    vendor_id, fulfilment_type, status, currency, voucher_code
  )
  values (
    v_catalogue_product, p_order_id, p_order_item_id, v_order.buyer_id,
    v_item.recipient_name, v_item.recipient_email, v_item.recipient_phone,
    v_denomination, v_denomination,
    case when v_expiry_days is not null then now() + (v_expiry_days || ' days')::interval else null end,
    null, 'enterprise_code', 'issued', v_currency,
    'GFT-' || upper(substr(public.enterprise_code_fingerprint(v_partner, public.decrypt_enterprise_code(v_row.code_ciphertext)), 1, 10))
  )
  returning id into v_voucher;

  perform public.write_audit(
    'enterprise_code_issued', 'voucher', v_voucher::text,
    jsonb_build_object('partner_id', v_partner, 'inventory_id', v_row.id),
    jsonb_build_object('status', 'issued', 'order_id', p_order_id)
  );

  return query
  select v_voucher, public.decrypt_enterprise_code(v_row.code_ciphertext),
    v_denomination, v_currency,
    (select v.expires_at from public.vouchers v where v.id = v_voucher);
end;
$$;

-- ---------------------------------------------------------------------------
-- Show the partner's own code to the person who bought it.
--
-- The code is encrypted at rest, so it is only readable by the buyer, the
-- partner that owns it and an admin.
-- ---------------------------------------------------------------------------
create or replace function public.reveal_enterprise_code(p_voucher_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_code text;
  v_partner uuid;
begin
  select * into v_voucher from public.vouchers where id = p_voucher_id;
  if not found then
    raise exception 'gift not found';
  end if;

  if v_voucher.fulfilment_type <> 'enterprise_code' then
    raise exception 'this gift is not a partner code';
  end if;

  select ci.partner_id, public.decrypt_enterprise_code(ci.code_ciphertext)
    into v_partner, v_code
  from public.enterprise_code_inventory ci
  where ci.allocated_order_item_id = v_voucher.order_item_id
  limit 1;

  if v_code is null then
    raise exception 'no partner code is attached to this gift';
  end if;

  if not (
    coalesce(public.is_admin(), false)
    or coalesce(v_voucher.buyer_id = auth.uid(), false)
    or coalesce(v_voucher.claimed_by = auth.uid(), false)
    or coalesce(public.can_manage_partner(v_partner), false)
  ) then
    raise exception 'not allowed';
  end if;

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Close a partner code.
--
-- The customer taps "I've used this" after spending the credit in the
-- partner's app, or the partner reports it in bulk. Either way the whole
-- value is spent: there is no partial redemption and no session count.
-- ---------------------------------------------------------------------------
drop function if exists public.close_enterprise_code(uuid);

create or replace function public.close_enterprise_code(p_voucher_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_partner uuid;
  v_reference text;
  v_allowed boolean;
begin
  select * into v_voucher from public.vouchers v where v.id = p_voucher_id for update;
  if not found then
    raise exception 'gift not found';
  end if;

  if v_voucher.fulfilment_type <> 'enterprise_code' then
    raise exception 'this gift is not a partner code';
  end if;

  select ci.partner_id into v_partner
  from public.enterprise_code_inventory ci
  where ci.allocated_order_item_id = v_voucher.order_item_id
  limit 1;

  v_allowed := coalesce(public.is_admin(), false)
    or coalesce(v_voucher.buyer_id = auth.uid(), false)
    or coalesce(v_voucher.claimed_by = auth.uid(), false)
    or coalesce(v_partner is not null and public.can_manage_partner(v_partner), false);

  if not v_allowed then
    raise exception 'not allowed';
  end if;

  -- Already closed: answer with the same result.
  if v_voucher.status = 'redeemed' then
    return jsonb_build_object(
      'voucher_id', v_voucher.id,
      'status', 'redeemed',
      'remaining_value_minor', 0,
      'reference', 'closed'
    );
  end if;

  update public.vouchers v
  set
    status = 'redeemed',
    remaining_value_minor = 0,
    redeemed_at = now(),
    updated_at = now()
  where v.id = p_voucher_id;

  if v_partner is not null then
    update public.enterprise_code_inventory
    set status = 'redeemed', updated_at = now()
    where allocated_order_item_id = v_voucher.order_item_id
      and status in ('sold', 'delivered');

    insert into public.enterprise_code_events (inventory_id, partner_id, event_type, order_id, actor_user_id)
    select ci.id, ci.partner_id, 'confirmed_redeemed', v_voucher.order_id, auth.uid()
    from public.enterprise_code_inventory ci
    where ci.allocated_order_item_id = v_voucher.order_item_id
      and ci.status = 'redeemed'
    limit 1;
  end if;

  v_reference := 'CLS-' || upper(substr(replace(public.decrypt_enterprise_code(
    (select code_ciphertext from public.enterprise_code_inventory
     where allocated_order_item_id = v_voucher.order_item_id limit 1)
  ), '-', ''), 1, 10));

  perform public.write_audit(
    'enterprise_code_closed', 'voucher', p_voucher_id::text,
    jsonb_build_object('status', v_voucher.status),
    jsonb_build_object('status', 'redeemed', 'reference', v_reference)
  );

  return jsonb_build_object(
    'voucher_id', v_voucher.id,
    'status', 'redeemed',
    'remaining_value_minor', 0,
    'reference', v_reference
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- When an order is paid, hand the buyer a partner code for every partner
-- gift on it. This works for any channel: the app, the web, a future API.
-- ---------------------------------------------------------------------------
create or replace function public.issue_enterprise_codes_for_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  if new.status is distinct from 'paid' or old.status is not distinct from 'paid' then
    return new;
  end if;

  for v_item in
    select oi.id
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = new.id
      and p.enterprise_product_id is not null
  loop
    begin
      perform public.issue_enterprise_code(new.id, v_item.id);
    exception when others then
      -- A sold out batch must not block the rest of the order.
      perform public.write_audit(
        'enterprise_code_issue_failed', 'order', new.id::text,
        null, jsonb_build_object('order_item_id', v_item.id, 'error', sqlerrm)
      );
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists orders_issue_enterprise_codes on public.orders;
create trigger orders_issue_enterprise_codes
  after update of status on public.orders
  for each row execute function public.issue_enterprise_codes_for_order();

-- ---------------------------------------------------------------------------
-- The partner reports the codes their app used: close the buyer's gift too.
-- ---------------------------------------------------------------------------
create or replace function public.import_enterprise_redemptions(
  p_partner_id uuid,
  p_rows jsonb
)
returns table (confirmed integer, skipped integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_ref text;
  v_fingerprint text;
  v_confirmed integer := 0;
  v_skipped integer := 0;
  v_inventory uuid;
  v_voucher uuid;
begin
  if not public.can_manage_partner(p_partner_id) then
    raise exception 'not allowed';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_ref := nullif(trim(coalesce(v_row ->> 'inventory_ref', v_row ->> 'code', '')), '');
    if v_ref is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select id into v_inventory
    from public.enterprise_code_inventory
    where partner_id = p_partner_id
      and (
        inventory_ref = v_ref
        or code_fingerprint = public.enterprise_code_fingerprint(p_partner_id, v_ref)
      )
    limit 1;

    if v_inventory is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if (select status from public.enterprise_code_inventory where id = v_inventory)
       not in ('sold', 'delivered') then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    update public.enterprise_code_inventory
    set status = 'redeemed', updated_at = now()
    where id = v_inventory;

    insert into public.enterprise_code_events (inventory_id, partner_id, event_type, order_id, actor_user_id)
    values (v_inventory, p_partner_id, 'confirmed_redeemed',
      (select allocated_order_id from public.enterprise_code_inventory where id = v_inventory),
      auth.uid());

    -- The buyer's gift closes with it.
    select id into v_voucher
    from public.vouchers
    where order_item_id = (select allocated_order_item_id from public.enterprise_code_inventory where id = v_inventory)
      and fulfilment_type = 'enterprise_code'
    limit 1;

    if v_voucher is not null and (select status from public.vouchers where id = v_voucher) <> 'redeemed' then
      update public.vouchers
      set status = 'redeemed', remaining_value_minor = 0, redeemed_at = now(), updated_at = now()
      where id = v_voucher;

      perform public.write_audit(
        'enterprise_code_closed', 'voucher', v_voucher::text,
        jsonb_build_object('status', 'issued'),
        jsonb_build_object('status', 'redeemed', 'source', 'partner_report')
      );
    end if;

    v_confirmed := v_confirmed + 1;
  end loop;

  return query select v_confirmed, v_skipped;
end;
$$;

revoke all on function public.issue_enterprise_code(uuid, uuid) from public;
grant execute on function public.issue_enterprise_code(uuid, uuid) to authenticated, service_role;
revoke all on function public.reveal_enterprise_code(uuid) from public;
grant execute on function public.reveal_enterprise_code(uuid) to authenticated;
revoke all on function public.close_enterprise_code(uuid) from public;
grant execute on function public.close_enterprise_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A voucher is money, sessions, or a partner code. Never a mix of sessions
-- and value, and a partner code never carries sessions.
-- ---------------------------------------------------------------------------
alter table public.vouchers
  drop constraint if exists vouchers_fulfilment_shape;

alter table public.vouchers
  add constraint vouchers_fulfilment_shape check (
    (fulfilment_type = 'monetary' and total_sessions is null and remaining_sessions is null) or
    (fulfilment_type = 'experience' and total_sessions > 0
       and remaining_sessions between 0 and total_sessions
       and remaining_value_minor is null) or
    (fulfilment_type = 'enterprise_code' and total_sessions is null and remaining_sessions is null)
  );
