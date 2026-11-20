-- 0144_fix_payment_confirmed_numeric.sql
--
-- Why: 0133 sums each seller's lines with sum(oi.total_minor), which Postgres
-- types as numeric. myfatoorah_financial_entry takes bigint, and Postgres does
-- not implicitly cast numeric to bigint when resolving a function call, so every
-- confirmation of an order with items failed with
--   function public.myfatoorah_financial_entry(uuid, uuid, unknown, numeric, text, jsonb) does not exist
-- before a single seller was credited. The allocation check never ran either, so
-- the order stayed unpaid and the failure surfaced only as a webhook 500.
--
-- Nothing else about the function changes: same per-seller split, same mismatch
-- guard, same supplier-share update. Only the aggregate type is corrected.

create or replace function public.myfatoorah_payment_confirmed(
  p_order_id uuid,
  p_payment_id text,
  p_provider_response jsonb default null,
  p_suppliers jsonb default null
)
returns public.myfatoorah_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.myfatoorah_payments;
  line record;
  supplier_raw jsonb;
  already_paid boolean;
  v_reference text;
  v_order_total bigint := 0;
  v_credited bigint := 0;
begin
  perform set_config('mf.internal', '1', true);

  select * into p from public.myfatoorah_payments where order_id = p_order_id for update;
  if not found then raise exception 'payment_not_found'; end if;

  already_paid := p.payment_status = 'paid';
  update public.myfatoorah_payments
  set payment_status = 'paid',
      payment_id = coalesce(nullif(p_payment_id, ''), payment_id),
      paid_at = now(),
      provider_response = coalesce(p_provider_response, provider_response),
      updated_at = now()
  where id = p.id
  returning * into p;

  if not already_paid then
    update public.orders
    set status = 'paid', payment_status = 'paid', paid_at = now()
    where id = p_order_id;

    v_reference := coalesce(p.payment_id, p.invoice_id);

    -- One credit per vendor, for that vendor's own lines.
    for line in
      select oi.vendor_id as owner_id, sum(oi.total_minor)::bigint as amount_minor
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.vendor_id is not null
      group by oi.vendor_id
    loop
      perform public.myfatoorah_financial_entry(
        line.owner_id, p_order_id, 'sale', line.amount_minor,
        v_reference,
        jsonb_build_object(
          'provider', 'myfatoorah',
          'invoice_id', p.invoice_id,
          'supplier_scope', 'vendor'
        )
      );
      v_credited := v_credited + line.amount_minor;
    end loop;

    -- One credit per enterprise partner, for partner-owned lines.
    for line in
      select pr.partner_id as owner_id, sum(oi.total_minor)::bigint as amount_minor
      from public.order_items oi
      join public.products pr on pr.id = oi.product_id
      where oi.order_id = p_order_id
        and oi.vendor_id is null
        and pr.partner_id is not null
      group by pr.partner_id
    loop
      perform public.myfatoorah_partner_financial_entry(
        line.owner_id, p_order_id, 'sale', line.amount_minor,
        v_reference,
        jsonb_build_object(
          'provider', 'myfatoorah',
          'invoice_id', p.invoice_id,
          'supplier_scope', 'partner'
        )
      );
      v_credited := v_credited + line.amount_minor;
    end loop;

    select coalesce(sum(total_minor), 0) into v_order_total
    from public.order_items
    where order_id = p_order_id;

    if v_credited <> v_order_total then
      raise exception
        'ledger_allocation_mismatch: credited % of % for order %',
        v_credited, v_order_total, p_order_id;
    end if;
  end if;

  if p_suppliers is not null and jsonb_typeof(p_suppliers) = 'array' then
    for supplier_raw in select value from jsonb_array_elements(p_suppliers) loop
      update public.myfatoorah_payment_allocations
      set provider_share_minor = case
            when nullif(supplier_raw->>'ProposedShare', '') is not null
              then round((supplier_raw->>'ProposedShare')::numeric * 100)::bigint
            else provider_share_minor end,
          deposit_share_minor = case
            when nullif(supplier_raw->>'DepositShare', '') is not null
              then round((supplier_raw->>'DepositShare')::numeric * 100)::bigint
            else deposit_share_minor end,
          raw_supplier = supplier_raw,
          updated_at = now()
      where payment_id = p.id
        and supplier_code in (supplier_raw->>'SupplierCode', supplier_raw->>'Code');
    end loop;
  end if;

  return p;
end;
$$;

revoke all on function public.myfatoorah_payment_confirmed(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.myfatoorah_payment_confirmed(uuid, text, jsonb, jsonb)
  to service_role;
