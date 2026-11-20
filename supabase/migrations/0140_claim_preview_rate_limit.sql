-- 0140_claim_preview_rate_limit.sql
--
-- M2: claim_preview is callable by anon and did no throttling. Every call
-- hashes the token and looked it up. The lookup is already indexed -- the
-- `unique` on vouchers.claim_token_hash from 0001 survives as
-- gift_cards_claim_token_hash_key, and EXPLAIN confirms an Index Scan -- so the
-- missing piece is a limit on how often an anonymous caller can ask.
--
-- Two buckets, both in the existing auth_attempts ledger (RLS-locked, service
-- role only; these functions are SECURITY DEFINER so they can write it):
--
--   claim-token:<sha256>  30 lookups / 10 min for one link. A recipient
--                         reloading the claim page never comes close; a loop
--                         against one token stops.
--   claim-ip:<address>   120 lookups / 10 min per caller *when the address is
--                         available*. It comes from PostgREST's
--                         `request.headers`, which is not guaranteed to carry
--                         x-forwarded-for, so the bucket is skipped rather than
--                         pooling every caller into one global "unknown"
--                         bucket that would throttle innocent users.
--
-- Enumeration is not made worse by the missing IP bucket: tokens are 32 random
-- bytes hashed with SHA-256, so guessing one is not a search problem, and the
-- index keeps each attempt cheap. A per-IP limit that does not depend on
-- client headers needs the claim route to run through an Edge Function, which
-- is a larger change.

create or replace function public.request_client_ip()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  headers jsonb;
  raw text;
begin
  begin
    headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    return null;
  end;
  if headers is null then
    return null;
  end if;

  raw := nullif(btrim(coalesce(headers ->> 'x-forwarded-for', '')), '');
  if raw is null then
    raw := nullif(btrim(coalesce(headers ->> 'cf-connecting-ip', '')), '');
  end if;
  if raw is null then
    return null;
  end if;

  -- Left-most entry is the original client; later entries are proxies.
  raw := nullif(btrim(split_part(raw, ',', 1)), '');
  if raw is null or length(raw) > 64 then
    return null;
  end if;
  return raw;
end;
$$;

create or replace function public.claim_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.auth_attempts
    where identifier = p_key
      and created_at > now() - make_interval(secs => greatest(p_window_seconds, 60))
  ) >= greatest(p_max, 1) then
    raise exception 'too_many_requests';
  end if;

  insert into public.auth_attempts (identifier, success) values (p_key, false);
end;
$$;

revoke all on function public.request_client_ip() from public, anon, authenticated;
revoke all on function public.claim_rate_limit(text, integer, integer) from public, anon, authenticated;

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

revoke all on function public.claim_preview(text) from public;
grant execute on function public.claim_preview(text) to anon, authenticated;
