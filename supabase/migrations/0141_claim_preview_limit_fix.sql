-- 0141_claim_preview_limit_fix.sql
--
-- 0140 put the throttle inside claim_preview, but an unknown token raised
-- 'invalid token' *after* the counter insert -- and because the raise aborts the
-- whole statement, the counter row rolled back with it. A loop of guesses
-- therefore never accumulated and the limit could not fire for the case that
-- matters. Two changes:
--
--   1. An unknown token now returns no rows instead of raising. Both callers
--      treat "error or no data" as not found (web/app/claim/[token]/page.tsx
--      calls notFound(); src/lib/claim.ts returns null), so behaviour is
--      unchanged, but the counter insert commits.
--   2. The function is volatile, because it now writes. (0140 left it marked
--      stable; the write still happened through a security-definer callee, but
--      the label was wrong.)

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
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_ip text;
  v_voucher public.vouchers%rowtype;
  v_product public.products%rowtype;
  v_vendor public.vendors%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid token';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  perform public.claim_rate_limit('claim-token:' || v_hash, 30, 600);

  v_ip := public.request_client_ip();
  if v_ip is not null then
    perform public.claim_rate_limit('claim-ip:' || v_ip, 120, 600);
  end if;

  select * into v_voucher
  from public.vouchers
  where claim_token_hash = v_hash;

  -- No rows rather than an exception: that keeps the attempt counted.
  if not found then
    return;
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

revoke all on function public.claim_preview(text) from public;
grant execute on function public.claim_preview(text) to anon, authenticated;
