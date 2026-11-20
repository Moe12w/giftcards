-- 0138_serialise_exposure_and_stock.sql
--
-- C5: two concurrency holes on the way to a sale.
--
-- 1. Vendor exposure. create-payment read vendor_outstanding_minor(), compared
--    it to max_unredeemed_minor, and only then created the order. Outstanding is
--    derived from issued vouchers, so nothing a concurrent request did was
--    visible: N simultaneous checkouts all passed and N invoices were raised,
--    and after they were paid the vendor's unredeemed balance exceeded the cap
--    it agreed to. The check now lives in a BEFORE INSERT trigger on
--    order_items, takes a row lock on the vendor, and counts both live vouchers
--    and orders that are pending payment (last 24h, so abandoned invoices do
--    not lock a vendor out forever). Concurrent inserts serialise on the vendor
--    row and the loser sees the winner's committed order before deciding.
--
--    Bulk checkouts run with `mf.internal` set and are exempt: their exposure
--    model is available_quantity (below), and applying the retail unredeemed cap
--    to a 1,000-card bulk order would reject legitimate business.
--
-- 2. Bulk stock. bulk_checkout_create compared v_qty to available_quantity, but
--    the quantity was only decremented much later in fulfill_bulk_order, and
--    that decrement was a conditional UPDATE whose zero-row result was ignored.
--    Two buyers could both pass the check, both pay, and the vendor would be
--    oversold (the second fulfilment silently matched no rows yet issued cards
--    anyway). Checkout now reserves stock with an atomic conditional UPDATE
--    (`available_quantity >= v_qty`), records the reservation on the order
--    (`bulk_orders.stock_reserved`), fulfilment no longer decrements a
--    reservation, and cancelling or failing a reserved order returns the
--    quantity.

-- ---------------------------------------------------------------------------
-- 1. Vendor exposure guard
-- ---------------------------------------------------------------------------

create or replace function public.vendor_pending_exposure_minor(p_vendor_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  -- Orders awaiting payment still commit the vendor to issuing cards once the
  -- buyer pays, so they count against the cap. The 24h window matches the life
  -- of a hosted invoice; older abandoned orders stop holding capacity.
  select coalesce(sum(oi.total_minor), 0)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.vendor_id = p_vendor_id
    and o.status = 'pending'
    and o.payment_status = 'unpaid'
    and o.created_at > now() - interval '24 hours';
$$;

revoke all on function public.vendor_pending_exposure_minor(uuid) from public;
grant execute on function public.vendor_pending_exposure_minor(uuid) to service_role;

create or replace function public.order_items_exposure_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_used bigint;
begin
  if new.vendor_id is null then
    return new;
  end if;
  -- Bulk checkout owns its own capacity model; see the header note.
  if current_setting('mf.internal', true) = '1' then
    return new;
  end if;

  -- Serialise every exposure decision for this vendor. The lock is held until
  -- this transaction commits, so a concurrent checkout waits and then evaluates
  -- against a snapshot that includes this order.
  select coalesce(v.max_unredeemed_minor, 0)
    into v_limit
  from public.vendors v
  where v.id = new.vendor_id
  for update;

  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  v_used := public.vendor_outstanding_minor(new.vendor_id)
          + public.vendor_pending_exposure_minor(new.vendor_id);

  if v_used + coalesce(new.total_minor, 0) > v_limit then
    raise exception 'vendor_exposure_limit_reached'
      using detail = format('used=%s limit=%s requested=%s',
                            v_used, v_limit, coalesce(new.total_minor, 0));
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_exposure_guard on public.order_items;
create trigger order_items_exposure_guard
  before insert on public.order_items
  for each row execute function public.order_items_exposure_guard();

-- ---------------------------------------------------------------------------
-- 2. Bulk stock reservation
-- ---------------------------------------------------------------------------

alter table public.bulk_orders
  add column if not exists stock_reserved boolean not null default false;

create or replace function public.bulk_checkout_create(
  p_items jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_account uuid;
  v_line jsonb;
  v_offer public.bulk_offers;
  v_product public.products;
  v_vendor public.vendors;
  v_partner public.enterprise_partners;
  v_supplier text;
  v_tier record;
  v_qty integer;
  v_unit bigint;
  v_total bigint;
  v_reference text;
  v_checkout_order uuid;
  v_bulk_id uuid;
  v_bulk_ids uuid[] := '{}';
  v_lines jsonb[] := '{}';
  v_suppliers jsonb;
  v_total_minor bigint := 0;
  v_reserved boolean;
  i integer;
begin
  perform set_config('mf.internal', '1', true);
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_approved_business_buyer(v_uid) then raise exception 'buyer_not_approved'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;

  select id into v_account from public.business_accounts where user_id = v_uid;
  if v_account is null then raise exception 'business_account_not_found'; end if;

  v_reference := case
    when nullif(btrim(coalesce(p_idempotency_key, '')), '') is not null
      then 'bulk:' || encode(extensions.digest(v_uid::text || ':' || btrim(p_idempotency_key), 'sha256'), 'hex')
    else 'bulk:' || gen_random_uuid()::text
  end;

  -- Reuse an existing checkout attempt when the client retries.
  if exists (select 1 from public.orders where payment_reference = v_reference) then
    select id, coalesce(total_minor, 0) into v_checkout_order, v_total_minor
    from public.orders where payment_reference = v_reference;
    return jsonb_build_object(
      'checkoutOrderId', v_checkout_order,
      'paymentReference', v_reference,
      'totalMinor', v_total_minor,
      'existing', true
    );
  end if;

  insert into public.orders (
    buyer_id, order_ref, currency, subtotal_minor, fee_minor, total_minor,
    status, payment_status, payment_provider, payment_reference, sender_name
  )
  values (
    v_uid,
    'BULK-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    'QAR', 0, 0, 0, 'pending', 'unpaid', 'myfatoorah', v_reference,
    (select company_name from public.business_accounts where id = v_account)
  )
  returning id into v_checkout_order;

  for i in 0..jsonb_array_length(p_items) - 1 loop
    v_line := p_items -> i;
    v_qty := (v_line ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid_quantity'; end if;

    select * into v_offer
    from public.bulk_offers
    where id = (v_line ->> 'offerId')::uuid
      and status = 'active'
      and enabled = true;
    if not found then raise exception 'offer_unavailable'; end if;
    if v_qty < v_offer.min_quantity
       or (v_offer.max_quantity is not null and v_qty > v_offer.max_quantity) then
      raise exception 'invalid_quantity';
    end if;

    -- Reserve the quantity now. This single conditional UPDATE is the
    -- serialisation point: the row lock it takes makes the second of two
    -- concurrent checkouts re-evaluate against the first one's new value, and
    -- `not found` means there was not enough stock left.
    v_reserved := false;
    if v_offer.available_quantity is not null then
      update public.bulk_offers
      set available_quantity = available_quantity - v_qty,
          updated_at = now()
      where id = v_offer.id
        and available_quantity >= v_qty;
      if not found then raise exception 'insufficient_quantity'; end if;
      v_reserved := true;
    end if;

    select * into v_product from public.products where id = v_offer.product_id;
    v_supplier := null;
    if v_offer.vendor_id is not null then
      select * into v_vendor from public.vendors where id = v_offer.vendor_id;
      if v_vendor.status <> 'approved' then raise exception 'supplier_not_ready'; end if;
      v_supplier := v_vendor.myfatoorah_supplier_code;
      if lower(coalesce(v_vendor.myfatoorah_supplier_status, '')) <> 'active'
         or not v_vendor.payment_eligibility then
        raise exception 'supplier_not_ready';
      end if;
    elsif v_offer.partner_id is not null then
      select * into v_partner from public.enterprise_partners where id = v_offer.partner_id;
      if v_partner.status <> 'active' then raise exception 'supplier_not_ready'; end if;
      v_supplier := v_partner.myfatoorah_supplier_code;
      if lower(coalesce(v_partner.myfatoorah_supplier_status, '')) <> 'active'
         or not v_partner.payment_eligibility then
        raise exception 'supplier_not_ready';
      end if;
    else
      raise exception 'supplier_not_ready';
    end if;
    if v_supplier is null then raise exception 'supplier_not_ready'; end if;

    -- Same tier rule as web/lib/bulk.ts: the last matching tier wins.
    v_unit := v_offer.base_unit_price_minor;
    for v_tier in
      select * from public.bulk_offer_price_tiers
      where offer_id = v_offer.id
      order by sort_order, min_quantity
    loop
      if v_qty >= v_tier.min_quantity
         and (v_tier.max_quantity is null or v_qty <= v_tier.max_quantity) then
        v_unit := v_tier.unit_price_minor;
      end if;
    end loop;

    v_total := v_unit * v_qty;
    if v_total <= 0 then raise exception 'invalid_offer_price'; end if;
    if v_offer.min_order_value_minor is not null and v_total < v_offer.min_order_value_minor then
      raise exception 'order_below_minimum';
    end if;
    if v_offer.max_order_value_minor is not null and v_total > v_offer.max_order_value_minor then
      raise exception 'order_above_maximum';
    end if;

    insert into public.bulk_orders (
      order_ref, business_account_id, buyer_user_id, vendor_id, partner_id, offer_id, product_id,
      quantity, face_value_minor, unit_price_minor, total_face_value_minor,
      total_paid_minor, discount_minor, platform_fee_minor, vendor_payable_minor,
      currency, status, payment_status, payment_reference, checkout_order_id,
      pricing_tier_snapshot, stock_reserved
    )
    values (
      'BULK-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8)),
      v_account, v_uid, v_offer.vendor_id, v_offer.partner_id, v_offer.id, v_offer.product_id, v_qty,
      v_offer.face_value_minor, v_unit, v_offer.face_value_minor * v_qty,
      v_total, greatest(v_offer.face_value_minor * v_qty - v_total, 0), 0, v_total,
      v_offer.currency, 'pending', 'unpaid', v_reference, v_checkout_order,
      jsonb_build_object('unit_price_minor', v_unit, 'quantity', v_qty), v_reserved
    )
    returning id into v_bulk_id;

    insert into public.bulk_order_vouchers (bulk_order_id)
    select v_bulk_id from generate_series(1, v_qty);

    insert into public.order_items (
      order_id, product_id, enterprise_product_id, vendor_id, quantity, unit_price_minor,
      total_minor, commission_minor, vendor_share_minor, currency
    )
    values (
      v_checkout_order, v_offer.product_id, v_product.enterprise_product_id, v_offer.vendor_id, v_qty,
      v_unit, v_total, 0, v_total, v_offer.currency
    );

    v_bulk_ids := v_bulk_ids || v_bulk_id;
    v_lines := v_lines || jsonb_build_object(
      'supplierCode', v_supplier,
      'amountMinor', v_total
    );
    v_total_minor := v_total_minor + v_total;
  end loop;

  update public.orders
  set subtotal_minor = v_total_minor, total_minor = v_total_minor
  where id = v_checkout_order;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'SupplierCode', supplier_code,
      'InvoiceShareMinor', amount_minor
    )),
    '[]'::jsonb
  )
  into v_suppliers
  from (
    select x ->> 'supplierCode' as supplier_code,
           sum((x ->> 'amountMinor')::bigint) as amount_minor
    from unnest(v_lines) as x
    group by 1
  ) s;

  return jsonb_build_object(
    'checkoutOrderId', v_checkout_order,
    'paymentReference', v_reference,
    'bulkOrderIds', to_jsonb(v_bulk_ids),
    'totalMinor', v_total_minor,
    'suppliers', v_suppliers
  );
end;
$$;

-- Cancelling a reserved checkout returns the quantity. The existing write
-- guard still permits a buyer to cancel an unpaid order, and the flag flip is
-- applied before the statement ends, so the row does not stay reserved.
create or replace function public.bulk_orders_release_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.stock_reserved, false)
     and new.status = 'cancelled'
     and old.status is distinct from new.status then
    update public.bulk_offers
    set available_quantity = coalesce(available_quantity, 0) + old.quantity,
        updated_at = now()
    where id = old.offer_id
      and available_quantity is not null;
    new.stock_reserved := false;
  end if;
  return new;
end;
$$;

drop trigger if exists bulk_orders_z_release_stock on public.bulk_orders;
create trigger bulk_orders_z_release_stock
  before update on public.bulk_orders
  for each row execute function public.bulk_orders_release_stock();

-- ---------------------------------------------------------------------------
-- 3. fulfil_bulk_order: do not decrement stock that checkout already reserved
-- ---------------------------------------------------------------------------

create or replace function public.fulfill_bulk_order(
  p_bulk_order_id uuid,
  p_claim_tokens text[] default null,
  p_card_codes text[] default null,
  p_provider_invoice_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.bulk_orders%rowtype;
  v_offer public.bulk_offers%rowtype;
  v_product public.products%rowtype;
  v_alloc record;
  v_card_id uuid;
  v_expires timestamptz;
  v_token text;
  v_code text;
  v_hash text;
  v_i integer := 0;
  v_issued integer := 0;
  v_std_order uuid;
  v_std_item uuid;
  v_item_ids uuid[] := '{}'::uuid[];
  v_partner_code text;
begin
  select * into v_order from public.bulk_orders where id = p_bulk_order_id for update;
  if not found then
    raise exception 'bulk order not found';
  end if;

  -- Idempotent: a paid, fulfilled order never issues a second set of cards.
  if v_order.status = 'fulfilled' then
    return v_order.id;
  end if;

  select * into v_offer from public.bulk_offers where id = v_order.offer_id;
  select * into v_product from public.products where id = v_order.product_id;

  v_expires := v_product.valid_until;
  if v_expires is null and v_product.expiry_days is not null then
    v_expires := now() + make_interval(days => v_product.expiry_days);
  end if;

  -- Partner codes are issued by the existing paid-order trigger, so they get
  -- their own standard order with one item per card.
  if v_product.fulfilment_type = 'enterprise_code' then
    insert into public.orders (
      buyer_id, status, payment_status, currency, subtotal_minor, discount_minor,
      fee_minor, total_minor, order_ref, payment_reference, sender_name,
      recipient_name, gift_message
    )
    values (
      v_order.buyer_user_id, 'pending', 'pending', v_order.currency,
      v_order.total_paid_minor, v_order.discount_minor, v_order.platform_fee_minor,
      v_order.total_paid_minor, v_order.order_ref, 'bulk-' || v_order.id::text,
      (select company_name from public.business_accounts where id = v_order.business_account_id),
      (select company_name from public.business_accounts where id = v_order.business_account_id),
      v_order.gift_message
    )
    returning id into v_std_order;

    v_item_ids := '{}'::uuid[];

    for v_i in 1..v_order.quantity loop
      insert into public.order_items (
        order_id, product_id, enterprise_product_id, vendor_id, quantity,
        unit_price_minor, total_minor, commission_minor, vendor_share_minor,
        currency, gift_message
      )
      values (
        v_std_order, v_order.product_id, v_product.enterprise_product_id, null, 1,
        v_order.unit_price_minor, v_order.face_value_minor, v_order.platform_fee_minor,
        v_order.vendor_payable_minor, v_order.currency, v_order.gift_message
      )
      returning id into v_std_item;

      v_item_ids := v_item_ids || v_std_item;
    end loop;

    -- The trigger issues one partner code per item.
    update public.orders
    set status = 'paid', payment_status = 'paid', paid_at = now(), updated_at = now()
    where id = v_std_order;

    for v_i in 1..coalesce(array_length(v_item_ids, 1), 0) loop
      select v.id, v.voucher_code
        into v_card_id, v_code
      from public.vouchers v
      where v.order_item_id = v_item_ids[v_i]
      limit 1;

      if v_card_id is null then
        continue;
      end if;

      select public.decrypt_enterprise_code(ci.code_ciphertext)
        into v_partner_code
      from public.enterprise_code_inventory ci
      where ci.allocated_order_item_id = v_item_ids[v_i]
      limit 1;

      update public.bulk_order_vouchers
      set voucher_id = v_card_id,
          voucher_code = v_code,
          delivered_code = v_partner_code,
          delivery_status = 'issued',
          assignment_index = v_i - 1
      where id = (
        select id from public.bulk_order_vouchers
        where bulk_order_id = p_bulk_order_id and voucher_id is null
        order by coalesce(assignment_index, 999999), created_at
        limit 1
      );

      v_issued := v_issued + 1;
    end loop;

    update public.bulk_orders
    set status = case when v_issued >= v_order.quantity
                      then 'fulfilled'::public.bulk_order_status
                      else 'partially_fulfilled'::public.bulk_order_status end,
        payment_status = 'paid',
        paid_at = coalesce(paid_at, now()),
        fulfilled_at = now(),
        provider_invoice_id = coalesce(provider_invoice_id, p_provider_invoice_id),
        updated_at = now()
    where id = v_order.id;

    return v_order.id;
  end if;

  -- Gift cards (monetary and experience) are issued one by one.
  for v_alloc in
    select *
    from public.bulk_order_vouchers
    where bulk_order_id = p_bulk_order_id and voucher_id is null
    order by coalesce(assignment_index, 999999), created_at
  loop
    v_i := v_i + 1;

    v_token := coalesce(p_claim_tokens[v_i], encode(extensions.gen_random_bytes(32), 'hex'));
    v_code := coalesce(p_card_codes[v_i], 'GFT-' || upper(substr(encode(extensions.gen_random_bytes(9), 'hex'), 1, 10)));
    v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

    v_card_id := public.issue_gift_card(
      v_order.product_id,
      null,
      v_order.buyer_user_id,
      v_order.face_value_minor,
      v_hash,
      v_alloc.recipient_name,
      v_alloc.recipient_email,
      null,
      v_expires
    );

    update public.vouchers
    set voucher_code = v_code,
        card_code_hash = encode(extensions.digest(upper(v_code), 'sha256'), 'hex'),
        delivery_status = 'issued',
        gift_message = coalesce(gift_message, v_alloc.gift_message),
        updated_at = now()
    where id = v_card_id;

    update public.bulk_order_vouchers
    set voucher_id = v_card_id,
        voucher_code = v_code,
        claim_token = v_token,
        claim_token_hash = v_hash,
        delivery_status = 'issued',
        assignment_index = coalesce(assignment_index, v_i - 1),
        gift_message = coalesce(gift_message, v_order.gift_message)
    where id = v_alloc.id;

    v_issued := v_issued + 1;
  end loop;

  -- Stock is normally reserved at checkout (stock_reserved = true). Only
  -- orders created before 0138 fall back to decrementing here, and those now
  -- raise instead of quietly issuing cards when the count does not match.
  if v_offer.available_quantity is not null and v_issued > 0
     and not coalesce(v_order.stock_reserved, false) then
    update public.bulk_offers
    set available_quantity = available_quantity - v_issued,
        updated_at = now()
    where id = v_offer.id and available_quantity >= v_issued;
    if not found then
      raise exception 'insufficient_quantity'
        using detail = format('offer=%s requested=%s available=%s',
                              v_offer.id, v_issued, v_offer.available_quantity);
    end if;
  end if;

  update public.bulk_orders
  set status = case when v_issued >= v_order.quantity
                    then 'fulfilled'::public.bulk_order_status
                    else 'partially_fulfilled'::public.bulk_order_status end,
      payment_status = 'paid',
      paid_at = coalesce(paid_at, now()),
      fulfilled_at = now(),
      provider_invoice_id = coalesce(provider_invoice_id, p_provider_invoice_id),
      updated_at = now()
  where id = v_order.id;

  return v_order.id;
end;
$$;
