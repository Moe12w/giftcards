-- 0168_rebrand_app_review_account_and_function_flags.sql
-- 0167 rewrote the seeded rows and the three functions whose bodies named the
-- old brand. Three leftovers survived it because they were outside its scope:
--
--   * the app-store review account and the demo order around it use the old
--     @giftly.qa domain, not the @giftly.test seed addresses 0167 rewrote;
--   * two functions carry the brand in a transaction-local setting name,
--     giftly.bulk_fulfill, which 0167 never redefined;
--   * myfatoorah_fulfill_order mentions the old brand in a comment only.
--
-- Idempotent: every statement is scoped to the old value.

-- ---------------------------------------------------------------------------
-- App-store review account, its orders and the demo sender name
-- ---------------------------------------------------------------------------
-- The guard keeps a database that already has the new address from colliding
-- on the unique email instead of failing the whole migration.
update auth.users u
set email = replace(u.email, '@giftly.qa', '@tazella.com.qa')
where u.email like '%@giftly.qa'
  and not exists (
    select 1 from auth.users x
    where x.email = replace(u.email, '@giftly.qa', '@tazella.com.qa')
  );

update auth.identities i
set provider_id = replace(i.provider_id, '@giftly.qa', '@tazella.com.qa'),
    identity_data = jsonb_set(
      i.identity_data,
      '{email}',
      to_jsonb(replace(i.identity_data ->> 'email', '@giftly.qa', '@tazella.com.qa'))
    )
where i.provider_id like '%@giftly.qa'
  and i.identity_data ? 'email'
  and not exists (
    select 1 from auth.identities x
    where x.provider_id = replace(i.provider_id, '@giftly.qa', '@tazella.com.qa')
  );

update public.profiles
set email = replace(email, '@giftly.qa', '@tazella.com.qa')
where email like '%@giftly.qa';

update public.vouchers
set recipient_email = replace(recipient_email, '@giftly.qa', '@tazella.com.qa')
where recipient_email like '%@giftly.qa';

update public.order_items
set recipient_email = replace(recipient_email, '@giftly.qa', '@tazella.com.qa')
where recipient_email like '%@giftly.qa';

update public.orders
set sender_name = 'Tazella Demo'
where sender_name = 'Giftly Demo';

-- ---------------------------------------------------------------------------
-- Functions whose source still names the old brand
-- ---------------------------------------------------------------------------
-- Re-stated in full because a setting name and a comment cannot be replaced in
-- place. Each body below is the current definition in the migration history
-- (0120 for the payment handler, 0150 for the bulk pair), so nothing later is
-- reverted.


create or replace function public.myfatoorah_fulfill_order(
  p_provider_invoice_id text,
  p_hashes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  n integer := 0;
  i integer := 0;
  item record;
  h jsonb;
  v_card_id uuid;
  v_cards uuid[] := '{}';
begin
  perform set_config('mf.internal', '1', true);
  select * into o from public.orders where provider_invoice_id = p_provider_invoice_id for update;
  if not found then raise exception 'order_not_found'; end if;
  -- Idempotency is based on actual vouchers: confirming the payment marks the
  -- order paid, but that must not trick us into skipping issuance.
  select array_agg(id) into v_cards from public.vouchers where order_id = o.id;
  if coalesce(array_length(v_cards, 1), 0) > 0 then
    return jsonb_build_object('already_fulfilled', true, 'voucher_ids', to_jsonb(v_cards));
  end if;
  if o.payment_status <> 'paid' then raise exception 'payment_not_confirmed'; end if;

  select count(*) into n from public.order_items where order_id = o.id;
  if n = 0 then raise exception 'order_has_no_items'; end if;
  if jsonb_typeof(p_hashes) <> 'array' or jsonb_array_length(p_hashes) <> n then
    raise exception 'invalid_signature_array';
  end if;

  for item in
    select oi.*, pr.fulfilment_type as item_fulfilment_type,
           row_number() over (order by oi.created_at, oi.id) as rn
    from public.order_items oi
    join public.products pr on pr.id = oi.product_id
    where oi.order_id = o.id
  loop
    i := i + 1;
    h := p_hashes -> (i - 1);
    -- Partner codes are issued by the existing paid-order trigger
    -- (issue_enterprise_code). Do not create a Tazella voucher for them.
    if item.item_fulfilment_type = 'enterprise_code' then
      continue;
    end if;
    if h->>'claim_token_hash' is null or h->>'card_code_hash' is null then
      raise exception 'invalid_signature_array';
    end if;

    if item.item_fulfilment_type = 'experience' then
      select public.issue_session_card(
        item.product_id, o.id, o.buyer_id, item.total_minor,
        h->>'claim_token_hash', item.recipient_name, item.recipient_email, item.recipient_phone, o.scheduled_for
      ) into v_card_id;
    else
      select public.issue_gift_card(
        item.product_id, o.id, o.buyer_id, item.total_minor,
        h->>'claim_token_hash', item.recipient_name, item.recipient_email, item.recipient_phone, o.scheduled_for
      ) into v_card_id;
    end if;

    update public.vouchers
    set order_item_id = item.id,
        card_code_hash = h->>'card_code_hash',
        currency = coalesce(currency, o.currency)
    where id = v_card_id;

    v_cards := v_cards || v_card_id;
  end loop;

  return jsonb_build_object('already_fulfilled', false, 'voucher_ids', to_jsonb(v_cards));
end;
$$;

create or replace function public.notify_on_voucher_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_title text;
  v_body text;
begin
  -- Bulk fulfillment sets this flag and writes one batched notification.
  if current_setting('tazella.bulk_fulfill', true) = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_kind := 'received';
    v_title := 'notifications.received';
    v_body := 'notifications.receivedBody';
  elsif new.delivery_status = 'delivered'
        and old.delivery_status is distinct from 'delivered' then
    v_kind := 'delivered';
    v_title := 'notifications.delivered';
    v_body := 'notifications.deliveredBody';
  elsif new.status = 'claimed' and old.status is distinct from 'claimed' then
    v_kind := 'opened';
    v_title := 'notifications.opened';
    v_body := 'notifications.openedBody';
  elsif new.status = 'redeemed' and old.status is distinct from 'redeemed' then
    v_kind := 'redeemed';
    v_title := 'notifications.redeemed';
    v_body := 'notifications.redeemedBody';
  else
    return new;
  end if;

  if new.buyer_id is null then
    return new;
  end if;

  insert into public.notifications (user_id, kind, title_key, body_key, payload)
  values (
    new.buyer_id,
    v_kind,
    v_title,
    v_body,
    jsonb_build_object('gift_id', new.id, 'voucher_code', new.voucher_code)
  );

  return new;
end;
$$;

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
  perform set_config('tazella.bulk_fulfill', '1', true);
  select * into v_order from public.bulk_orders where id = p_bulk_order_id for update;
  if not found then
    raise exception 'bulk order not found';
  end if;

  -- Idempotent: a paid, fulfilled order never issues a second set of cards.
  if v_order.status = 'fulfilled' then
    perform set_config('tazella.bulk_fulfill', '', true);
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

    perform set_config('tazella.bulk_fulfill', '', true);
    insert into public.notifications (user_id, kind, title_key, body_key, payload)
    select v_order.buyer_user_id, 'received', 'notifications.received', 'notifications.receivedBody',
           jsonb_build_object('bulk_order_id', v_order.id, 'count', v_issued)
    where v_order.buyer_user_id is not null and v_issued > 0;

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

  perform set_config('tazella.bulk_fulfill', '', true);
    insert into public.notifications (user_id, kind, title_key, body_key, payload)
    select v_order.buyer_user_id, 'received', 'notifications.received', 'notifications.receivedBody',
           jsonb_build_object('bulk_order_id', v_order.id, 'count', v_issued)
    where v_order.buyer_user_id is not null and v_issued > 0;

  return v_order.id;
end;
$$;
