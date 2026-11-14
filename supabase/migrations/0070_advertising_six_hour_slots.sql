-- 0070_advertising_six_hour_slots.sql
-- Advertising is now a single fixed price per six-hour slot booking, so CPC
-- and CPM are retired. The wizard no longer asks for a window: the campaign
-- takes the next free six-hour block in the chosen slot.

-- Only fixed pricing remains.
update public.advertising_placements
   set allowed_pricing_models = '{fixed}',
       updated_at = now()
 where allowed_pricing_models is distinct from '{fixed}'::text[];

update public.advertising_pricing
   set is_active = false,
       updated_at = now()
 where pricing_model <> 'fixed'
   and is_active;

create or replace function public.advertising_next_slot_window(
  p_placement_key text,
  p_slot_number integer
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_placement_id uuid;
  v_start timestamptz := now();
  v_end timestamptz;
  v_inventory_end timestamptz;
  v_campaign_end timestamptz;
  v_conflict timestamptz;
  v_guard integer := 0;
begin
  select id into v_placement_id
    from public.advertising_placements
   where key = p_placement_key and is_active;
  if v_placement_id is null then
    raise exception 'placement_unavailable';
  end if;

  loop
    v_guard := v_guard + 1;
    if v_guard > 1000 then
      raise exception 'no_slot_window';
    end if;

    v_end := v_start + interval '6 hours';

    select max(i.ends_at) into v_inventory_end
      from public.advertising_inventory i
     where i.placement_id = v_placement_id
       and i.slot_index = p_slot_number
       and i.status in ('reserved', 'active')
       and i.starts_at < v_end
       and i.ends_at > v_start;

    select max(c.ends_at) into v_campaign_end
      from public.advertising_campaigns c
     where c.placement_id = v_placement_id
       and c.slot_number = p_slot_number
       and c.status in ('active', 'scheduled', 'pending_approval', 'pending_payment', 'paused')
       and c.starts_at < v_end
       and c.ends_at > v_start;

    v_conflict := greatest(coalesce(v_inventory_end, v_start), coalesce(v_campaign_end, v_start));

    if v_conflict <= v_start then
      return query select v_start, v_end;
      return;
    end if;

    v_start := v_conflict;
  end loop;
end;
$$;

grant execute on function public.advertising_next_slot_window(text, integer) to authenticated;
grant execute on function public.advertising_next_slot_window(text, integer) to service_role;

-- 0069_advertising_slot_hourly_pricing.sql
-- Slot rentals were quoted at a single price for the whole 6-72 hour window,
-- so booking 6 hours and 72 hours cost exactly the same. A slot price is now
-- the price of a 24-hour block, charged pro-rata to the hour, and editing an
-- unpaid rental re-prices it. Paid rentals cannot change length.


create or replace function public.advertising_update_campaign(
  p_campaign_id uuid,
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_total_budget_minor bigint,
  p_daily_budget_minor bigint,
  p_auto_renew boolean,
  p_creative jsonb
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

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'invalid_dates';
  end if;

  select * into p from public.advertising_placements where id = c.placement_id;
  select * into pr from public.advertising_pricing where id = c.pricing_id;

  if p.slot_count > 0 then
    v_hours := extract(epoch from (p_ends_at - p_starts_at)) / 3600.0;
    if v_hours < 6 then
      raise exception 'duration_too_short';
    end if;
    if v_hours > 72 then
      raise exception 'duration_too_long';
    end if;

    if c.slot_number is not null and exists (
      select 1 from public.advertising_campaigns x
      where x.placement_key = c.placement_key
        and x.slot_number = c.slot_number
        and x.id <> c.id
        and x.status in ('active', 'scheduled', 'pending_approval', 'pending_payment')
        and x.ends_at > p_starts_at
        and x.starts_at < p_ends_at
    ) then
      raise exception 'slot_unavailable';
    end if;
  elsif pr.id is not null then
    v_days := ceil(extract(epoch from (p_ends_at - p_starts_at)) / 86400.0)::integer;
    if v_days < greatest(pr.min_duration_days, public.advertising_rule_int('min_duration_days', 1)) then
      raise exception 'duration_too_short';
    end if;
    if v_days > least(pr.max_duration_days, public.advertising_rule_int('max_duration_days', 365)) then
      raise exception 'duration_too_long';
    end if;
  end if;

  -- A slot booking is one fixed-price six-hour window. An unpaid booking
  -- follows the current slot price; a paid one keeps what it paid and cannot
  -- change its window.
  if c.pricing_model = 'fixed' and p.slot_count > 0 and c.slot_number is not null then
    if c.payment_status = 'paid' then
      if p_starts_at <> c.starts_at or p_ends_at <> c.ends_at then
        raise exception 'duration_locked_after_payment';
      end if;
      v_quote := c.quote_amount_minor;
    else
      v_slot_price := coalesce(p.slot_prices_minor[c.slot_number], pr.fixed_price_minor, c.quote_amount_minor);
      v_quote := v_slot_price;
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
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      quote_amount_minor = coalesce(v_quote, quote_amount_minor),
      fixed_price_minor = coalesce(v_quote, fixed_price_minor),
      total_budget_minor = coalesce(p_total_budget_minor, total_budget_minor),
      daily_budget_minor = coalesce(p_daily_budget_minor, daily_budget_minor),
      auto_renew = false,
      auto_renew_authorized_at = null,
      updated_at = now()
  where id = c.id;

  update public.advertising_campaign_budgets
  set total_budget_minor = coalesce(p_total_budget_minor, total_budget_minor),
      daily_budget_minor = coalesce(p_daily_budget_minor, daily_budget_minor),
      updated_at = now()
  where campaign_id = c.id;

  -- Keep the slot reservation in step with the edited window.
  if p.slot_count > 0 and c.slot_number is not null then
    update public.advertising_inventory
    set starts_at = p_starts_at,
        ends_at = p_ends_at,
        updated_at = now()
    where campaign_id = c.id;
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
    jsonb_build_object('vendor_id', c.vendor_id));
end;
$$;

grant execute on function public.advertising_update_campaign(uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb) to authenticated;
grant execute on function public.advertising_update_campaign(uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb) to service_role;

-- Two bugs in `advertising_create_campaign` blocked every real wizard booking:
--
-- 1. It inserted the creative destination as text into the uuid column
--    `advertising_creatives.destination_id`. Postgres has no implicit
--    text-to-uuid assignment, so any business, gift-card or category
--    destination failed with 42804.
-- 2. It inserted the creative with status `draft`, but the column only allows
--    active/paused/rejected and `advertising_has_creative` looks for `active`.
--    Campaign submission therefore also failed.
--
-- Both are fixed here; the rest of the function is unchanged from 0063.

create or replace function public.advertising_create_campaign(
  p_vendor_id uuid,
  p_placement_key text,
  p_pricing_id uuid,
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_total_budget_minor bigint,
  p_daily_budget_minor bigint,
  p_slot_number integer,
  p_creative jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  p record;
  pr record;
  v_id uuid;
  v_quote bigint;
  v_total bigint;
  v_daily bigint;
  v_days integer;
  v_starts timestamptz;
  v_ends timestamptz;
  v_hours numeric;
  v_slot_price bigint;
begin
  if not public.advertising_can_manage_vendor(p_vendor_id) then
    raise exception 'not_authorized';
  end if;

  select * into v from public.vendors where id = p_vendor_id;
  if not found or v.status <> 'approved' then
    raise exception 'vendor_not_approved';
  end if;
  if not v.advertising_enabled then
    raise exception 'advertising_suspended';
  end if;

  select * into p from public.advertising_placements
  where key = p_placement_key and is_active;
  if not found then
    raise exception 'placement_unavailable';
  end if;

  -- Validate slot number
  if p.slot_count > 0 and (p_slot_number is null or p_slot_number < 1 or p_slot_number > p.slot_count) then
    raise exception 'invalid_slot';
  end if;

  select * into pr from public.advertising_pricing
  where id = p_pricing_id and placement_id = p.id and is_active;
  if not found then
    raise exception 'pricing_unavailable';
  end if;

  if not (pr.pricing_model::text = any(coalesce(p.allowed_pricing_models, '{fixed,cpc,cpm}'::text[]))) then
    raise exception 'pricing_model_not_allowed';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  -- Bookings no longer choose a window: a slot rental takes the next free
  -- six-hour block in that slot.
  if p.slot_count > 0 then
    select w.starts_at, w.ends_at into v_starts, v_ends
    from public.advertising_next_slot_window(p_placement_key, p_slot_number) w;
  else
    v_starts := coalesce(p_starts_at, now());
    v_ends := p_ends_at;
  end if;
  if v_ends is null or v_ends <= v_starts then
    raise exception 'invalid_dates';
  end if;

  if p.slot_count > 0 and p_slot_number is not null then
    if not public.advertising_slot_available(p_placement_key, p_slot_number, v_starts, v_ends) then
      raise exception 'slot_unavailable';
    end if;
  end if;

  -- Slot rentals run 6-72 hours. Shared/day-based placements keep their
  -- configured day range.
  if p.slot_count > 0 then
    v_hours := extract(epoch from (v_ends - v_starts)) / 3600.0;
    if round(v_hours) <> 6 then
      raise exception 'duration_must_be_six_hours';
    end if;
  else
    v_days := ceil(extract(epoch from (v_ends - v_starts)) / 86400.0)::integer;
    if v_days < greatest(pr.min_duration_days, public.advertising_rule_int('min_duration_days', 1)) then
      raise exception 'duration_too_short';
    end if;
    if v_days > least(pr.max_duration_days, public.advertising_rule_int('max_duration_days', 365)) then
      raise exception 'duration_too_long';
    end if;
  end if;

  -- For fixed pricing, use the numbered slot price when the placement sells
  -- slots; otherwise use the placement's fixed price.
  if pr.pricing_model = 'fixed' then
    if p.slot_count > 0
      and p.slot_prices_minor is not null
      and array_length(p.slot_prices_minor, 1) >= p_slot_number then
      v_slot_price := p.slot_prices_minor[p_slot_number];
    else
      v_slot_price := pr.fixed_price_minor;
    end if;
    -- One fixed price per six-hour booking, set by the platform per slot.
    v_quote := v_slot_price;
    v_total := v_quote;
    v_daily := 0;
  else
    v_total := coalesce(p_total_budget_minor, 0);
    if v_total < pr.min_budget_minor then
      raise exception 'budget_below_minimum';
    end if;
    if pr.max_budget_minor is not null and v_total > pr.max_budget_minor then
      raise exception 'budget_above_maximum';
    end if;
    v_daily := coalesce(p_daily_budget_minor, 0);
    if v_daily < 0 then
      raise exception 'invalid_daily_budget';
    end if;
    if v_daily > 0 and v_daily > v_total then
      raise exception 'daily_budget_above_total';
    end if;
    v_quote := v_total;
  end if;

  perform public.advertising_validate_creative(p_creative, p.format);

  insert into public.advertising_campaigns
    (vendor_id, created_by, placement_id, placement_key, pricing_id, pricing_model,
     currency, name, status, quote_amount_minor, fixed_price_minor, cpc_rate_minor,
     cpm_rate_minor, starts_at, ends_at, total_budget_minor, daily_budget_minor,
     auto_renew, auto_renew_authorized_at, pricing_snapshot, slot_number)
  values
    (p_vendor_id, auth.uid(), p.id, p.key, pr.id, pr.pricing_model,
     pr.currency, trim(p_name), 'draft', v_quote,
     case when pr.pricing_model = 'fixed' then v_quote else pr.fixed_price_minor end,
     pr.cpc_rate_minor, pr.cpm_rate_minor, v_starts, v_ends, v_total, v_daily,
     false, null,
     jsonb_build_object(
       'pricing_id', pr.id, 'model', pr.pricing_model,
       'fixed_price_minor', case when pr.pricing_model = 'fixed' then v_quote else pr.fixed_price_minor end,
       'cpc_rate_minor', pr.cpc_rate_minor,
       'cpm_rate_minor', pr.cpm_rate_minor,
       'currency', pr.currency, 'version', pr.version,
       'captured_at', now(), 'slot_number', p_slot_number),
     p_slot_number)
  returning id into v_id;

  insert into public.advertising_creatives
    (campaign_id, type, headline, headline_ar, body, body_ar, image_url, mobile_image_url,
     image_alt, image_alt_ar, cta_label, cta_label_ar, destination_type, destination_id,
     destination_url, sponsored_label, sponsored_label_ar, status)
  values
    (v_id, coalesce(p_creative->>'type', 'image'),
     coalesce(p_creative->>'headline', ''),
     nullif(trim(coalesce(p_creative->>'headline_ar', '')), ''),
     nullif(trim(coalesce(p_creative->>'body', '')), ''),
     nullif(trim(coalesce(p_creative->>'body_ar', '')), ''),
     nullif(trim(coalesce(p_creative->>'image_url', '')), ''),
     nullif(trim(coalesce(p_creative->>'mobile_image_url', '')), ''),
     nullif(trim(coalesce(p_creative->>'image_alt', '')), ''),
     nullif(trim(coalesce(p_creative->>'image_alt_ar', '')), ''),
     nullif(trim(coalesce(p_creative->>'cta_label', '')), ''),
     nullif(trim(coalesce(p_creative->>'cta_label_ar', '')), ''),
     coalesce(p_creative->>'destination_type', 'business'),
     nullif(trim(coalesce(p_creative->>'destination_id', '')), '')::uuid,
     nullif(trim(coalesce(p_creative->>'destination_url', '')), ''),
     coalesce(p_creative->>'sponsored_label', 'Sponsored'),
     coalesce(p_creative->>'sponsored_label_ar', 'إعلان مدفوع'),
     'active');

  insert into public.advertising_campaign_budgets
    (campaign_id, currency, total_budget_minor, daily_budget_minor, spent_minor, daily_spent_minor)
  values
    (v_id, pr.currency, v_total, v_daily, 0, 0);

  -- Create inventory reservation for the slot
  if p.slot_count > 0 and p_slot_number is not null then
    insert into public.advertising_inventory
      (placement_id, campaign_id, slot_index, status, starts_at, ends_at)
    values
      (p.id, v_id, p_slot_number, 'reserved', v_starts, v_ends);
  end if;

  return v_id;
end;
$$;

grant execute on function public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, integer, jsonb) to authenticated;
grant execute on function public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, integer, jsonb) to service_role;
