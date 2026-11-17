-- 0111_advertising_reschedule_drafts.sql
-- Two problems with abandoned advertising drafts:
--
-- 1. The wizard re-submitted the draft's original six-hour window, so an
--    advertiser editing a draft could not move it to a free slot in time.
-- 2. Nothing checked the clock before payment, so a draft whose booking time
--    had already passed could still be submitted or paid for.
--
-- Editing an unpaid booking now takes the chosen slot and books the next free
-- window in it (exactly like creating a campaign does), and both payment
-- paths refuse a window that has already ended.

-- ---------------------------------------------------------------------------
-- 1. Editing an unpaid booking re-books it into a live slot
-- ---------------------------------------------------------------------------

drop function if exists public.advertising_update_campaign(
  uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb
);

create or replace function public.advertising_update_campaign(
  p_campaign_id uuid,
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_total_budget_minor bigint,
  p_daily_budget_minor bigint,
  p_auto_renew boolean,
  p_creative jsonb,
  p_slot_number integer default null,
  p_periods integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  p record;
  pr record;
  v_days integer;
  v_hours numeric;
  v_slot_price bigint;
  v_quote bigint;
  v_reset_approval boolean := false;
  v_slot integer;
  v_periods integer;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not (public.advertising_can_manage_vendor(c.vendor_id) or public.is_admin()) then
    raise exception 'not_authorized';
  end if;
  if c.status not in ('draft', 'pending_payment', 'pending_approval', 'rejected', 'scheduled', 'paused') then
    raise exception 'campaign_not_editable';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  select * into p from public.advertising_placements where id = c.placement_id;
  select * into pr from public.advertising_pricing where id = c.pricing_id;

  if coalesce(p.slot_count, 0) > 0 then
    if c.payment_status = 'paid' then
      -- A paid booking keeps its slot, its window and the price it paid.
      if p_slot_number is not null and c.slot_number is not null and p_slot_number <> c.slot_number then
        raise exception 'slot_locked_after_payment';
      end if;
      if (p_starts_at is not null and p_starts_at <> c.starts_at)
         or (p_ends_at is not null and p_ends_at <> c.ends_at) then
        raise exception 'duration_locked_after_payment';
      end if;
      v_slot := c.slot_number;
      v_starts := c.starts_at;
      v_ends := c.ends_at;
      v_quote := c.quote_amount_minor;
    else
      -- An unpaid booking is placed in the next free window of the chosen
      -- slot, so a draft left past its time is re-booked instead of being
      -- charged for a window that is gone.
      v_slot := coalesce(p_slot_number, c.slot_number, 1);
      if v_slot < 1 or v_slot > p.slot_count then
        raise exception 'invalid_slot';
      end if;

      if p_periods is not null then
        v_periods := p_periods;
      elsif p_starts_at is not null and p_ends_at is not null and p_ends_at > p_starts_at then
        v_periods := greatest(
          round(extract(epoch from (p_ends_at - p_starts_at)) / 21600.0)::integer,
          1
        );
      else
        v_periods := greatest(
          round(extract(epoch from (c.ends_at - c.starts_at)) / 21600.0)::integer,
          1
        );
      end if;
      if v_periods < 1 or v_periods > 120 then
        raise exception 'invalid_periods';
      end if;

      select w.starts_at, w.ends_at into v_starts, v_ends
      from public.advertising_next_slot_window(c.placement_key, v_slot, v_periods) w;
      if v_starts is null or v_ends is null or v_ends <= v_starts then
        raise exception 'no_slot_window';
      end if;
      if not public.advertising_slot_available(c.placement_key, v_slot, v_starts, v_ends) then
        raise exception 'slot_unavailable';
      end if;

      v_slot_price := coalesce(p.slot_prices_minor[v_slot], pr.fixed_price_minor, c.quote_amount_minor);
      v_quote := v_slot_price * v_periods;
    end if;
  else
    v_starts := coalesce(p_starts_at, c.starts_at);
    v_ends := coalesce(p_ends_at, c.ends_at);
    if v_starts is null or v_ends is null or v_ends <= v_starts then
      raise exception 'invalid_dates';
    end if;
    if c.payment_status <> 'paid' and v_ends <= now() then
      raise exception 'booking_window_expired';
    end if;

    if pr.id is not null then
      v_days := ceil(extract(epoch from (v_ends - v_starts)) / 86400.0)::integer;
      if v_days < greatest(pr.min_duration_days, public.advertising_rule_int('min_duration_days', 1)) then
        raise exception 'duration_too_short';
      end if;
      if v_days > least(pr.max_duration_days, public.advertising_rule_int('max_duration_days', 365)) then
        raise exception 'duration_too_long';
      end if;
    end if;

    if c.pricing_model = 'fixed' and c.payment_status = 'paid' then
      v_quote := c.quote_amount_minor;
    end if;
  end if;

  if c.payment_status = 'paid' and (
    coalesce(p_total_budget_minor, c.total_budget_minor) <> c.total_budget_minor
    or coalesce(p_daily_budget_minor, c.daily_budget_minor) <> c.daily_budget_minor
  ) then
    raise exception 'budget_locked_after_payment';
  end if;

  if c.pricing_model <> 'fixed' and c.payment_status <> 'paid' then
    if coalesce(p_total_budget_minor, c.total_budget_minor) < coalesce(pr.min_budget_minor, 0) then
      raise exception 'budget_below_minimum';
    end if;
    if pr.max_budget_minor is not null
       and coalesce(p_total_budget_minor, c.total_budget_minor) > pr.max_budget_minor then
      raise exception 'budget_above_maximum';
    end if;
    if coalesce(p_daily_budget_minor, c.daily_budget_minor) > 0
       and coalesce(p_daily_budget_minor, c.daily_budget_minor) > coalesce(p_total_budget_minor, c.total_budget_minor) then
      raise exception 'daily_budget_above_total';
    end if;
  end if;

  if p_creative is not null then
    perform public.advertising_validate_creative(p_creative, p.format);
    v_reset_approval := true;
  end if;

  update public.advertising_campaigns
  set name = trim(p_name),
      starts_at = v_starts,
      ends_at = v_ends,
      slot_number = case when coalesce(p.slot_count, 0) > 0 then v_slot else slot_number end,
      quote_amount_minor = coalesce(v_quote, quote_amount_minor),
      fixed_price_minor = coalesce(v_quote, fixed_price_minor),
      total_budget_minor = case
        when coalesce(p.slot_count, 0) > 0 then coalesce(v_quote, total_budget_minor)
        else coalesce(p_total_budget_minor, total_budget_minor)
      end,
      daily_budget_minor = coalesce(p_daily_budget_minor, daily_budget_minor),
      auto_renew = false,
      auto_renew_authorized_at = null,
      updated_at = now()
  where id = c.id;

  update public.advertising_campaign_budgets
  set total_budget_minor = case
        when coalesce(p.slot_count, 0) > 0 then coalesce(v_quote, total_budget_minor)
        else coalesce(p_total_budget_minor, total_budget_minor)
      end,
      daily_budget_minor = coalesce(p_daily_budget_minor, daily_budget_minor),
      updated_at = now()
  where campaign_id = c.id;

  -- Drop any reservation held for the old slot or window and keep the one for
  -- the newly chosen window in step with it.
  if coalesce(p.slot_count, 0) > 0 then
    update public.advertising_inventory
    set status = 'released',
        updated_at = now()
    where campaign_id = c.id
      and status = 'reserved'
      and (slot_index <> v_slot or starts_at <> v_starts or ends_at <> v_ends);

    update public.advertising_inventory
    set starts_at = v_starts,
        ends_at = v_ends,
        updated_at = now()
    where campaign_id = c.id
      and status = 'reserved'
      and slot_index = v_slot;
  end if;

  if p_creative is not null then
    update public.advertising_creatives
    set type = coalesce(nullif(p_creative->>'type', ''), type),
        headline = trim(p_creative->>'headline'),
        headline_ar = nullif(p_creative->>'headline_ar', ''),
        body = nullif(p_creative->>'body', ''),
        body_ar = nullif(p_creative->>'body_ar', ''),
        image_url = nullif(p_creative->>'image_url', ''),
        mobile_image_url = nullif(p_creative->>'mobile_image_url', ''),
        image_alt = nullif(p_creative->>'image_alt', ''),
        image_alt_ar = nullif(p_creative->>'image_alt_ar', ''),
        cta_label = nullif(p_creative->>'cta_label', ''),
        cta_label_ar = nullif(p_creative->>'cta_label_ar', ''),
        destination_type = coalesce(nullif(p_creative->>'destination_type', ''), 'url'),
        destination_id = nullif(p_creative->>'destination_id', '')::uuid,
        destination_url = nullif(p_creative->>'destination_url', ''),
        sponsored_label = coalesce(nullif(p_creative->>'sponsored_label', ''), 'Sponsored'),
        sponsored_label_ar = coalesce(nullif(p_creative->>'sponsored_label_ar', ''), 'إعلان مدفوع'),
        updated_at = now()
    where campaign_id = c.id and sort_order = 0;

    if not found then
      insert into public.advertising_creatives
        (campaign_id, type, headline, headline_ar, body, body_ar, image_url,
         mobile_image_url, image_alt, image_alt_ar, cta_label, cta_label_ar,
         destination_type, destination_id, destination_url, sponsored_label,
         sponsored_label_ar, sort_order)
      values
        (c.id, coalesce(nullif(p_creative->>'type', ''), 'image'),
         trim(p_creative->>'headline'), nullif(p_creative->>'headline_ar', ''),
         nullif(p_creative->>'body', ''), nullif(p_creative->>'body_ar', ''),
         nullif(p_creative->>'image_url', ''), nullif(p_creative->>'mobile_image_url', ''),
         nullif(p_creative->>'image_alt', ''), nullif(p_creative->>'image_alt_ar', ''),
         nullif(p_creative->>'cta_label', ''), nullif(p_creative->>'cta_label_ar', ''),
         coalesce(nullif(p_creative->>'destination_type', ''), 'url'),
         nullif(p_creative->>'destination_id', '')::uuid,
         nullif(p_creative->>'destination_url', ''),
         coalesce(nullif(p_creative->>'sponsored_label', ''), 'Sponsored'),
         coalesce(nullif(p_creative->>'sponsored_label_ar', ''), 'إعلان مدفوع'),
         0);
    end if;
  end if;

  -- A material change to a paid campaign needs a fresh approval.
  if v_reset_approval and c.payment_status = 'paid' and c.approved_at is not null then
    update public.advertising_campaigns
    set approved_at = null, approved_by = null,
        status = 'pending_approval', eligibility_reason = 'awaiting_reapproval',
        updated_at = now()
    where id = c.id;
    perform public.advertising_release_inventory(c.id);
    perform public.advertising_notify(
      'admin', c.vendor_id, c.id, 'approval_needed',
      'Campaign changed after approval',
      'Campaign ' || c.name || ' was edited and needs another review.',
      jsonb_build_object('campaign_id', c.id));
  elsif c.status = 'scheduled' then
    perform public.advertising_try_activate(c.id);
  end if;

  perform public.advertising_audit(
    'campaign_updated', 'advertising_campaign', c.id,
    jsonb_build_object('vendor_id', c.vendor_id, 'slot_number', v_slot));
end;
$$;

grant execute on function public.advertising_update_campaign(
  uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb, integer, integer
) to authenticated;
grant execute on function public.advertising_update_campaign(
  uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb, integer, integer
) to service_role;

-- ---------------------------------------------------------------------------
-- 2. A closed booking window cannot be submitted for payment
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
  -- The booked time is gone: the advertiser must pick an available slot first.
  if c.ends_at <= now() then
    raise exception 'booking_window_expired';
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
-- 3. ... and cannot be paid from promotional credit
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
  -- Never charge credit for a window that has already passed.
  if c.ends_at <= now() then
    raise exception 'booking_window_expired';
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
