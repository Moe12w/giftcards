-- 0131_checkout_voucher_codes.sql
--
-- Why: gift cards issued by the MyFatoorah checkout were inserted by
-- issue_gift_card / issue_session_card without a voucher_code. The vendor
-- dashboard redeems by code (redeem_voucher_by_code), so a card bought online
-- scanned at the counter failed with "voucher not found". Demo, bulk and
-- admin-issued cards all set a code, which is why only the demo cards worked.
--
-- This migration:
--   1. generates a human-readable code during issuance and stores its hash;
--   2. backfills vouchers that were issued without one;
--   3. adds redeem_voucher_by_id, the same redemption rules reached by voucher
--      id, so a scanned QR works even for a voucher with no code.
--
-- Callers that assign their own codes (bulk fulfilment, admin manual issue)
-- still overwrite the generated value right after the insert.

create or replace function public.generate_voucher_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := 'GFT-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
    exit when not exists (select 1 from public.vouchers where voucher_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function public.generate_voucher_code() from public, anon, authenticated;

create or replace function public.issue_gift_card(
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
  v_vendor_id uuid;
  v_fulfilment public.fulfilment_type;
  v_code text;
begin
  select vendor_id, fulfilment_type
    into v_vendor_id, v_fulfilment
  from public.products
  where id = p_offer_id;

  if v_fulfilment = 'experience' then
    return public.issue_session_card(
      p_offer_id, p_order_id, p_buyer_id, p_original_value_minor,
      p_claim_token_hash, p_recipient_name, p_recipient_email, p_recipient_phone, p_expires_at
    );
  end if;

  v_code := public.generate_voucher_code();

  insert into public.vouchers (
    product_id, order_id, buyer_id, recipient_name, recipient_email,
    recipient_phone, initial_value_minor, remaining_value_minor,
    claim_token_hash, expires_at, vendor_id, fulfilment_type, status,
    voucher_code, card_code_hash
  )
  values (
    p_offer_id, p_order_id, p_buyer_id, p_recipient_name, p_recipient_email,
    p_recipient_phone, p_original_value_minor, p_original_value_minor,
    p_claim_token_hash, p_expires_at, v_vendor_id, 'monetary', 'issued',
    v_code, encode(extensions.digest(upper(v_code), 'sha256'), 'hex')
  )
  returning id into v_card_id;

  insert into public.ledger_entries (voucher_id, order_id, entry_type, amount_minor)
  values (v_card_id, p_order_id, 'issue', p_original_value_minor);

  return v_card_id;
end;
$$;

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

-- Backfill: cards issued before this migration have no code. Their
-- card_code_hash was built from random bytes whose plaintext was discarded, so
-- replacing it with the hash of the new code loses nothing.
do $$
declare
  v_id uuid;
  v_code text;
begin
  for v_id in
    select id from public.vouchers where voucher_code is null order by created_at
  loop
    v_code := public.generate_voucher_code();
    update public.vouchers
    set voucher_code = v_code,
        card_code_hash = encode(extensions.digest(upper(v_code), 'sha256'), 'hex'),
        updated_at = now()
    where id = v_id;
  end loop;
end $$;

-- Redemption by voucher id: identical rules to redeem_voucher_by_code, reached
-- from the scanned QR instead of a typed code. Vendor rights are checked inside
-- redeem_monetary / redeem_sessions.
create or replace function public.redeem_voucher_by_id(
  p_voucher_id uuid,
  p_amount_minor bigint default null,
  p_sessions integer default null,
  p_notes text default null
)
returns table (
  redemption_id uuid,
  redemption_reference text,
  kind public.redemption_kind,
  remaining_value_minor bigint,
  sessions_remaining integer,
  new_status public.voucher_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_result record;
begin
  select * into v_voucher
  from public.vouchers
  where id = p_voucher_id;

  if v_voucher.id is null then
    raise exception 'voucher not found';
  end if;

  if v_voucher.fulfilment_type = 'monetary' then
    select * into v_result
    from public.redeem_monetary(v_voucher.id, p_amount_minor, p_notes);
    return query
      select v_result.redemption_id, v_result.redemption_reference, 'monetary'::public.redemption_kind,
        v_result.new_balance_minor, null::integer, v_result.new_status;
  else
    select * into v_result
    from public.redeem_sessions(v_voucher.id, p_sessions, p_notes, null);
    return query
      select v_result.redemption_id, v_result.redemption_reference, 'session'::public.redemption_kind,
        null::bigint, v_result.sessions_remaining, v_result.new_status;
  end if;
end;
$$;

revoke all on function public.redeem_voucher_by_id(uuid, bigint, integer, text) from public, anon;
grant execute on function public.redeem_voucher_by_id(uuid, bigint, integer, text) to authenticated;
