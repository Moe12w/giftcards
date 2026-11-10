-- 0005_exposure_and_lookup.sql
-- Helper functions used by Edge Functions.

-- Outstanding unredeemed value for a vendor, derived from the ledger.
create or replace function public.vendor_outstanding_minor(p_vendor_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(le.amount_minor), 0)::bigint
  from public.gift_cards c
  join public.offers o on o.id = c.offer_id
  join public.ledger_entries le on le.card_id = c.id
  where o.vendor_id = p_vendor_id
    and c.status in ('issued', 'claimed');
$$;

-- Resolve a redemption code hash to its card (vendor/admin only, enforced by
-- the redeem flow). Returns the derived balance.
create or replace function public.card_by_code_hash(p_code_hash text)
returns table (
  card_id uuid,
  offer_id uuid,
  vendor_id uuid,
  status public.card_status,
  balance_minor bigint,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.offer_id,
    o.vendor_id,
    c.status,
    coalesce(sum(le.amount_minor), 0)::bigint,
    c.expires_at
  from public.gift_cards c
  join public.offers o on o.id = c.offer_id
  left join public.ledger_entries le on le.card_id = c.id
  where c.card_code_hash = p_code_hash
  group by c.id, c.offer_id, o.vendor_id, c.status, c.expires_at;
$$;

revoke all on function public.vendor_outstanding_minor(uuid) from public;
grant execute on function public.vendor_outstanding_minor(uuid) to service_role;

revoke all on function public.card_by_code_hash(text) from public;
grant execute on function public.card_by_code_hash(text) to authenticated;
