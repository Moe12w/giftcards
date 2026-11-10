-- 0021_fulfilment_aware_balances.sql
-- A voucher only has the balance its fulfilment type calls for.
--
--   monetary   : a money balance, derived from the ledger
--   experience : a number of sessions, derived from the ledger, and never a
--                money balance - the package price is recorded in the ledger
--                but it is not spendable
--
-- The reconciliation helper compares each counter against the right ledger
-- column, so an experience card is never reported as inconsistent just because
-- its issue row carries the price.

-- `vendor_cards` reads `card_balances`, so it is dropped first.
drop view if exists public.vendor_cards;
drop view if exists public.card_balances;

create or replace view public.card_balances
with (security_invoker = true) as
select
  v.id as voucher_id,
  v.id as card_id,
  v.fulfilment_type,
  case
    when v.fulfilment_type = 'monetary'
      then coalesce(sum(le.amount_minor), 0)::bigint
    else 0::bigint
  end as balance_minor,
  case
    when v.fulfilment_type = 'experience'
      then coalesce(sum(le.sessions), 0)::integer
    else 0::integer
  end as sessions_remaining
from public.vouchers v
left join public.ledger_entries le on le.voucher_id = v.id
group by v.id, v.fulfilment_type;

-- The return type changed, so the function is dropped first.
drop function if exists public.verify_voucher_balances();

create or replace function public.verify_voucher_balances()
returns table (
  voucher_id uuid,
  voucher_code text,
  fulfilment_type public.fulfilment_type,
  cached_value bigint,
  ledger_value bigint,
  cached_sessions integer,
  ledger_sessions integer,
  is_consistent boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.voucher_code,
    v.fulfilment_type,
    coalesce(v.remaining_value_minor, 0),
    case when v.fulfilment_type = 'monetary'
      then coalesce((select sum(amount_minor) from public.ledger_entries le where le.voucher_id = v.id), 0)
      else 0 end,
    coalesce(v.remaining_sessions, 0),
    case when v.fulfilment_type = 'experience'
      then coalesce((select sum(sessions) from public.ledger_entries le where le.voucher_id = v.id), 0)
      else 0 end,
    (
      case when v.fulfilment_type = 'monetary'
        then coalesce(v.remaining_value_minor, 0)
          = coalesce((select sum(amount_minor) from public.ledger_entries le where le.voucher_id = v.id), 0)
        else true
      end
      and
      case when v.fulfilment_type = 'experience'
        then coalesce(v.remaining_sessions, 0)
          = coalesce((select sum(sessions) from public.ledger_entries le where le.voucher_id = v.id), 0)
        else true
      end
    )
  from public.vouchers v;
$$;

grant execute on function public.verify_voucher_balances() to authenticated, service_role;

-- The vendor view is rebuilt on top of the new balance view.
create or replace view public.vendor_cards
with (security_invoker = true) as
select
  v.id as card_id,
  v.id as voucher_id,
  v.product_id,
  v.vendor_id,
  v.recipient_name,
  v.recipient_email,
  v.status,
  v.fulfilment_type,
  v.total_sessions,
  v.remaining_sessions,
  v.expires_at,
  coalesce(b.balance_minor, 0)::bigint as balance_minor,
  coalesce(b.sessions_remaining, 0)::integer as sessions_remaining
from public.vouchers v
left join public.card_balances b on b.voucher_id = v.id;
