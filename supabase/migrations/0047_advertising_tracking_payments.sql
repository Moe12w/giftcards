-- 0047_advertising_tracking_payments.sql
-- Click/conversion tracking, payment verification and credit checkout.

-- ---------------------------------------------------------------------------
-- 1. Clicks
-- ---------------------------------------------------------------------------

create or replace function public.advertising_track_click(
  p_impression_id uuid,
  p_request_id text default null,
  p_viewer_key text default null,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i record;
  c record;
  cr record;
  v_click uuid;
  v_req text;
  v_cost bigint;
  v_viewer text;
  v_dedupe integer;
begin
  select * into i from public.advertising_impressions where id = p_impression_id;
  if not found then
    raise exception 'impression_not_found';
  end if;

  select * into c from public.advertising_campaigns where id = i.campaign_id;
  if not found then
    raise exception 'campaign_not_found';
  end if;

  select * into cr from public.advertising_creatives where id = i.creative_id;
  if not found then
    raise exception 'creative_not_found';
  end if;

  v_req := coalesce(nullif(p_request_id, ''), gen_random_uuid()::text);
  v_viewer := coalesce(nullif(p_viewer_key, ''), i.viewer_key, 'anon');

  if exists (select 1 from public.advertising_clicks where request_id = v_req) then
    return jsonb_build_object(
      'click_id', null,
      'destination_type', cr.destination_type,
      'destination_id', cr.destination_id,
      'destination_url', cr.destination_url,
      'duplicate', true);
  end if;

  v_dedupe := public.advertising_rule_int('click_dedupe_seconds', 5);
  if exists (
    select 1 from public.advertising_clicks
    where campaign_id = c.id
      and viewer_key = v_viewer
      and clicked_at > now() - make_interval(secs => v_dedupe)
  ) then
    return jsonb_build_object(
      'click_id', null,
      'destination_type', cr.destination_type,
      'destination_id', cr.destination_id,
      'destination_url', cr.destination_url,
      'duplicate', true);
  end if;

  insert into public.advertising_clicks
    (impression_id, campaign_id, creative_id, placement_id, vendor_id,
     viewer_key, session_id, request_id)
  values
    (i.id, c.id, i.creative_id, i.placement_id, i.vendor_id,
     v_viewer, coalesce(nullif(p_session_id, ''), i.session_id), v_req)
  returning id into v_click;

  if c.pricing_model = 'cpc' and c.cpc_rate_minor > 0 then
    v_cost := public.advertising_charge_campaign(
      c.id, c.cpc_rate_minor, 'cpc_charge', 'click:' || v_click::text,
      jsonb_build_object('click_id', v_click));
    update public.advertising_clicks
    set cost_minor = v_cost, billed = v_cost > 0
    where id = v_click;
  end if;

  return jsonb_build_object(
    'click_id', v_click,
    'destination_type', cr.destination_type,
    'destination_id', cr.destination_id,
    'destination_url', cr.destination_url,
    'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Conversions
-- ---------------------------------------------------------------------------

create or replace function public.advertising_track_conversion(
  p_campaign_id uuid,
  p_click_id uuid default null,
  p_order_id uuid default null,
  p_voucher_id uuid default null,
  p_value_minor bigint default 0,
  p_conversion_type text default 'purchase',
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  cl record;
  imp record;
  v_win integer;
  v_req text;
  v_id uuid;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id;
  if not found then
    raise exception 'campaign_not_found';
  end if;

  v_win := public.advertising_rule_int('attribution_window_minutes', 43200);
  v_req := coalesce(nullif(p_request_id, ''), gen_random_uuid()::text);

  if exists (select 1 from public.advertising_conversions where request_id = v_req) then
    return (select id from public.advertising_conversions where request_id = v_req);
  end if;

  select * into cl
  from public.advertising_clicks
  where campaign_id = p_campaign_id
    and (p_click_id is null or id = p_click_id)
    and clicked_at >= now() - make_interval(mins => v_win)
  order by clicked_at desc
  limit 1;

  if found then
    insert into public.advertising_conversions
      (campaign_id, creative_id, click_id, impression_id, vendor_id, order_id,
       voucher_id, conversion_type, value_minor, currency, request_id,
       attribution_window_minutes, metadata)
    values
      (c.id, cl.creative_id, cl.id, cl.impression_id, c.vendor_id, p_order_id,
       p_voucher_id, coalesce(p_conversion_type, 'purchase'),
       greatest(coalesce(p_value_minor, 0), 0), c.currency, v_req, v_win,
       coalesce(p_metadata, '{}'::jsonb))
    returning id into v_id;
  else
    select * into imp
    from public.advertising_impressions
    where campaign_id = p_campaign_id
      and served_at >= now() - make_interval(mins => v_win)
    order by served_at desc
    limit 1;

    if not found then
      raise exception 'no_attributable_touch';
    end if;

    insert into public.advertising_conversions
      (campaign_id, creative_id, click_id, impression_id, vendor_id, order_id,
       voucher_id, conversion_type, value_minor, currency, request_id,
       attribution_window_minutes, metadata)
    values
      (c.id, imp.creative_id, null, imp.id, c.vendor_id, p_order_id,
       p_voucher_id, coalesce(p_conversion_type, 'purchase'),
       greatest(coalesce(p_value_minor, 0), 0), c.currency, v_req, v_win,
       coalesce(p_metadata, '{}'::jsonb))
    returning id into v_id;
  end if;

  perform public.advertising_notify(
    'vendor', c.vendor_id, c.id, 'conversion',
    'New advertising conversion',
    'Campaign ' || c.name || ' recorded a conversion.',
    jsonb_build_object('conversion_id', v_id, 'value_minor', greatest(coalesce(p_value_minor, 0), 0)));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Mark a paid campaign ready for approval/activation
-- ---------------------------------------------------------------------------

create or replace function public.advertising_mark_paid(
  p_campaign_id uuid,
  p_transaction_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  b record;
  v_tx uuid;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if c.payment_status <> 'paid' then
    raise exception 'payment_not_confirmed';
  end if;

  select * into b from public.advertising_campaign_budgets where campaign_id = c.id for update;

  -- A fixed placement is consumed in full on payment.
  if c.pricing_model = 'fixed' and b.id is not null and b.spent_minor < b.total_budget_minor then
    update public.advertising_campaign_budgets
    set spent_minor = total_budget_minor, updated_at = now()
    where id = b.id;

    insert into public.advertising_transactions
      (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
       provider_reference, idempotency_key, description, processed_at)
    values
      (c.id, c.vendor_id, 'fixed_charge', 'succeeded', b.total_budget_minor, c.currency,
       'internal', 'fixed:' || c.id::text, 'fixed:' || c.id::text,
       'Fixed placement charge', now())
    on conflict (idempotency_key) do nothing;

    select id into v_tx
    from public.advertising_transactions
    where idempotency_key = 'fixed:' || c.id::text;

    if v_tx is not null then
      insert into public.advertising_ledger_entries
        (transaction_id, campaign_id, vendor_id, entry_type, entry_key, direction,
         amount_minor, balance_after_minor, currency, reference)
      values
        (v_tx, c.id, c.vendor_id, 'fixed_placement_charge',
         'fixed:' || c.id::text, 'debit', -b.total_budget_minor, 0,
         c.currency, c.campaign_ref)
      on conflict (entry_key) do nothing;
    end if;

    perform public.advertising_bump_stats(c.id, current_date, 0, 0, 0, b.total_budget_minor);
  end if;

  if not exists (
    select 1 from public.advertising_notifications
    where campaign_id = c.id and kind = 'payment_verified'
  ) then
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'payment_verified',
      'Payment verified',
      'Payment for ' || c.name || ' has been verified.',
      jsonb_build_object('campaign_id', c.id, 'transaction_id', p_transaction_id));
  end if;

  if public.advertising_rule_bool('approval_required', true) and c.approved_at is null then
    update public.advertising_campaigns
    set status = 'pending_approval', submitted_at = coalesce(submitted_at, now()),
        eligibility_reason = 'awaiting_approval', updated_at = now()
    where id = c.id;

    if not exists (
      select 1 from public.advertising_notifications
      where campaign_id = c.id and kind = 'approval_needed'
    ) then
      perform public.advertising_notify(
        'admin', c.vendor_id, c.id, 'approval_needed',
        'Campaign approval needed',
        'Campaign ' || c.name || ' is paid and waiting for review.',
        jsonb_build_object('campaign_id', c.id, 'vendor_id', c.vendor_id));
    end if;
  else
    perform public.advertising_try_activate(c.id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Confirm a provider / manual payment (idempotent)
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

-- ---------------------------------------------------------------------------
-- 5. Submit for payment
-- ---------------------------------------------------------------------------

create or replace function public.advertising_submit_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  tx record;
  v_ref text;
  v_tx uuid;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not public.advertising_can_manage_vendor(c.vendor_id) then
    raise exception 'not_authorized';
  end if;
  if c.status not in ('draft', 'rejected') then
    raise exception 'campaign_not_submittable';
  end if;
  if not public.advertising_has_creative(c.id) then
    raise exception 'creative_incomplete';
  end if;

  v_ref := 'ADV-' || upper(substr(replace(c.id::text, '-', ''), 1, 12));

  select * into tx
  from public.advertising_transactions
  where campaign_id = c.id and kind = 'payment'
  order by created_at desc
  limit 1;

  if found then
    if tx.status = 'succeeded' then
      raise exception 'campaign_already_paid';
    end if;
    update public.advertising_transactions
    set status = 'pending',
        provider = 'manual',
        provider_reference = coalesce(provider_reference, v_ref),
        amount_minor = c.quote_amount_minor,
        processed_at = null
    where id = tx.id;
    v_tx := tx.id;
  else
    insert into public.advertising_transactions
      (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
       provider_reference, idempotency_key, description, created_by)
    values
      (c.id, c.vendor_id, 'payment', 'pending', c.quote_amount_minor, c.currency,
       'manual', v_ref, 'payment:' || c.id::text, 'Advertising payment', auth.uid())
    returning id into v_tx;
  end if;

  update public.advertising_campaigns
  set status = 'pending_payment',
      submitted_at = now(),
      payment_reference = v_ref,
      payment_provider = 'manual',
      rejection_reason = null,
      updated_at = now()
  where id = c.id;

  perform public.advertising_notify(
    'admin', c.vendor_id, c.id, 'payment_pending',
    'Advertising payment pending',
    'Campaign ' || c.name || ' was submitted. Verify payment reference ' || v_ref || '.',
    jsonb_build_object('campaign_id', c.id, 'payment_reference', v_ref,
                       'amount_minor', c.quote_amount_minor, 'vendor_id', c.vendor_id));
  perform public.advertising_notify(
    'vendor', c.vendor_id, c.id, 'submitted',
    'Campaign submitted',
    'Campaign ' || c.name || ' is waiting for payment verification.',
    jsonb_build_object('campaign_id', c.id, 'payment_reference', v_ref,
                       'amount_minor', c.quote_amount_minor));

  perform public.advertising_audit(
    'campaign_submitted', 'advertising_campaign', c.id,
    jsonb_build_object('payment_reference', v_ref, 'amount_minor', c.quote_amount_minor));

  return jsonb_build_object(
    'campaign_id', c.id,
    'payment_reference', v_ref,
    'amount_minor', c.quote_amount_minor,
    'transaction_id', v_tx);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Pay from promotional credit (immediate, backend-verified)
-- ---------------------------------------------------------------------------

create or replace function public.advertising_pay_with_credit(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  cr record;
  tx record;
  v_needed bigint;
  v_available bigint;
  v_take bigint;
  v_left bigint;
  v_tx uuid;
  v_ref text;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not public.advertising_can_manage_vendor(c.vendor_id) then
    raise exception 'not_authorized';
  end if;
  if c.payment_status = 'paid' then
    return jsonb_build_object('campaign_id', c.id, 'status', c.status, 'already_paid', true);
  end if;
  if c.status not in ('pending_payment', 'draft', 'rejected') then
    raise exception 'campaign_not_payable';
  end if;

  v_needed := c.quote_amount_minor;
  select coalesce(sum(remaining_minor), 0) into v_available
  from public.advertising_promotional_credits
  where vendor_id = c.vendor_id
    and status = 'available'
    and remaining_minor > 0
    and (expires_at is null or expires_at > now());

  if v_available < v_needed then
    raise exception 'insufficient_advertising_credit';
  end if;

  v_ref := 'CREDIT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

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
    set status = 'succeeded', provider = 'promotional_credit',
        provider_reference = v_ref, amount_minor = v_needed,
        processed_at = now()
    where id = tx.id;
    v_tx := tx.id;
  else
    insert into public.advertising_transactions
      (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
       provider_reference, idempotency_key, description, processed_at)
    values
      (c.id, c.vendor_id, 'payment', 'succeeded', v_needed, c.currency,
       'promotional_credit', v_ref, 'payment:' || c.id::text,
       'Advertising payment from promotional credit', now())
    returning id into v_tx;
  end if;

  insert into public.advertising_ledger_entries
    (transaction_id, campaign_id, vendor_id, entry_type, entry_key, direction,
     amount_minor, balance_after_minor, currency, reference)
  values
    (v_tx, c.id, c.vendor_id, 'credit_applied', 'creditpay:' || v_tx::text, 'credit',
     v_needed, c.total_budget_minor, c.currency, c.campaign_ref)
  on conflict (entry_key) do nothing;

  v_left := v_needed;
  for cr in
    select *
    from public.advertising_promotional_credits
    where vendor_id = c.vendor_id
      and status = 'available'
      and remaining_minor > 0
      and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last, created_at asc
    for update
  loop
    exit when v_left <= 0;
    v_take := least(cr.remaining_minor, v_left);
    update public.advertising_promotional_credits
    set remaining_minor = remaining_minor - v_take,
        status = case when remaining_minor - v_take = 0 then 'used' else status end,
        updated_at = now()
    where id = cr.id;
    v_left := v_left - v_take;
  end loop;

  update public.advertising_campaigns
  set payment_status = 'paid', payment_reference = v_ref,
      payment_provider = 'promotional_credit', updated_at = now()
  where id = c.id;

  perform public.advertising_mark_paid(c.id, v_tx);
  perform public.advertising_audit(
    'paid_with_credit', 'advertising_campaign', c.id,
    jsonb_build_object('amount_minor', v_needed, 'transaction_id', v_tx));

  select * into c from public.advertising_campaigns where id = p_campaign_id;
  return jsonb_build_object(
    'campaign_id', c.id,
    'status', c.status,
    'transaction_id', v_tx,
    'paid_minor', v_needed);
end;
$$;
