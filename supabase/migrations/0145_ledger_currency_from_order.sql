-- 0145_ledger_currency_from_order.sql
--
-- Why: both financial entry helpers wrote a literal 'QAR' into
-- financial_ledger.currency. The marketplace sells in KWD, so every sale,
-- refund and payout row was labelled with the wrong currency — invisible on the
-- vendor dashboard (which formats a single currency) but wrong for any export,
-- reconciliation or multi-currency report built from that column.
--
-- The order's currency is the authoritative value: it is what the buyer was
-- charged and what the line totals are denominated in. 'KWD' is the fallback for
-- legacy orders that predate the column.
--
-- Nothing else about either function changes: same advisory lock, same running
-- balance, same direction rule.

create or replace function public.myfatoorah_financial_entry(
  p_vendor_id uuid,
  p_order_id uuid,
  p_entry_type text,
  p_amount_minor bigint,
  p_reference text,
  p_metadata jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  perform set_config('mf.internal', '1', true);

  perform pg_advisory_xact_lock(
    hashtextextended('financial_ledger:vendor:' || coalesce(p_vendor_id::text, 'platform'), 0)
  );

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.financial_ledger
  where vendor_id = p_vendor_id;
  v_balance := v_balance + p_amount_minor;

  insert into public.financial_ledger
    (entry_type, vendor_id, order_id, amount_minor, currency, reference, direction, balance_after_minor, metadata)
  values
    (p_entry_type, p_vendor_id, p_order_id, p_amount_minor,
     coalesce((select o.currency from public.orders o where o.id = p_order_id), 'KWD'),
     p_reference,
     case when p_amount_minor < 0 then 'debit' else 'credit' end,
     v_balance, coalesce(p_metadata, '{}'::jsonb));

  return v_balance;
end;
$$;

create or replace function public.myfatoorah_partner_financial_entry(
  p_partner_id uuid,
  p_order_id uuid,
  p_entry_type text,
  p_amount_minor bigint,
  p_reference text,
  p_metadata jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  perform set_config('mf.internal', '1', true);

  perform pg_advisory_xact_lock(
    hashtextextended('financial_ledger:partner:' || coalesce(p_partner_id::text, 'platform'), 0)
  );

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.financial_ledger
  where partner_id = p_partner_id;
  v_balance := v_balance + p_amount_minor;

  insert into public.financial_ledger
    (entry_type, partner_id, order_id, amount_minor, currency, reference, direction, balance_after_minor, metadata)
  values
    (p_entry_type, p_partner_id, p_order_id, p_amount_minor,
     coalesce((select o.currency from public.orders o where o.id = p_order_id), 'KWD'),
     p_reference,
     case when p_amount_minor < 0 then 'debit' else 'credit' end,
     v_balance, coalesce(p_metadata, '{}'::jsonb));

  return v_balance;
end;
$$;

revoke all on function public.myfatoorah_financial_entry(uuid, uuid, text, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.myfatoorah_financial_entry(uuid, uuid, text, bigint, text, jsonb)
  to service_role;

revoke all on function public.myfatoorah_partner_financial_entry(uuid, uuid, text, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.myfatoorah_partner_financial_entry(uuid, uuid, text, bigint, text, jsonb)
  to service_role;
