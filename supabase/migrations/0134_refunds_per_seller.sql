-- 0134_refunds_per_seller.sql
--
-- Two defects in myfatoorah_payment_refunded (0120:455-505):
--
--  1. The partner branch was unreachable: `elsif p.vendor_id is null` sat inside
--     `if p_status = 'completed' and p.vendor_id is not null`, so partner orders
--     never had their ledger reversed.
--  2. Any completed refund marked the whole order refunded, voided every
--     voucher, and debited the refunded amount from a single vendor. A QAR 20
--     partial refund on a QAR 300 three-vendor order therefore destroyed the
--     order and charged one seller.
--
-- This replacement:
--  - reverses exactly the refunded amount, split across the sellers of the
--    order in proportion to their own sale lines (largest first, remainder to
--    the last, so the parts always add up to the refund);
--  - handles vendor and partner lines in one allocation, so partner refunds run;
--  - keeps the order paid and the vouchers alive on a partial refund, and only
--    marks the order refunded / voids vouchers once completed refunds cover the
--    full payment;
--  - applies the ledger reversal once per refund reference, so a replayed
--    webhook cannot debit twice;
--  - refuses a refund that would exceed the payment.

create or replace function public.myfatoorah_payment_refunded(
  p_order_id uuid,
  p_amount_minor bigint,
  p_refund_reference text,
  p_status text default 'completed',
  p_provider_response jsonb default null
)
returns public.myfatoorah_refunds
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.myfatoorah_payments;
  r public.myfatoorah_refunds;
  line record;
  v_previous_status text;
  v_total_sale bigint := 0;
  v_remaining bigint;
  v_share bigint;
  v_refunded bigint := 0;
  v_seller_count integer := 0;
  v_vendor_count integer := 0;
  v_single_vendor uuid;
  v_reference text;
begin
  perform set_config('mf.internal', '1', true);

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_refund_amount';
  end if;

  select * into p from public.myfatoorah_payments where order_id = p_order_id for update;
  if not found then raise exception 'payment_not_found'; end if;

  if p_refund_reference is not null then
    select status into v_previous_status
    from public.myfatoorah_refunds
    where provider_refund_id = p_refund_reference
    limit 1;
  end if;

  -- One vendor means the refund row can point at it; a mixed order cannot.
  select count(distinct oi.vendor_id), min(oi.vendor_id)
    into v_vendor_count, v_single_vendor
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.vendor_id is not null;

  insert into public.myfatoorah_refunds
    (payment_id, order_id, vendor_id, refund_reference, provider_refund_id,
     amount_minor, status, provider_response, completed_at)
  values
    (p.id, p_order_id,
     case when v_vendor_count = 1 then v_single_vendor else null end,
     p_refund_reference, p_refund_reference,
     p_amount_minor, p_status, coalesce(p_provider_response, '{}'::jsonb),
     case when p_status = 'completed' then now() else null end)
  on conflict (provider_refund_id) where provider_refund_id is not null do update
  set status = excluded.status,
      provider_response = excluded.provider_response,
      completed_at = case when excluded.status = 'completed'
                          then coalesce(completed_at, now())
                          else completed_at end
  returning * into r;

  -- Only a transition into 'completed' moves money.
  if p_status = 'completed' and coalesce(v_previous_status, '') <> 'completed' then
    select coalesce(sum(amount_minor), 0) into v_refunded
    from public.myfatoorah_refunds
    where payment_id = p.id and status = 'completed';

    if v_refunded > p.amount_minor then
      raise exception 'refund_exceeds_payment: % of %', v_refunded, p.amount_minor;
    end if;

    select coalesce(sum(oi.total_minor), 0) into v_total_sale
    from public.order_items oi
    where oi.order_id = p_order_id;

    if v_total_sale <= 0 then
      raise exception 'order_has_no_value';
    end if;

    v_reference := coalesce(p_refund_reference, r.provider_refund_id, p.payment_id, p.invoice_id);
    v_remaining := p_amount_minor;

    for line in
      with sellers as (
        select oi.vendor_id as owner_id, 'vendor'::text as kind,
               sum(oi.total_minor) as sale_minor
        from public.order_items oi
        where oi.order_id = p_order_id
          and oi.vendor_id is not null
        group by oi.vendor_id

        union all

        select pr.partner_id as owner_id, 'partner'::text as kind,
               sum(oi.total_minor) as sale_minor
        from public.order_items oi
        join public.products pr on pr.id = oi.product_id
        where oi.order_id = p_order_id
          and oi.vendor_id is null
          and pr.partner_id is not null
        group by pr.partner_id
      )
      select
        owner_id,
        kind,
        sale_minor,
        row_number() over (order by sale_minor desc, owner_id) as rn,
        count(*) over () as cnt
      from sellers
    loop
      v_seller_count := line.cnt;

      if line.rn = line.cnt then
        v_share := v_remaining;
      else
        v_share := (p_amount_minor * line.sale_minor) / v_total_sale;
      end if;
      v_share := least(v_share, v_remaining);

      if v_share > 0 then
        if line.kind = 'partner' then
          perform public.myfatoorah_partner_financial_entry(
            line.owner_id, p_order_id, 'refund', -v_share,
            v_reference,
            jsonb_build_object(
              'provider', 'myfatoorah',
              'invoice_id', p.invoice_id,
              'supplier_scope', 'partner',
              'refund_amount_minor', p_amount_minor
            )
          );
        else
          perform public.myfatoorah_financial_entry(
            line.owner_id, p_order_id, 'refund', -v_share,
            v_reference,
            jsonb_build_object(
              'provider', 'myfatoorah',
              'invoice_id', p.invoice_id,
              'supplier_scope', 'vendor',
              'refund_amount_minor', p_amount_minor
            )
          );
        end if;

        v_remaining := v_remaining - v_share;
      end if;
    end loop;

    if v_seller_count = 0 then
      raise exception 'order_has_no_seller';
    end if;

    -- Only a payment that is fully refunded loses its order and its cards.
    select coalesce(sum(amount_minor), 0) into v_refunded
    from public.myfatoorah_refunds
    where payment_id = p.id and status = 'completed';

    if v_refunded >= p.amount_minor then
      update public.orders
      set status = 'refunded', payment_status = 'refunded'
      where id = p_order_id;

      update public.myfatoorah_payments
      set payment_status = 'refunded', updated_at = now()
      where id = p.id;

      update public.vouchers
      set status = 'void', updated_at = now()
      where order_id = p_order_id
        and status in ('issued', 'claimed', 'active', 'partially_redeemed');
    end if;
  end if;

  return r;
end;
$$;

revoke all on function public.myfatoorah_payment_refunded(uuid, bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.myfatoorah_payment_refunded(uuid, bigint, text, text, jsonb)
  to service_role;
