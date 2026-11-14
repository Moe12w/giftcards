-- 0057_advertising_slot_based.sql
-- Switches advertising from complex rotation to simple slot-based rental.
-- Each slot in a placement can be rented for 6-72 hours at a fixed price.
-- No auto-renew, no frequency caps, no auction, no fair rotation.

-- 1. Add slot_number to campaigns
alter table public.advertising_campaigns
  add column if not exists slot_number integer;

-- 2. Add per-slot pricing to placements (array of prices, index 0 = slot 1)
alter table public.advertising_placements
  add column if not exists slot_prices_minor bigint[] default '{}';

-- 3. Set slot counts for all placements (8 for hero carousel, keep others)
update public.advertising_placements set slot_count = 8 where key = 'homepage_hero_carousel';
update public.advertising_placements set slot_count = 3 where key in ('homepage_featured_business', 'homepage_featured_category', 'marketplace_category_position');
update public.advertising_placements set slot_count = 4 where key in ('homepage_featured_gift_card', 'marketplace_sponsored_business', 'marketplace_sponsored_card', 'discovery_placement', 'marketplace_sponsored_card');
update public.advertising_placements set slot_count = 3 where key in ('search_sponsored_result', 'trending_placement', 'bulk_deals_ranking');

-- 4. Set rotation_mode to 'fixed' for all placements
update public.advertising_placements set rotation_mode = 'fixed', auction_enabled = false;

-- 5. Set default slot prices (slot 1 = most expensive, descending)
-- Prices in minor units (QAR). Admin can override per placement.
update public.advertising_placements set slot_prices_minor = ARRAY[
  150000, 120000, 100000, 80000, 60000, 50000, 40000, 30000
]::bigint[] where key = 'homepage_hero_carousel';

update public.advertising_placements set slot_prices_minor = ARRAY[
  100000, 80000, 60000
]::bigint[] where slot_count = 3 and key != 'homepage_hero_carousel';

update public.advertising_placements set slot_prices_minor = ARRAY[
  75000, 60000, 50000, 40000
]::bigint[] where slot_count = 4;

-- 6. Remove auto_renew column default (keep column for backward compat but default false)
-- Already default false, no change needed.

-- 7. Create a function to check slot availability
create or replace function public.advertising_slot_available(
  p_placement_key text,
  p_slot_number integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if any active/paid campaign occupies this slot during the requested period
  return not exists (
    select 1 from public.advertising_campaigns c
    where c.placement_key = p_placement_key
      and c.slot_number = p_slot_number
      and c.status in ('active', 'scheduled', 'pending_approval', 'pending_payment')
      and c.ends_at > p_starts_at
      and c.starts_at < p_ends_at
  );
end;
$$;

grant execute on function public.advertising_slot_available(text, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.advertising_slot_available(text, integer, timestamptz, timestamptz) to service_role;

-- 8. Create a function to get next available time for a slot
create or replace function public.advertising_slot_next_available(
  p_placement_key text,
  p_slot_number integer,
  p_after timestamptz default now()
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends timestamptz;
begin
  select max(c.ends_at) into v_ends
  from public.advertising_campaigns c
  where c.placement_key = p_placement_key
    and c.slot_number = p_slot_number
    and c.status in ('active', 'scheduled', 'pending_approval', 'pending_payment')
    and c.ends_at > p_after;

  if v_ends is null then
    return p_after;
  end if;
  return v_ends;
end;
$$;

grant execute on function public.advertising_slot_next_available(text, integer, timestamptz) to authenticated;
grant execute on function public.advertising_slot_next_available(text, integer, timestamptz) to service_role;

-- 9. Update advertising_create_campaign to accept slot_number
-- Drop old function first
drop function if exists public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb);

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
  if p_slot_count > 0 and (p_slot_number is null or p_slot_number < 1 or p_slot_number > p_slot_count) then
    raise exception 'invalid_slot';
  end if;

  -- Check slot availability
  if p_slot_count > 0 and p_slot_number is not null then
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

  -- Duration check: 6-72 hours
  v_hours := extract(epoch from (v_ends - v_starts)) / 3600.0;
  if v_hours < 6 then
    raise exception 'duration_too_short';
  end if;
  if v_hours > 72 then
    raise exception 'duration_too_long';
  end if;

  -- For fixed pricing, use slot price if available
  if pr.pricing_model = 'fixed' then
    if p.slot_prices_minor is not null and array_length(p.slot_prices_minor, 1) >= p_slot_number then
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

-- 10. Update delivery function to return ads ordered by slot_number
-- (Simplified: no frequency cap, no dedupe, no auction - just slot order)
create or replace function public.advertising_deliver(p_placement_key text, p_limit integer DEFAULT 8, p_viewer_key text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text, p_context jsonb DEFAULT '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_placement record;
  v_items jsonb := '[]'::jsonb;
  r record;
  v_imp uuid;
  v_cost bigint;
begin
  perform public.advertising_run_maintenance();

  select * into v_placement
  from public.advertising_placements
  where key = p_placement_key and is_active;

  if not found then
    return jsonb_build_object('placement', p_placement_key, 'ads', '[]'::jsonb, 'empty', true);
  end if;

  for r in
    select
      c.id as campaign_id, c.vendor_id, c.pricing_model, c.cpc_rate_minor,
      c.cpm_rate_minor, c.priority, c.slot_number, c.name as campaign_name, c.ends_at,
      cr.id as creative_id, cr.headline, cr.headline_ar, cr.body, cr.body_ar,
      cr.image_url, cr.mobile_image_url, cr.image_alt, cr.image_alt_ar,
      cr.cta_label, cr.cta_label_ar, cr.destination_type, cr.destination_id,
      cr.destination_url, cr.sponsored_label, cr.sponsored_label_ar,
      v.name as vendor_name, v.name_ar as vendor_name_ar, v.logo_url as vendor_logo
    from public.advertising_campaigns c
    join lateral (
      select * from public.advertising_creatives cr
      where cr.campaign_id = c.id and cr.status = 'active'
      order by cr.sort_order asc, cr.created_at asc
      limit 1
    ) cr on true
    left join public.vendors v on v.id = c.vendor_id
    where c.placement_id = v_placement.id
      and c.status = 'active'
      and public.advertising_campaign_is_eligible(c.id)
    order by
      coalesce(c.slot_number, 999) asc,
      c.priority desc,
      c.last_served_at asc nulls first
    limit greatest(1, least(coalesce(p_limit, 8), 10))
  loop
    v_imp := gen_random_uuid();

    insert into public.advertising_impressions
      (id, campaign_id, creative_id, placement_id, vendor_id, viewer_key,
       session_id, request_id, metadata)
    values
      (v_imp, r.campaign_id, r.creative_id, v_placement.id, r.vendor_id,
       coalesce(nullif(p_viewer_key, ''), 'anon'),
       p_session_id, v_imp::text,
       jsonb_build_object('placement_key', p_placement_key,
                          'context', coalesce(p_context, '{}'::jsonb)));

    if r.pricing_model = 'cpm' then
      v_cost := greatest(0, round(coalesce(r.cpm_rate_minor, 0) / 1000.0)::bigint);
      if v_cost > 0 then
        v_cost := public.advertising_charge_campaign(
          r.campaign_id, v_cost, 'cpm_charge', 'imp:' || v_imp::text,
          jsonb_build_object('impression_id', v_imp));
        update public.advertising_impressions
        set cost_minor = v_cost, billed = v_cost > 0
        where id = v_imp;
      end if;
    end if;

    update public.advertising_campaigns
    set last_served_at = now()
    where id = r.campaign_id;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'campaign_id', r.campaign_id,
      'creative_id', r.creative_id,
      'impression_id', v_imp,
      'placement_key', p_placement_key,
      'campaign_name', r.campaign_name,
      'headline', r.headline,
      'headline_ar', r.headline_ar,
      'body', r.body,
      'body_ar', r.body_ar,
      'image_url', r.image_url,
      'mobile_image_url', r.mobile_image_url,
      'image_alt', r.image_alt,
      'image_alt_ar', r.image_alt_ar,
      'cta_label', r.cta_label,
      'cta_label_ar', r.cta_label_ar,
      'destination_type', r.destination_type,
      'destination_id', r.destination_id,
      'destination_url', r.destination_url,
      'sponsored_label', r.sponsored_label,
      'sponsored_label_ar', r.sponsored_label_ar,
      'vendor_id', r.vendor_id,
      'vendor_name', r.vendor_name,
      'vendor_name_ar', r.vendor_name_ar,
      'vendor_logo', r.vendor_logo,
      'pricing_model', r.pricing_model,
      'slot_number', r.slot_number,
      'ends_at', r.ends_at
    ));
  end loop;

  return jsonb_build_object(
    'placement', p_placement_key,
    'ads', v_items,
    'empty', jsonb_array_length(v_items) = 0
  );
end;
$function$;

grant execute on function public.advertising_deliver(text, integer, text, text, jsonb) to anon, authenticated;
grant execute on function public.advertising_deliver(text, integer, text, text, jsonb) to service_role;