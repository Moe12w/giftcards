-- 0142_claim_preview_service_role.sql
--
-- M2 follow-up: 0140/0141 limited claim_preview per token, but a per-caller
-- limit needs the caller's address, and PostgREST does not guarantee it passes
-- x-forwarded-for through. The only place the real address is reliably known is
-- the Edge Function runtime, which sits in front of the database.
--
-- So claim_preview becomes a service-role-only function that accepts the source
-- address explicitly. Two callers use it:
--
--   supabase/functions/claim-preview   the mobile app; the runtime supplies the
--                                      address it observed on the request
--   web/app/claim/[token]/page.tsx     server component; Next supplies the
--                                      visitor's x-forwarded-for
--
-- Anyone still holding the anon key can no longer call it directly, which is
-- what makes the per-address limit meaningful rather than advisory.

-- Remove the anonymously callable one-argument version first, so the new
-- signature with a defaulted second argument cannot be ambiguous.
drop function if exists public.claim_preview(text);

create or replace function public.claim_preview(p_token text, p_source text default null)
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

  -- One network cannot sweep links. The caller's address is passed in by a
  -- trusted server (Edge Function runtime or the Next server component); the
  -- PostgREST header lookup stays as a fallback for any server-side caller that
  -- did not supply one.
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

revoke all on function public.claim_preview(text, text) from public, anon, authenticated;
grant execute on function public.claim_preview(text, text) to service_role;
