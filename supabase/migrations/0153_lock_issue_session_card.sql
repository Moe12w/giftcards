-- 0153_lock_issue_session_card.sql
-- Security fix: public.issue_session_card is a SECURITY DEFINER function that
-- writes vouchers and balance-increasing ledger entries. Migration 0009 granted
-- EXECUTE to `authenticated`, and the two later CREATE OR REPLACE redefinitions
-- (0012, 0131) preserved that grant. The body only checked that the product was
-- an experience offer, so any signed-in user could call the RPC directly with an
-- arbitrary amount and mint redeemable balance without paying.
--
-- All legitimate callers are trusted: issue_gift_card (0131:66) and
-- myfatoorah_fulfill_order (0120:404) are definer/service-role functions that
-- pass the paid order item's total_minor. This migration:
--   1. redefines the function with an order-ownership + amount-binding check;
--   2. revokes EXECUTE from PUBLIC/anon/authenticated;
--   3. grants EXECUTE only to service_role.
-- SECURITY DEFINER callers run as the owner (postgres), so trusted call chains
-- continue to work without an explicit grant.

create or replace function public.issue_session_card(
  p_offer_id uuid,
  p_order_id uuid,
  p_buyer_id uuid,
  p_original_value_minor bigint,
  p_claim_token_hash text,
  p_recipient_name text,
  p_recipient_email text,
  p_recipient_phone text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_id uuid;
  v_sessions integer;
  v_vendor_id uuid;
  v_code text;
begin
  select session_count, vendor_id into v_sessions, v_vendor_id
  from public.products
  where id = p_offer_id and fulfilment_type = 'experience';

  if v_sessions is null then
    raise exception 'offer is not a session offer';
  end if;

  -- Where an order id is supplied, the amount must come from that order's item
  -- for this buyer. Legitimate callers pass item.total_minor. Bulk fulfillment
  -- passes a null order id; that path is already restricted to trusted definer
  -- functions (this RPC is no longer executable by authenticated clients).
  if p_order_id is not null and not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.buyer_id = p_buyer_id
      and exists (
        select 1
        from public.order_items oi
        where oi.order_id = o.id
          and oi.product_id = p_offer_id
          and oi.total_minor = p_original_value_minor
      )
  ) then
    raise exception 'invalid_order_for_issuance';
  end if;

  v_code := public.generate_voucher_code();

  insert into public.vouchers (
    product_id, order_id, buyer_id, recipient_name, recipient_email,
    recipient_phone, initial_value_minor, claim_token_hash, expires_at,
    vendor_id, fulfilment_type, status, total_sessions, remaining_sessions, used_sessions,
    voucher_code, card_code_hash
  )
  values (
    p_offer_id, p_order_id, p_buyer_id, p_recipient_name, p_recipient_email,
    p_recipient_phone, p_original_value_minor, p_claim_token_hash, p_expires_at,
    v_vendor_id, 'experience', 'issued', v_sessions, v_sessions, 0,
    v_code, encode(extensions.digest(upper(v_code), 'sha256'), 'hex')
  )
  returning id into v_card_id;

  -- The price is money, the entitlement is sessions.
  insert into public.ledger_entries (voucher_id, order_id, entry_type, amount_minor, sessions)
  values (v_card_id, p_order_id, 'issue', p_original_value_minor, v_sessions);

  return v_card_id;
end;
$$;

revoke all on function public.issue_session_card(uuid, uuid, uuid, bigint, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_session_card(uuid, uuid, uuid, bigint, text, text, text, text, timestamptz) to service_role;
