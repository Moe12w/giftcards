-- 0178_integration_refund_conflict.sql
--
-- integration_refund has OUT parameters named amount_minor and status, which
-- shadow columns in integration_refunds and led it to SQLSTATE 42702. Re-define
-- the function with the PL/pgSQL directive that resolves unqualified names to
-- columns. No behaviour changes.
--
create or replace function public.integration_refund(
  p_platform_id uuid,
  p_redemption_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_idempotency_key text,
  p_mapping_id uuid default null
)
returns table (
  refund_id uuid,
  redemption_id uuid,
  amount_minor bigint,
  new_balance_minor bigint,
  new_status public.voucher_status,
  fully_refunded boolean,
  already_refunded_minor bigint
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_platform public.integration_platforms%rowtype;
  v_mapping public.integration_vendor_mappings%rowtype;
  v_redemption public.redemptions%rowtype;
  v_voucher public.vouchers%rowtype;
  v_existing public.integration_refunds%rowtype;
  v_refund_id uuid;
  v_already bigint;
  v_balance bigint;
  v_new_balance bigint;
  v_new_status public.voucher_status;
  v_full boolean;
begin
  select * into v_platform
  from public.integration_platforms
  where id = p_platform_id;

  if v_platform.id is null or v_platform.status <> 'active' then
    raise exception 'platform not active';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select * into v_redemption
  from public.redemptions
  where id = p_redemption_id
  for update;

  if v_redemption.id is null then
    raise exception 'redemption not found';
  end if;
  if v_redemption.kind <> 'monetary'
     or v_redemption.channel <> 'external_platform'
     or v_redemption.platform_id is distinct from p_platform_id then
    raise exception 'refund not allowed';
  end if;

  if p_mapping_id is not null then
    select * into v_mapping
    from public.integration_vendor_mappings
    where id = p_mapping_id
      and platform_id = p_platform_id;

    if v_mapping.id is null then
      raise exception 'mapping not found';
    end if;
    if v_mapping.status <> 'active' then
      raise exception 'mapping not active';
    end if;
    if v_redemption.vendor_id is distinct from v_mapping.vendor_id then
      raise exception 'wrong business';
    end if;
  end if;

  select * into v_voucher
  from public.vouchers
  where id = v_redemption.voucher_id
  for update;

  if v_voucher.id is null then
    raise exception 'voucher not found';
  end if;

  -- Replay the original response for the same idempotency key.
  select * into v_existing
  from public.integration_refunds
  where platform_id = p_platform_id
    and idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    select coalesce(sum(amount_minor), 0) into v_balance
    from public.ledger_entries
    where voucher_id = v_voucher.id;

    return query
      select v_existing.id, v_existing.redemption_id, v_existing.amount_minor,
        v_balance, v_voucher.status,
        (v_redemption.status = 'reversed'),
        coalesce((
          select sum(amount_minor) from public.integration_refunds
          where redemption_id = v_redemption.id and status = 'completed'
        ), 0);
    return;
  end if;

  select coalesce(sum(amount_minor), 0) into v_already
  from public.integration_refunds
  where redemption_id = v_redemption.id
    and status = 'completed';

  if p_amount_minor > coalesce(v_redemption.amount_minor, 0) - v_already then
    raise exception 'invalid amount';
  end if;

  insert into public.integration_refunds (
    platform_id, reservation_id, redemption_id, voucher_id, vendor_id,
    external_order_id, amount_minor, currency, status, idempotency_key,
    reason, created_by
  )
  values (
    p_platform_id, v_redemption.reservation_id, v_redemption.id, v_redemption.voucher_id,
    v_redemption.vendor_id, v_redemption.external_order_id, p_amount_minor,
    v_voucher.currency, 'completed', p_idempotency_key, p_reason, auth.uid()
  )
  returning id into v_refund_id;

  -- A reversal is a positive refund entry. It is deliberately separate from the
  -- purchase-refund trigger in 0135, which reacts to negative financial_ledger
  -- refunds and is untouched.
  insert into public.ledger_entries (voucher_id, entry_type, amount_minor, redemption_id, staff_user_id)
  values (v_voucher.id, 'refund', p_amount_minor, v_redemption.id, auth.uid());

  select coalesce(sum(amount_minor), 0) into v_new_balance
  from public.ledger_entries
  where voucher_id = v_voucher.id;

  if v_new_balance <= 0 then
    v_new_status := 'redeemed';
  elsif v_new_balance >= coalesce(v_voucher.initial_value_minor, v_new_balance) then
    v_new_status := 'active';
  else
    v_new_status := 'partially_redeemed';
  end if;

  update public.vouchers
  set remaining_value_minor = greatest(v_new_balance, 0),
      status = v_new_status,
      redeemed_at = case when v_new_balance > 0 then null else redeemed_at end,
      updated_at = now()
  where id = v_voucher.id;

  v_full := (v_already + p_amount_minor) >= coalesce(v_redemption.amount_minor, 0);

  if v_full then
    update public.redemptions
    set status = 'reversed'
    where id = v_redemption.id;
  end if;

  perform public.write_audit(
    'integration_redemption_refunded',
    'redemption',
    v_redemption.id::text,
    jsonb_build_object('amount_minor', v_redemption.amount_minor, 'already_refunded_minor', v_already),
    jsonb_build_object(
      'refund_id', v_refund_id,
      'amount_minor', p_amount_minor,
      'new_balance_minor', v_new_balance,
      'fully_refunded', v_full
    )
  );

  return query
    select v_refund_id, v_redemption.id, p_amount_minor, v_new_balance,
      v_new_status, v_full, v_already + p_amount_minor;
end;
$$;
revoke all on function public.integration_refund(uuid,uuid,bigint,text,text,uuid) from public, anon, authenticated;
grant execute on function public.integration_refund(uuid,uuid,bigint,text,text,uuid) to service_role;
