-- 0155_hide_voucher_code_in_preview.sql
-- Security fix: claim_preview projected the voucher's redeemable code to the
-- unauthenticated claim-preview Edge Function. Possession of a bearer claim link
-- was therefore enough to obtain the code before signing in or binding the gift.
-- The web preview already omits this field; the mobile QR uses
-- `giftly:redeem:<voucherId>` when no code is supplied. Removing the column from
-- the RPC result keeps preview read-only and makes the post-claim gate real.

drop function if exists public.claim_preview(text, text);

create or replace function public.claim_preview(p_token text, p_source text default null)
returns table (
  voucher_id uuid,
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
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_source text;
  v_voucher public.vouchers%rowtype;
  v_product public.products%rowtype;
  v_vendor public.vendors%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid token';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- One link cannot be polled indefinitely.
  perform public.claim_rate_limit('claim-token:' || v_hash, 30, 600);

  v_source := nullif(btrim(coalesce(p_source, '')), '');
  if v_source is null or length(v_source) > 64 then
    v_source := public.request_client_ip();
  else
    v_source := left(v_source, 64);
  end if;

  if v_source is not null then
    perform public.claim_rate_limit('claim-ip:' || v_source, 120, 600);
  end if;

  select * into v_voucher
  from public.vouchers
  where claim_token_hash = v_hash;

  if not found then
    return;
  end if;

  select * into v_product from public.products where id = v_voucher.product_id;
  select * into v_vendor from public.vendors where id = v_voucher.vendor_id;

  return query
  select
    v_voucher.id,
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

revoke all on function public.claim_preview(text, text) from public, anon, authenticated;
grant execute on function public.claim_preview(text, text) to service_role;
