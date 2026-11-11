-- 0028_claim_flow.sql
-- The public claim flow.
--
-- The claim link carries a secret token. The token is hashed inside the
-- database, so the raw token is never stored and never leaves the server.
--
--   claim_preview  — show the gift before it is claimed
--   claim_voucher  — claim it for the signed in recipient

create or replace function public.claim_preview(p_token text)
returns table (
  voucher_id uuid,
  voucher_code text,
  vendor_name text,
  product_title text,
  amount_minor bigint,
  remaining_value_minor bigint,
  total_sessions integer,
  remaining_sessions integer,
  sender_name text,
  gift_message text,
  expires_at timestamptz,
  status public.voucher_status,
  fulfilment_type public.fulfilment_type
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_voucher public.vouchers%rowtype;
  v_product public.products%rowtype;
  v_vendor public.vendors%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid token';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_voucher
  from public.vouchers
  where claim_token_hash = v_hash;

  if not found then
    raise exception 'invalid token';
  end if;

  select * into v_product from public.products where id = v_voucher.product_id;
  select * into v_vendor from public.vendors where id = v_voucher.vendor_id;

  return query
  select
    v_voucher.id,
    v_voucher.voucher_code,
    v_vendor.name,
    v_product.title,
    v_voucher.initial_value_minor,
    v_voucher.remaining_value_minor,
    v_voucher.total_sessions,
    v_voucher.remaining_sessions,
    v_voucher.recipient_name,
    v_voucher.gift_message,
    v_voucher.expires_at,
    v_voucher.status,
    v_voucher.fulfilment_type;
end;
$$;

create or replace function public.claim_voucher(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_card_id uuid;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid token';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  v_card_id := public.claim_card(v_hash);

  return v_card_id;
end;
$$;

revoke all on function public.claim_preview(text) from public;
grant execute on function public.claim_preview(text) to anon, authenticated;
revoke all on function public.claim_voucher(text) from public;
grant execute on function public.claim_voucher(text) to authenticated;
