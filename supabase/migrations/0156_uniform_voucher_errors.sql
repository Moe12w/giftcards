-- 0156_uniform_voucher_errors.sql
-- Security fix: the SECURITY DEFINER voucher lookup/redemption RPCs raised
-- 'voucher not found' for a missing code and 'not allowed' for an existing code
-- belonging to another tenant. That difference is a cross-tenant existence
-- oracle, even though RLS hides the row in direct selects. All unauthorized
-- outcomes now return the same generic message.

create or replace function public.voucher_for_redemption(p_code text)
returns table (
  voucher_id uuid,
  voucher_code text,
  product_name text,
  vendor_id uuid,
  vendor_name text,
  fulfilment_type public.fulfilment_type,
  status public.voucher_status,
  balance_minor bigint,
  total_sessions integer,
  remaining_sessions integer,
  expires_at timestamptz,
  multi_session_per_visit boolean,
  split_session_allowed boolean,
  booking_required boolean,
  can_redeem boolean,
  blocked_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_product public.products%rowtype;
  v_balance bigint;
  v_sessions integer;
begin
  select * into v_voucher
  from public.vouchers
  where voucher_code = upper(trim(p_code))
     or card_code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  limit 1;

  if v_voucher.id is null then
    raise exception 'voucher not found or not allowed';
  end if;

  if auth.uid() is not null
     and not coalesce(public.can_redeem_for(v_voucher.vendor_id), false) then
    raise exception 'voucher not found or not allowed';
  end if;

  select * into v_product from public.products where id = v_voucher.product_id;
  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries where voucher_id = v_voucher.id;
  select coalesce(sum(sessions), 0) into v_sessions
  from public.ledger_entries where voucher_id = v_voucher.id;

  return query
  select
    v_voucher.id,
    v_voucher.voucher_code,
    v_product.title,
    v_voucher.vendor_id,
    (select name from public.vendors where id = v_voucher.vendor_id),
    v_voucher.fulfilment_type,
    v_voucher.status,
    case when v_voucher.fulfilment_type = 'monetary' then v_balance else null end,
    v_voucher.total_sessions,
    case when v_voucher.fulfilment_type = 'experience' then v_sessions else null end,
    v_voucher.expires_at,
    coalesce(v_product.multi_session_per_visit, true),
    coalesce(v_product.split_session_allowed, true),
    coalesce(v_product.booking_required, false),
    (
      v_voucher.status in ('claimed', 'issued', 'active', 'partially_redeemed')
      and (v_voucher.expires_at is null or v_voucher.expires_at > now())
      and (
        (v_voucher.fulfilment_type = 'monetary' and v_balance > 0)
        or (v_voucher.fulfilment_type = 'experience' and v_sessions > 0)
      )
    ),
    (
      case
        when v_voucher.status not in ('claimed', 'issued', 'active', 'partially_redeemed')
          then 'voucher not redeemable'
        when v_voucher.expires_at is not null and v_voucher.expires_at <= now()
          then 'voucher expired'
        when v_voucher.fulfilment_type = 'monetary' and v_balance <= 0
          then 'no balance left'
        when v_voucher.fulfilment_type = 'experience' and v_sessions <= 0
          then 'no sessions left'
        else null
      end
    );
end;
$$;

create or replace function public.redeem_voucher_by_code(
  p_code text,
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
  where voucher_code = upper(trim(p_code))
     or card_code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  limit 1;

  if v_voucher.id is null then
    raise exception 'voucher not found or not allowed';
  end if;

  begin
    if v_voucher.fulfilment_type = 'monetary' then
      select * into v_result from public.redeem_monetary(v_voucher.id, p_amount_minor, p_notes);
      return query
        select v_result.redemption_id, v_result.redemption_reference, 'monetary'::public.redemption_kind,
          v_result.new_balance_minor, null::integer, v_result.new_status;
    else
      select * into v_result from public.redeem_sessions(v_voucher.id, p_sessions, p_notes, null);
      return query
        select v_result.redemption_id, v_result.redemption_reference, 'session'::public.redemption_kind,
          null::bigint, v_result.sessions_remaining, v_result.new_status;
    end if;
  exception
    when raise_exception then
      if sqlerrm = 'not allowed' then
        raise exception 'voucher not found or not allowed';
      end if;
      raise;
  end;
end;
$$;

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
  select * into v_voucher from public.vouchers where id = p_voucher_id;
  if v_voucher.id is null then
    raise exception 'voucher not found or not allowed';
  end if;

  begin
    if v_voucher.fulfilment_type = 'monetary' then
      select * into v_result from public.redeem_monetary(v_voucher.id, p_amount_minor, p_notes);
      return query
        select v_result.redemption_id, v_result.redemption_reference, 'monetary'::public.redemption_kind,
          v_result.new_balance_minor, null::integer, v_result.new_status;
    else
      select * into v_result from public.redeem_sessions(v_voucher.id, p_sessions, p_notes, null);
      return query
        select v_result.redemption_id, v_result.redemption_reference, 'session'::public.redemption_kind,
          null::bigint, v_result.sessions_remaining, v_result.new_status;
    end if;
  exception
    when raise_exception then
      if sqlerrm = 'not allowed' then
        raise exception 'voucher not found or not allowed';
      end if;
      raise;
  end;
end;
$$;
