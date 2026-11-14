-- 0063_advertising_create_campaign_duration_fix.sql
-- 0057 applied the 6-72 hour slot window to every placement. Day-based
-- placements (featured business, sponsored card, search, etc.) still rent in
-- days, so only slot-based placements should use the hour window.

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

  -- Check slot availability
  if p.slot_count > 0 and p_slot_number is not null then
    if not public.advertising_slot_available(p_placement_key, p_slot_number, coalesce(p_starts_at, now()), p_ends_at) then
      raise exception 'slot_unavailable';
    end if;
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

  v_starts := coalesce(p_starts_at, now());
  v_ends := p_ends_at;
  if v_ends is null or v_ends <= v_starts then
    raise exception 'invalid_dates';
  end if;

  -- Slot rentals run 6-72 hours. Shared/day-based placements keep their
  -- configured day range.
  if p.slot_count > 0 then
    v_hours := extract(epoch from (v_ends - v_starts)) / 3600.0;
    if v_hours < 6 then
      raise exception 'duration_too_short';
    end if;
    if v_hours > 72 then
      raise exception 'duration_too_long';
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
    v_quote := v_slot_price;
    v_total := v_slot_price;
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
     pr.currency, trim(p_name), 'draft', v_quote, pr.fixed_price_minor,
     pr.cpc_rate_minor, pr.cpm_rate_minor, v_starts, v_ends, v_total, v_daily,
     false, null,
     jsonb_build_object(
       'pricing_id', pr.id, 'model', pr.pricing_model,
       'fixed_price_minor', pr.fixed_price_minor,
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
     nullif(trim(coalesce(p_creative->>'destination_id', '')), ''),
     nullif(trim(coalesce(p_creative->>'destination_url', '')), ''),
     coalesce(p_creative->>'sponsored_label', 'Sponsored'),
     coalesce(p_creative->>'sponsored_label_ar', 'إعلان مدفوع'),
     'draft');

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
