-- 0122_bulk_multi_vendor_checkout.sql
--
-- Bulk buyers can check out several vendors' bulk offers in one MyFatoorah
-- invoice. Each offer still becomes its own bulk_order (so the existing
-- recipient/fulfilment flow is unchanged), but all of them share one standard
-- order header and one payment with one Suppliers[] entry per vendor.
--
-- Provider-managed commission: platform_fee_minor is recorded as 0 for these
-- orders; we never send ProposedShare / ProposedDepositShare.

alter table public.bulk_orders
  add column if not exists checkout_order_id uuid references public.orders(id) on delete set null;

create index if not exists bulk_orders_checkout_order_idx
  on public.bulk_orders (checkout_order_id)
  where checkout_order_id is not null;

-- The trusted checkout RPC sets `mf.internal` so it can create orders with a
-- payment reference in one atomic step. All ordinary buyer writes keep the
-- original tenant-isolation guard.
create or replace function public.bulk_orders_guard_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if current_setting('mf.internal', true) = '1'
     or auth.uid() is null
     or coalesce(public.is_admin(), false) then
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.buyer_user_id = auth.uid() then
      raise exception 'not allowed';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.buyer_user_id <> auth.uid() then
      raise exception 'not allowed';
    end if;
    if not exists (
      select 1 from public.business_accounts b
      where b.id = new.business_account_id and b.user_id = auth.uid()
    ) then
      raise exception 'not allowed';
    end if;
    if not exists (
      select 1 from public.bulk_offers o
      where o.id = new.offer_id
        and o.product_id is not distinct from new.product_id
        and o.vendor_id is not distinct from new.vendor_id
        and o.partner_id is not distinct from new.partner_id
    ) then
      raise exception 'offer mismatch';
    end if;
    if new.status <> 'pending'
       or new.payment_status <> 'unpaid'
       or new.paid_at is not null
       or new.fulfilled_at is not null
       or new.cancelled_at is not null
       or new.provider_invoice_id is not null
       or new.payment_reference is not null then
      raise exception 'not allowed';
    end if;
    return new;
  end if;

  if new.buyer_user_id <> auth.uid() then
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status <> 'cancelled'
       or old.payment_status = 'paid'
       or old.status in ('fulfilled', 'partially_fulfilled', 'refunded', 'cancelled') then
      raise exception 'not allowed';
    end if;
  end if;

  v_old := to_jsonb(old) - 'status' - 'cancelled_at' - 'sent_at' - 'notes' - 'gift_message' - 'updated_at';
  v_new := to_jsonb(new) - 'status' - 'cancelled_at' - 'sent_at' - 'notes' - 'gift_message' - 'updated_at';
  if v_old is distinct from v_new then
    raise exception 'not allowed';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkout creation (authenticated approved business buyer)
-- ---------------------------------------------------------------------------

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
    if v_offer.available_quantity is not null and v_qty > v_offer.available_quantity then
      raise exception 'insufficient_quantity';
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
      pricing_tier_snapshot
    )
    values (
      'BULK-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8)),
      v_account, v_uid, v_offer.vendor_id, v_offer.partner_id, v_offer.id, v_offer.product_id, v_qty,
      v_offer.face_value_minor, v_unit, v_offer.face_value_minor * v_qty,
      v_total, greatest(v_offer.face_value_minor * v_qty - v_total, 0), 0, v_total,
      v_offer.currency, 'pending', 'unpaid', v_reference, v_checkout_order,
      jsonb_build_object('unit_price_minor', v_unit, 'quantity', v_qty)
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

-- ---------------------------------------------------------------------------
-- Fulfil every bulk order attached to a confirmed payment. Idempotent.
-- ---------------------------------------------------------------------------

create or replace function public.bulk_fulfill_from_payment(p_checkout_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.myfatoorah_payments;
  b record;
  v_count integer := 0;
begin
  perform set_config('mf.internal', '1', true);
  select * into p from public.myfatoorah_payments where order_id = p_checkout_order_id;
  if not found then raise exception 'payment_not_found'; end if;

  for b in
    select id, status from public.bulk_orders
    where checkout_order_id = p_checkout_order_id
    for update
  loop
    if b.status <> 'fulfilled' then
      perform public.fulfill_bulk_order(b.id, null, null, p.invoice_id);
      v_count := v_count + 1;
    end if;
  end loop;

  return jsonb_build_object('fulfilled', v_count);
end;
$$;

revoke all on function public.bulk_checkout_create(jsonb, text) from public, anon;
grant execute on function public.bulk_checkout_create(jsonb, text) to authenticated;

revoke all on function public.bulk_fulfill_from_payment(uuid) from public, anon, authenticated;
grant execute on function public.bulk_fulfill_from_payment(uuid) to service_role;
