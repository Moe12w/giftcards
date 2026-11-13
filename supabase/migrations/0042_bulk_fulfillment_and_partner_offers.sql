-- 0042_bulk_fulfillment_and_partner_offers.sql
-- Turns bulk buying from a catalogue into a working flow.
--
--  - Enterprise partners can publish their own bulk offers (like vendors).
--  - A paid bulk order issues one real gift card per unit, reusing the
--    existing issuance functions (issue_gift_card / issue_enterprise_code).
--  - Recipients are assigned to cards before fulfilment, then each card gets
--    a claim link that is queued in an email outbox for automatic sending.
--
-- The claim token is stored hashed on the voucher (as everywhere else); the
-- plain token lives on the allocation row until the link has been sent.

-- ---------------------------------------------------------------------------
-- 1. Partner-owned bulk offers
-- ---------------------------------------------------------------------------

alter table public.bulk_offers alter column vendor_id drop not null;
alter table public.bulk_offers
  add column if not exists partner_id uuid references public.enterprise_partners(id) on delete cascade;

alter table public.bulk_orders alter column vendor_id drop not null;
alter table public.bulk_orders
  add column if not exists partner_id uuid references public.enterprise_partners(id) on delete restrict;

alter table public.bulk_offers drop constraint if exists bulk_offers_single_owner;
alter table public.bulk_offers
  add constraint bulk_offers_single_owner
  check ((vendor_id is not null and partner_id is null) or (vendor_id is null and partner_id is not null));

alter table public.bulk_orders drop constraint if exists bulk_orders_single_owner;
alter table public.bulk_orders
  add constraint bulk_orders_single_owner
  check ((vendor_id is not null and partner_id is null) or (vendor_id is null and partner_id is not null));

create index if not exists bulk_offers_partner_idx on public.bulk_offers (partner_id);
create index if not exists bulk_orders_partner_idx on public.bulk_orders (partner_id);

-- ---------------------------------------------------------------------------
-- 2. Fulfilment columns
-- ---------------------------------------------------------------------------

alter table public.bulk_orders
  add column if not exists provider_invoice_id text,
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refund_total_minor bigint not null default 0,
  add column if not exists notes text,
  add column if not exists gift_message text;

create unique index if not exists bulk_orders_provider_invoice_idx
  on public.bulk_orders (provider_invoice_id)
  where provider_invoice_id is not null;

alter table public.bulk_order_vouchers
  add column if not exists claim_token text,
  add column if not exists claim_token_hash text,
  add column if not exists delivery_method text not null default 'email',
  add column if not exists sent_at timestamptz,
  add column if not exists send_error text,
  add column if not exists assignment_index integer,
  add column if not exists gift_message text,
  add column if not exists delivered_code text;

create index if not exists bulk_order_vouchers_order_idx2 on public.bulk_order_vouchers (bulk_order_id, assignment_index);

-- ---------------------------------------------------------------------------
-- 3. Email outbox
-- ---------------------------------------------------------------------------

create table if not exists public.bulk_email_outbox (
  id uuid primary key default gen_random_uuid(),
  bulk_order_id uuid not null references public.bulk_orders(id) on delete cascade,
  bulk_order_voucher_id uuid references public.bulk_order_vouchers(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  subject text,
  body text,
  claim_url text,
  status text not null default 'queued',
  provider text,
  provider_message_id text,
  error text,
  attempts integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bulk_email_outbox_order_idx on public.bulk_email_outbox (bulk_order_id, created_at);

alter table public.bulk_email_outbox enable row level security;

drop policy if exists bulk_email_outbox_select on public.bulk_email_outbox;
create policy bulk_email_outbox_select on public.bulk_email_outbox
  for select using (
    exists (
      select 1
      from public.bulk_orders bo
      where bo.id = bulk_order_id
        and (
          coalesce(public.is_admin(), false)
          or bo.buyer_user_id = auth.uid()
          or (bo.vendor_id is not null and coalesce(public.can_manage_vendor(bo.vendor_id), false))
          or (bo.partner_id is not null and coalesce(public.can_manage_partner(bo.partner_id), false))
        )
    )
  );

grant select on public.bulk_email_outbox to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS for partner-owned offers and orders
-- ---------------------------------------------------------------------------

drop policy if exists bulk_offers_select on public.bulk_offers;
create policy bulk_offers_select on public.bulk_offers
  for select using (
    coalesce(public.is_admin(), false)
    or (vendor_id is not null and coalesce(public.can_manage_vendor(vendor_id), false))
    or (partner_id is not null and coalesce(public.can_manage_partner(partner_id), false))
    or (coalesce(public.can_access_bulk_buying(), false) and enabled = true and status = 'active')
  );

drop policy if exists bulk_offers_vendor_write on public.bulk_offers;
create policy bulk_offers_vendor_write on public.bulk_offers
  for all using (
    coalesce(public.is_admin(), false)
    or (vendor_id is not null and coalesce(public.can_manage_vendor(vendor_id), false))
    or (partner_id is not null and coalesce(public.can_manage_partner(partner_id), false))
  )
  with check (
    coalesce(public.is_admin(), false)
    or (vendor_id is not null and coalesce(public.can_manage_vendor(vendor_id), false))
    or (partner_id is not null and coalesce(public.can_manage_partner(partner_id), false))
  );

drop policy if exists bulk_orders_select on public.bulk_orders;
create policy bulk_orders_select on public.bulk_orders
  for select using (
    coalesce(public.is_admin(), false)
    or buyer_user_id = auth.uid()
    or (vendor_id is not null and coalesce(public.can_manage_vendor(vendor_id), false))
    or (partner_id is not null and coalesce(public.can_manage_partner(partner_id), false))
  );

drop policy if exists bulk_orders_update on public.bulk_orders;
create policy bulk_orders_update on public.bulk_orders
  for update using (
    coalesce(public.is_admin(), false)
    or buyer_user_id = auth.uid()
    or (vendor_id is not null and coalesce(public.can_manage_vendor(vendor_id), false))
    or (partner_id is not null and coalesce(public.can_manage_partner(partner_id), false))
  )
  with check (
    coalesce(public.is_admin(), false)
    or buyer_user_id = auth.uid()
    or (vendor_id is not null and coalesce(public.can_manage_vendor(vendor_id), false))
    or (partner_id is not null and coalesce(public.can_manage_partner(partner_id), false))
  );

-- ---------------------------------------------------------------------------
-- 5. Recipient assignment
-- ---------------------------------------------------------------------------

create or replace function public.assign_bulk_recipients(
  p_bulk_order_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.bulk_orders%rowtype;
  v_alloc record;
  v_row jsonb;
  v_count integer := 0;
begin
  select * into v_order from public.bulk_orders where id = p_bulk_order_id;
  if not found then
    raise exception 'bulk order not found';
  end if;

  if v_order.buyer_user_id <> auth.uid() and not coalesce(public.is_admin(), false) then
    raise exception 'not allowed';
  end if;

  if v_order.status in ('fulfilled', 'partially_fulfilled', 'cancelled', 'refunded') then
    raise exception 'this order can no longer be changed';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid recipient list';
  end if;

  for v_alloc in
    select *
    from public.bulk_order_vouchers
    where bulk_order_id = p_bulk_order_id
    order by coalesce(assignment_index, 999999), created_at
  loop
    v_row := p_rows -> v_count;
    exit when v_row is null;

    update public.bulk_order_vouchers
    set recipient_name = nullif(btrim(coalesce(v_row->>'name', '')), ''),
        recipient_email = nullif(btrim(coalesce(v_row->>'email', '')), ''),
        gift_message = nullif(btrim(coalesce(v_row->>'message', '')), ''),
        assignment_index = v_count
    where id = v_alloc.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.assign_bulk_recipients(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Fulfilment
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

  if v_offer.available_quantity is not null and v_issued > 0 then
    update public.bulk_offers
    set available_quantity = available_quantity - v_issued,
        updated_at = now()
    where id = v_offer.id and available_quantity >= v_issued;
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

grant execute on function public.fulfill_bulk_order(uuid, text[], text[], text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Admin controls for bulk orders
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_bulk_order_status(
  p_bulk_order_id uuid,
  p_status public.bulk_order_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not allowed';
  end if;

  update public.bulk_orders
  set status = p_status,
      payment_status = case when p_status = 'refunded' then 'refunded' else payment_status end,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      notes = coalesce(p_note, notes),
      updated_at = now()
  where id = p_bulk_order_id;
end;
$$;

grant execute on function public.admin_set_bulk_order_status(uuid, public.bulk_order_status, text) to authenticated;
