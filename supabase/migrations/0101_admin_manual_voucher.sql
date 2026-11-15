-- 0101_admin_manual_voucher.sql
-- Issuing a voucher without a payment.
--
-- Real vouchers only exist once a paid order arrives from MyFatoorah. That
-- makes the wallet, redemption, reports and statements impossible to exercise
-- before payments are connected. This function lets an admin issue one by hand.
--
-- It is deliberately not a shortcut around the money rules:
--   * the voucher is created by `issue_gift_card`, so it gets the same row
--     shape, the same ledger `issue` entry and the same balance derivation;
--   * a real order and order item are written, with the vendor's commission
--     and share calculated exactly as a paid order would, so reports and
--     statements read a normal sale;
--   * the order is marked `payment_provider = 'manual'` and its reference is
--     prefixed `MAN-`, so manual issues are identifiable in the audit log and
--     in the order list instead of being mistaken for real money.
--
-- The full claim token is returned to the caller once (only its SHA-256 hash is
-- stored), because the point of the tool is to test the claim flow.

create or replace function public.admin_issue_manual_voucher(
  p_product_id uuid,
  p_amount_minor bigint default null,
  p_recipient_name text default null,
  p_recipient_email text default null,
  p_gift_message text default null,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns table (
  voucher_id uuid,
  voucher_code text,
  claim_token text,
  order_id uuid,
  order_ref text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_vendor public.vendors%rowtype;
  v_amount bigint;
  v_variant_amount bigint;
  v_variant_expires timestamptz;
  v_commission bigint;
  v_share bigint;
  v_expires timestamptz;
  v_token text;
  v_hash text;
  v_code text;
  v_order_id uuid;
  v_order_ref text;
  v_item_id uuid;
  v_voucher_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'product not found';
  end if;

  -- Partner codes are allocated out of an enterprise inventory batch, so they
  -- cannot be invented here.
  if v_product.fulfilment_type not in ('monetary', 'experience') then
    raise exception 'only gift cards and experiences can be issued by hand';
  end if;

  select * into v_vendor from public.vendors where id = v_product.vendor_id;

  -- The cheapest live variant supplies the default value and expiry.
  select coalesce(pv.amount_minor, pv.price_minor), pv.valid_until
    into v_variant_amount, v_variant_expires
  from public.product_variants pv
  where pv.product_id = v_product.id
    and pv.active
  order by pv.price_minor
  limit 1;

  v_amount := coalesce(p_amount_minor, v_variant_amount);
  if v_amount is null or v_amount <= 0 then
    raise exception 'enter a value for this voucher';
  end if;

  -- Same split as a paid sale: the vendor's rate decides the commission.
  v_commission := round(v_amount * coalesce(v_vendor.commission_bps, 0) / 10000.0)::bigint;
  v_share := v_amount - v_commission;

  v_expires := coalesce(
    p_expires_at,
    v_variant_expires,
    now() + make_interval(days => coalesce(v_product.expiry_days, 365))
  );

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_code := 'MAN-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
  v_order_ref := 'MAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Inserted as paid: there is no provider event to wait for. The trigger that
  -- issues partner codes only listens for a status *change*, so nothing else
  -- fires here.
  insert into public.orders (
    buyer_id, status, payment_status, currency, subtotal_minor, discount_minor,
    fee_minor, total_minor, order_ref, payment_reference, payment_provider,
    sender_name, recipient_name, gift_message, paid_at
  )
  values (
    auth.uid(), 'paid', 'paid', coalesce(v_product.currency, 'QAR'),
    v_amount, 0, 0, v_amount, v_order_ref, 'manual-' || gen_random_uuid()::text,
    'manual', 'Giftly (issued by an admin)', p_recipient_name, p_gift_message, now()
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, vendor_id, quantity, unit_price_minor, total_minor,
    commission_minor, vendor_share_minor, currency, gift_message,
    recipient_name, recipient_email
  )
  values (
    v_order_id, v_product.id, v_product.vendor_id, 1, v_amount, v_amount,
    v_commission, v_share, coalesce(v_product.currency, 'QAR'), p_gift_message,
    p_recipient_name, p_recipient_email
  )
  returning id into v_item_id;

  v_voucher_id := public.issue_gift_card(
    v_product.id,
    v_order_id,
    auth.uid(),
    v_amount,
    v_hash,
    p_recipient_name,
    p_recipient_email,
    null,
    v_expires
  );

  update public.vouchers
  set voucher_code = v_code,
      card_code_hash = encode(extensions.digest(upper(v_code), 'sha256'), 'hex'),
      delivery_status = 'issued',
      gift_message = coalesce(p_gift_message, gift_message),
      order_item_id = v_item_id,
      updated_at = now()
  where id = v_voucher_id;

  perform public.record_admin_action(
    'voucher.manual_issue',
    'voucher',
    v_voucher_id,
    jsonb_build_object(
      'voucher_code', v_code,
      'order_id', v_order_id,
      'order_ref', v_order_ref,
      'product_id', v_product.id,
      'vendor_id', v_product.vendor_id,
      'amount_minor', v_amount,
      'commission_minor', v_commission,
      'vendor_share_minor', v_share,
      'expires_at', v_expires,
      'note', p_note
    )
  );

  return query select v_voucher_id, v_code, v_token, v_order_id, v_order_ref;
end;
$$;

revoke all on function public.admin_issue_manual_voucher(uuid, bigint, text, text, text, timestamptz, text) from public;
grant execute on function public.admin_issue_manual_voucher(uuid, bigint, text, text, text, timestamptz, text) to authenticated;
