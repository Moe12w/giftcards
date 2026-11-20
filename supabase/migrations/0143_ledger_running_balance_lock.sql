-- 0143_ledger_running_balance_lock.sql
--
-- M5: myfatoorah_financial_entry / myfatoorah_partner_financial_entry computed
-- balance_after_minor as `sum(amount_minor)` and then inserted. Two concurrent
-- writes for the same seller both read the same start, both added their own
-- amount, and both stored the same running balance -- the second row's value
-- was short by the first row's amount. The authoritative balance views are
-- unaffected (they sum the immutable ledger), but anything reading the stored
-- column (exports, statements) could disagree with the account.
--
-- Fixed by taking a transaction-scoped advisory lock keyed on the seller before
-- the sum and the insert, so the second writer waits and then sees the first
-- row. An advisory lock is used rather than `select ... for update` on the
-- vendor row because the exposure trigger on order_items also locks that row,
-- and mixing the two lock spaces invites deadlocks between checkout and
-- settlement. The lock is released automatically when the transaction ends,
-- including on rollback.
--
-- The production ledger is empty at the time of applying, so no historical
-- balance_after_minor values need recomputing (and the append-only trigger
-- would refuse to update them anyway).

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
    (p_entry_type, p_vendor_id, p_order_id, p_amount_minor, 'QAR', p_reference,
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
    (p_entry_type, p_partner_id, p_order_id, p_amount_minor, 'QAR', p_reference,
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
