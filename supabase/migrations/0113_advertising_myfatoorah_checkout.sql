-- 0113_advertising_myfatoorah_checkout.sql
-- Advertising is paid by card through MyFatoorah.
--
-- 1. `advertising_start_checkout` records the invoice an advertiser was sent to
--    pay, so the callback and webhook can be matched to the booking and the
--    wallet/ledger stay untouched until the provider confirms.
-- 2. `advertising_confirm_payment` refuses a booking window that has already
--    ended, so a card payment can never buy a slot in the past.

create index if not exists advertising_campaigns_payment_reference_idx
  on public.advertising_campaigns (payment_reference);

-- ---------------------------------------------------------------------------
-- 1. Start a hosted card checkout for a campaign
-- ---------------------------------------------------------------------------

create or replace function public.advertising_start_checkout(
  p_campaign_id uuid,
  p_invoice_id text,
  p_payment_url text,
  p_provider text default 'myfatoorah',
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  tx record;
  v_tx uuid;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not public.advertising_can_manage_vendor(c.vendor_id) then
    raise exception 'not_authorized';
  end if;

  if c.payment_status = 'paid' then
    return jsonb_build_object(
      'campaign_id', c.id,
      'status', c.status,
      'already_paid', true,
      'amount_minor', c.quote_amount_minor,
      'currency', c.currency);
  end if;

  if c.status not in ('draft', 'rejected', 'pending_payment') then
    raise exception 'campaign_not_payable';
  end if;

  -- Never open a checkout for a window that is already gone.
  if c.ends_at <= now() then
    raise exception 'booking_window_expired';
  end if;

  if coalesce(trim(p_invoice_id), '') = '' then
    raise exception 'invoice_required';
  end if;

  select * into tx
  from public.advertising_transactions
  where campaign_id = c.id and kind = 'payment'
  order by created_at desc
  limit 1;

  if found then
    if tx.status = 'succeeded' then
      return jsonb_build_object(
        'campaign_id', c.id,
        'status', c.status,
        'already_paid', true,
        'amount_minor', c.quote_amount_minor,
        'currency', c.currency);
    end if;

    update public.advertising_transactions
    set status = 'pending',
        provider = coalesce(p_provider, 'myfatoorah'),
        provider_reference = p_invoice_id,
        amount_minor = c.quote_amount_minor,
        currency = c.currency,
        raw_payload = coalesce(p_meta, '{}'::jsonb)
          || jsonb_build_object('invoice_id', p_invoice_id, 'payment_url', p_payment_url),
        processed_at = null
    where id = tx.id;
    v_tx := tx.id;
  else
    insert into public.advertising_transactions
      (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
       provider_reference, idempotency_key, description, raw_payload, created_by)
    values
      (c.id, c.vendor_id, 'payment', 'pending', c.quote_amount_minor, c.currency,
       coalesce(p_provider, 'myfatoorah'), p_invoice_id,
       'payment:' || c.id::text, 'Advertising card payment',
       coalesce(p_meta, '{}'::jsonb)
         || jsonb_build_object('invoice_id', p_invoice_id, 'payment_url', p_payment_url),
       auth.uid())
    returning id into v_tx;
  end if;

  update public.advertising_campaigns
  set payment_provider = coalesce(p_provider, 'myfatoorah'),
      payment_reference = p_invoice_id,
      updated_at = now()
  where id = c.id;

  perform public.advertising_audit(
    'checkout_started', 'advertising_campaign', c.id,
    jsonb_build_object('provider', p_provider, 'invoice_id', p_invoice_id,
                       'amount_minor', c.quote_amount_minor));

  return jsonb_build_object(
    'campaign_id', c.id,
    'transaction_id', v_tx,
    'amount_minor', c.quote_amount_minor,
    'currency', c.currency,
    'status', c.status,
    'already_paid', false);
end;
$$;

grant execute on function public.advertising_start_checkout(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.advertising_start_checkout(uuid, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Confirming a provider payment must respect the clock
-- ---------------------------------------------------------------------------

create or replace function public.advertising_confirm_payment(
  p_campaign_id uuid,
  p_provider text,
  p_provider_reference text,
  p_amount_minor bigint,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  tx record;
  v_amount bigint;
  v_tx uuid;
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not_authorized';
  end if;

  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;

  if c.payment_status = 'paid' then
    return jsonb_build_object('campaign_id', c.id, 'status', c.status, 'already_paid', true);
  end if;

  if c.status not in ('pending_payment', 'draft', 'rejected') then
    raise exception 'campaign_not_payable';
  end if;

  -- A payment that lands after the booked window cannot activate, so it is
  -- never accepted as payment for this campaign.
  if c.ends_at <= now() then
    raise exception 'booking_window_expired';
  end if;

  v_amount := coalesce(p_amount_minor, c.quote_amount_minor);
  if v_amount < c.quote_amount_minor then
    raise exception 'amount_below_quote';
  end if;

  if p_provider_reference is not null and exists (
    select 1 from public.advertising_transactions
    where provider = coalesce(p_provider, 'manual')
      and provider_reference = p_provider_reference
      and campaign_id <> c.id
  ) then
    raise exception 'payment_reference_already_used';
  end if;

  select * into tx
  from public.advertising_transactions
  where campaign_id = c.id and kind = 'payment'
  order by created_at desc
  limit 1;

  if found then
    if tx.status = 'succeeded' then
      return jsonb_build_object('campaign_id', c.id, 'status', c.status, 'already_paid', true);
    end if;
    update public.advertising_transactions
    set status = 'succeeded',
        provider = coalesce(p_provider, 'manual'),
        provider_reference = coalesce(p_provider_reference, provider_reference),
        amount_minor = v_amount,
        raw_payload = coalesce(p_raw_payload, '{}'::jsonb),
        processed_at = now()
    where id = tx.id;
    v_tx := tx.id;
  else
    insert into public.advertising_transactions
      (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
       provider_reference, idempotency_key, description, raw_payload, processed_at)
    values
      (c.id, c.vendor_id, 'payment', 'succeeded', v_amount, c.currency,
       coalesce(p_provider, 'manual'), p_provider_reference,
       'payment:' || c.id::text, 'Advertising payment',
       coalesce(p_raw_payload, '{}'::jsonb), now())
    returning id into v_tx;
  end if;

  insert into public.advertising_ledger_entries
    (transaction_id, campaign_id, vendor_id, entry_type, entry_key, direction,
     amount_minor, balance_after_minor, currency, reference, metadata)
  values
    (v_tx, c.id, c.vendor_id, 'payment_received', 'pay:' || v_tx::text, 'credit',
     v_amount, c.total_budget_minor, c.currency, c.campaign_ref,
     coalesce(p_raw_payload, '{}'::jsonb))
  on conflict (entry_key) do nothing;

  update public.advertising_campaigns
  set payment_status = 'paid',
      payment_reference = coalesce(p_provider_reference, payment_reference),
      payment_provider = coalesce(p_provider, payment_provider),
      updated_at = now()
  where id = c.id;

  perform public.advertising_mark_paid(c.id, v_tx);
  perform public.advertising_audit(
    'payment_confirmed', 'advertising_campaign', c.id,
    jsonb_build_object('provider', p_provider, 'reference', p_provider_reference,
                       'amount_minor', v_amount, 'transaction_id', v_tx));

  select * into c from public.advertising_campaigns where id = p_campaign_id;
  return jsonb_build_object(
    'campaign_id', c.id,
    'status', c.status,
    'already_paid', false,
    'transaction_id', v_tx);
end;
$$;
