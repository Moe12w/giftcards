-- 0134_partial_refund_reduces_card_value.sql
--
-- A partial refund reversed the seller's ledger but left the gift card worth
-- its full remaining value, so the customer kept money that had been returned.
-- This adds the missing half: whenever a vendor 'refund' entry is written to
-- financial_ledger, the same amount is taken off that vendor's cards for the
-- order.
--
-- Rules:
--  - monetary vouchers only (an experience card has sessions, not a balance);
--  - the reduction is written to ledger_entries as a signed 'refund' entry, so
--    the card balance view and the cached remaining_value_minor stay in sync;
--  - a card is never reduced below zero; if the refund is larger than what is
--    left on the cards (because value was already redeemed), the excess is not
--    invented;
--  - a card reduced to zero is void; a partially reduced card keeps its status.
--
-- The trigger makes this apply to every refund path, not just the MyFatoorah
-- one. A full refund still voids the vouchers explicitly, as before.

create index if not exists vouchers_order_vendor_idx
  on public.vouchers (order_id, vendor_id)
  where order_id is not null;

create or replace function public.reduce_voucher_value_for_refund(
  p_vendor_id uuid,
  p_order_id uuid,
  p_amount_minor bigint,
  p_reference text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher record;
  v_balance bigint;
  v_reduce bigint;
  v_new bigint;
  v_remaining bigint := p_amount_minor;
  v_reduced bigint := 0;
begin
  if p_amount_minor is null or p_amount_minor <= 0 or p_order_id is null then
    return 0;
  end if;

  for v_voucher in
    select v.id
    from public.vouchers v
    where v.order_id = p_order_id
      and v.vendor_id = p_vendor_id
      and v.fulfilment_type = 'monetary'
      and v.status in ('issued', 'claimed', 'active', 'partially_redeemed')
    order by v.created_at, v.id
    for update
  loop
    exit when v_remaining <= 0;

    select coalesce(sum(amount_minor), 0) into v_balance
    from public.ledger_entries
    where voucher_id = v_voucher.id;

    if v_balance <= 0 then
      continue;
    end if;

    v_reduce := least(v_balance, v_remaining);
    v_new := v_balance - v_reduce;

    insert into public.ledger_entries
      (voucher_id, order_id, entry_type, amount_minor)
    values
      (v_voucher.id, p_order_id, 'refund', -v_reduce);

    update public.vouchers
    set remaining_value_minor = v_new,
        status = case when v_new = 0
                      then 'void'::public.voucher_status
                      else status end,
        updated_at = now()
    where id = v_voucher.id;

    v_reduced := v_reduced + v_reduce;
    v_remaining := v_remaining - v_reduce;
  end loop;

  return v_reduced;
end;
$$;

revoke all on function public.reduce_voucher_value_for_refund(uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.reduce_voucher_value_for_refund(uuid, uuid, bigint, text)
  to service_role;

create or replace function public.financial_ledger_refund_reduces_vouchers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entry_type = 'refund'
     and new.vendor_id is not null
     and new.order_id is not null
     and new.amount_minor < 0 then
    perform public.reduce_voucher_value_for_refund(
      new.vendor_id,
      new.order_id,
      -new.amount_minor,
      new.reference
    );
  end if;
  return new;
end;
$$;

revoke all on function public.financial_ledger_refund_reduces_vouchers()
  from public, anon, authenticated;

drop trigger if exists financial_ledger_refund_vouchers on public.financial_ledger;
create trigger financial_ledger_refund_vouchers
  after insert on public.financial_ledger
  for each row execute function public.financial_ledger_refund_reduces_vouchers();
