-- 0046_advertising_delivery.sql
-- Activation, lifecycle maintenance, delivery and tracking triggers.

-- ---------------------------------------------------------------------------
-- 1. Delivery eligibility
-- ---------------------------------------------------------------------------

create or replace function public.advertising_campaign_is_eligible(p_campaign_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  p record;
  v record;
  b record;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id;
  if not found or c.status <> 'active' then
    return false;
  end if;
  if c.payment_status <> 'paid' then
    return false;
  end if;
  if public.advertising_rule_bool('approval_required', true) and c.approved_at is null then
    return false;
  end if;
  if not public.advertising_has_creative(c.id) then
    return false;
  end if;

  select * into p from public.advertising_placements where id = c.placement_id;
  if not found or not p.is_active then
    return false;
  end if;

  if p.slot_count > 0 and not exists (
    select 1 from public.advertising_inventory
    where campaign_id = c.id and status = 'occupied'
  ) then
    return false;
  end if;

  if c.vendor_id is not null then
    select * into v from public.vendors where id = c.vendor_id;
    if not found or v.status <> 'approved' or not v.advertising_enabled then
      return false;
    end if;
  end if;

  if now() < c.starts_at or now() >= c.ends_at then
    return false;
  end if;

  if c.pricing_model <> 'fixed' then
    select * into b from public.advertising_campaign_budgets where campaign_id = c.id;
    if not found then
      return false;
    end if;
    if b.total_budget_minor > 0 and b.spent_minor >= b.total_budget_minor then
      return false;
    end if;
    if b.daily_budget_minor > 0
       and b.daily_spent_date = current_date
       and b.daily_spent_minor >= b.daily_budget_minor then
      return false;
    end if;
  end if;

  return public.advertising_capacity_available(c.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Activation
-- ---------------------------------------------------------------------------

create or replace function public.advertising_try_activate(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  p record;
  v record;
  b record;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    return 'missing';
  end if;

  if c.status in ('cancelled', 'rejected', 'refunded', 'completed', 'budget_exhausted') then
    return c.status::text;
  end if;
  if c.status = 'active' then
    return 'active';
  end if;

  if c.ends_at <= now() then
    update public.advertising_campaigns
    set status = 'completed', completed_at = coalesce(completed_at, now()),
        last_evaluated_at = now(), updated_at = now()
    where id = c.id;
    perform public.advertising_release_inventory(c.id);
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'completed',
      'Campaign completed',
      'Campaign ' || c.name || ' reached its end date.',
      jsonb_build_object('campaign_id', c.id));
    return 'completed';
  end if;

  if c.payment_status <> 'paid' then
    return c.status::text;
  end if;

  if public.advertising_rule_bool('approval_required', true) and c.approved_at is null then
    update public.advertising_campaigns
    set status = 'pending_approval', eligibility_reason = 'awaiting_approval',
        last_evaluated_at = now(), updated_at = now()
    where id = c.id;
    return 'pending_approval';
  end if;

  if c.vendor_id is not null then
    select * into v from public.vendors where id = c.vendor_id;
    if not found or v.status <> 'approved' or not v.advertising_enabled then
      update public.advertising_campaigns
      set status = 'paused', paused_at = coalesce(paused_at, now()),
          pause_reason = 'advertiser_suspended', last_evaluated_at = now(), updated_at = now()
      where id = c.id;
      perform public.advertising_release_inventory(c.id);
      return 'paused';
    end if;
  end if;

  if now() < c.starts_at then
    update public.advertising_campaigns
    set status = 'scheduled', eligibility_reason = 'scheduled',
        last_evaluated_at = now(), updated_at = now()
    where id = c.id;
    return 'scheduled';
  end if;

  if not public.advertising_has_creative(c.id) then
    update public.advertising_campaigns
    set status = 'scheduled', eligibility_reason = 'creative_incomplete',
        last_evaluated_at = now(), updated_at = now()
    where id = c.id;
    return 'scheduled';
  end if;

  select * into p from public.advertising_placements where id = c.placement_id;
  if not found or not p.is_active then
    update public.advertising_campaigns
    set status = 'scheduled', eligibility_reason = 'placement_paused',
        last_evaluated_at = now(), updated_at = now()
    where id = c.id;
    return 'scheduled';
  end if;

  if c.pricing_model <> 'fixed' then
    select * into b from public.advertising_campaign_budgets where campaign_id = c.id;
    if not found or (b.total_budget_minor > 0 and b.spent_minor >= b.total_budget_minor) then
      update public.advertising_campaigns
      set status = 'budget_exhausted', completed_at = coalesce(completed_at, now()),
          pause_reason = 'budget_exhausted', last_evaluated_at = now(), updated_at = now()
      where id = c.id;
      perform public.advertising_release_inventory(c.id);
      return 'budget_exhausted';
    end if;
    if b.daily_budget_minor > 0
       and b.daily_spent_date = current_date
       and b.daily_spent_minor >= b.daily_budget_minor then
      update public.advertising_campaigns
      set status = 'paused', paused_at = now(), pause_reason = 'daily_budget',
          auto_resume_at = (current_date + 1)::timestamptz,
          last_evaluated_at = now(), updated_at = now()
      where id = c.id;
      perform public.advertising_release_inventory(c.id);
      return 'paused';
    end if;
  end if;

  -- Serialise capacity checks per placement so two campaigns cannot take the
  -- same fixed slot at the same time.
  select * into p from public.advertising_placements where id = c.placement_id for update;

  if not public.advertising_capacity_available(c.id) then
    update public.advertising_campaigns
    set status = 'scheduled', eligibility_reason = 'capacity_full',
        last_evaluated_at = now(), updated_at = now()
    where id = c.id;
    if not exists (
      select 1 from public.advertising_notifications
      where campaign_id = c.id and kind = 'placement_capacity'
        and created_at > now() - interval '6 hours'
    ) then
      perform public.advertising_notify(
        'admin', c.vendor_id, c.id, 'placement_capacity',
        'Placement at capacity',
        'Campaign ' || c.name || ' is paid but waiting for a free slot in ' || p.name || '.',
        jsonb_build_object('campaign_id', c.id, 'placement_id', p.id));
    end if;
    return 'scheduled';
  end if;

  update public.advertising_campaigns
  set status = 'active',
      activated_at = coalesce(activated_at, now()),
      paused_at = null,
      pause_reason = null,
      auto_resume_at = null,
      eligibility_reason = null,
      last_evaluated_at = now(),
      updated_at = now()
  where id = c.id;

  perform public.advertising_assign_inventory(c.id);
  perform public.advertising_notify(
    'vendor', c.vendor_id, c.id, 'active',
    'Campaign is live',
    'Campaign ' || c.name || ' is now delivering.',
    jsonb_build_object('campaign_id', c.id, 'placement_id', c.placement_id));

  return 'active';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Lifecycle maintenance
-- ---------------------------------------------------------------------------

create or replace function public.advertising_run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer := 0;
  v_completed integer := 0;
  v_resumed integer := 0;
  v_renewed integer := 0;
  v_suspended integer := 0;
  r record;
  v_new uuid;
  v_duration interval;
  v_start timestamptz;
  v_ref text;
begin
  -- Unpaid campaigns expire.
  with expired as (
    update public.advertising_campaigns
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where status = 'pending_payment'
      and submitted_at is not null
      and submitted_at < now() - make_interval(hours => public.advertising_rule_int('payment_expiry_hours', 48))
    returning id, vendor_id, name
  )
  insert into public.advertising_notifications
    (audience, vendor_id, user_id, campaign_id, kind, title, body, payload)
  select 'vendor', e.vendor_id, vm.user_id, e.id, 'payment_expired',
         'Payment window expired',
         'Campaign ' || e.name || ' was cancelled because payment was not verified in time.',
         jsonb_build_object('campaign_id', e.id)
  from expired e
  join public.vendor_members vm on vm.vendor_id = e.vendor_id and vm.active
  where vm.role in ('owner', 'manager');
  get diagnostics v_expired = row_count;

  -- Suspended advertisers stop delivering without touching the vendor account.
  with suspended as (
    update public.advertising_campaigns c
    set status = 'paused', paused_at = now(), pause_reason = 'advertiser_suspended',
        auto_resume_at = null, updated_at = now()
    where c.status in ('active', 'scheduled')
      and c.vendor_id in (select id from public.vendors where advertising_enabled = false)
    returning c.id, c.vendor_id, c.name
  )
  insert into public.advertising_notifications
    (audience, vendor_id, user_id, campaign_id, kind, title, body, payload)
  select 'vendor', s.vendor_id, vm.user_id, s.id, 'advertiser_suspended',
         'Advertising paused',
         'Campaign ' || s.name || ' was paused because advertising access is suspended.',
         jsonb_build_object('campaign_id', s.id)
  from suspended s
  join public.vendor_members vm on vm.vendor_id = s.vendor_id and vm.active
  where vm.role in ('owner', 'manager');
  get diagnostics v_suspended = row_count;

  -- End dates complete campaigns.
  with ended as (
    update public.advertising_campaigns
    set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    where status in ('active', 'scheduled', 'paused', 'pending_approval')
      and ends_at <= now()
    returning id, vendor_id, name
  )
  insert into public.advertising_notifications
    (audience, vendor_id, user_id, campaign_id, kind, title, body, payload)
  select 'vendor', e.vendor_id, vm.user_id, e.id, 'completed',
         'Campaign completed',
         'Campaign ' || e.name || ' reached its end date.',
         jsonb_build_object('campaign_id', e.id)
  from ended e
  join public.vendor_members vm on vm.vendor_id = e.vendor_id and vm.active
  where vm.role in ('owner', 'manager');
  get diagnostics v_completed = row_count;

  -- Total budget exhaustion.
  update public.advertising_campaigns c
  set status = 'budget_exhausted', completed_at = coalesce(c.completed_at, now()),
      pause_reason = 'budget_exhausted', updated_at = now()
  where c.status in ('active', 'paused')
    and c.pricing_model <> 'fixed'
    and exists (
      select 1 from public.advertising_campaign_budgets b
      where b.campaign_id = c.id
        and b.total_budget_minor > 0
        and b.spent_minor >= b.total_budget_minor
    );

  -- Release slots for anything terminal.
  update public.advertising_inventory inv
  set status = 'released', updated_at = now()
  from public.advertising_campaigns c
  where inv.campaign_id = c.id
    and inv.status in ('occupied', 'reserved')
    and c.status in ('completed', 'cancelled', 'rejected', 'refunded', 'budget_exhausted', 'paused');

  -- Daily-budget pauses resume the next day.
  for r in
    select id from public.advertising_campaigns
    where status = 'paused'
      and pause_reason = 'daily_budget'
      and auto_resume_at is not null
      and auto_resume_at <= now()
  loop
    update public.advertising_campaigns
    set status = 'scheduled', pause_reason = null, auto_resume_at = null, updated_at = now()
    where id = r.id;
    perform public.advertising_try_activate(r.id);
    v_resumed := v_resumed + 1;
  end loop;

  -- Start scheduled campaigns.
  for r in
    select id from public.advertising_campaigns
    where status = 'scheduled'
      and starts_at <= now()
      and ends_at > now()
  loop
    perform public.advertising_try_activate(r.id);
  end loop;

  -- Optional auto-renew: creates a new unpaid renewal for explicitly
  -- authorised campaigns. Payment still has to be verified.
  for r in
    select * from public.advertising_campaigns c
    where c.status = 'completed'
      and c.auto_renew
      and c.auto_renew_authorized_at is not null
      and c.auto_renewed_at is null
      and c.renewal_count < public.advertising_rule_int('max_renewals', 12)
      and not exists (
        select 1 from public.advertising_campaigns x
        where x.renewed_from_campaign_id = c.id
      )
  loop
    v_duration := r.ends_at - r.starts_at;
    v_start := greatest(now(), r.ends_at);
    v_new := gen_random_uuid();
    v_ref := 'ADV-RENEW-' || upper(substr(replace(v_new::text, '-', ''), 1, 12));

    insert into public.advertising_campaigns
      (id, vendor_id, created_by, placement_id, placement_key, pricing_id, pricing_model,
       currency, name, status, payment_status, payment_reference, payment_provider,
       quote_amount_minor, fixed_price_minor, cpc_rate_minor, cpm_rate_minor,
       starts_at, ends_at, priority, rotation_weight,
       frequency_cap_impressions, frequency_cap_window_minutes,
       total_budget_minor, daily_budget_minor, auto_renew, auto_renew_authorized_at,
       renewal_count, renewed_from_campaign_id, pricing_snapshot, metadata, submitted_at)
    values
      (v_new, r.vendor_id, r.created_by, r.placement_id, r.placement_key, r.pricing_id,
       r.pricing_model, r.currency, r.name, 'pending_payment', 'unpaid', v_ref, 'manual',
       r.quote_amount_minor, r.fixed_price_minor, r.cpc_rate_minor, r.cpm_rate_minor,
       v_start, v_start + v_duration, r.priority, r.rotation_weight,
       r.frequency_cap_impressions, r.frequency_cap_window_minutes,
       r.total_budget_minor, r.daily_budget_minor, false, null,
       r.renewal_count + 1, r.id, r.pricing_snapshot, r.metadata, now());

    insert into public.advertising_campaign_budgets
      (campaign_id, total_budget_minor, daily_budget_minor, currency)
    values
      (v_new, r.total_budget_minor, r.daily_budget_minor, r.currency);

    insert into public.advertising_creatives
      (campaign_id, type, headline, headline_ar, body, body_ar, image_url,
       mobile_image_url, image_alt, image_alt_ar, cta_label, cta_label_ar,
       destination_type, destination_id, destination_url, sponsored_label,
       sponsored_label_ar, sort_order)
    select
      v_new, type, headline, headline_ar, body, body_ar, image_url,
      mobile_image_url, image_alt, image_alt_ar, cta_label, cta_label_ar,
      destination_type, destination_id, destination_url, sponsored_label,
      sponsored_label_ar, sort_order
    from public.advertising_creatives
    where campaign_id = r.id
    order by sort_order asc, created_at asc
    limit 1;

    insert into public.advertising_transactions
      (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
       provider_reference, idempotency_key, description)
    values
      (v_new, r.vendor_id, 'renewal', 'pending', r.quote_amount_minor, r.currency, 'manual',
       v_ref, 'renewal:' || v_new::text, 'Automatic renewal');

    update public.advertising_campaigns
    set auto_renewed_at = now(), updated_at = now()
    where id = r.id;

    perform public.advertising_notify(
      'vendor', r.vendor_id, v_new, 'renewal_created',
      'Renewal created',
      'A renewal for ' || r.name || ' is waiting for payment.',
      jsonb_build_object('campaign_id', v_new, 'source_campaign_id', r.id));
    perform public.advertising_notify(
      'admin', r.vendor_id, v_new, 'renewal_created',
      'Renewal waiting for payment',
      'Campaign ' || r.name || ' auto-renewed and needs payment verification.',
      jsonb_build_object('campaign_id', v_new, 'source_campaign_id', r.id));

    v_renewed := v_renewed + 1;
  end loop;

  return jsonb_build_object(
    'expired_unpaid', v_expired,
    'suspended', v_suspended,
    'completed', v_completed,
    'resumed_daily', v_resumed,
    'renewed', v_renewed,
    'ran_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Delivery
-- ---------------------------------------------------------------------------

create or replace function public.advertising_deliver(
  p_placement_key text,
  p_limit integer default 3,
  p_viewer_key text default null,
  p_session_id text default null,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placement record;
  v_limit integer;
  v_viewer text;
  v_cap integer;
  v_window integer;
  v_dedupe integer;
  r record;
  v_imp uuid;
  v_cost bigint;
  v_items jsonb := '[]'::jsonb;
begin
  perform public.advertising_run_maintenance();

  v_limit := greatest(1, least(coalesce(p_limit, 3), 10));
  v_viewer := coalesce(nullif(p_viewer_key, ''), nullif(p_session_id, ''), 'anon');
  v_cap := public.advertising_rule_int('frequency_cap_default_impressions', 3);
  v_window := public.advertising_rule_int('frequency_cap_default_window_minutes', 60);
  v_dedupe := public.advertising_rule_int('impression_dedupe_seconds', 30);

  select * into v_placement
  from public.advertising_placements
  where key = p_placement_key and is_active;

  if not found then
    return jsonb_build_object('placement', p_placement_key, 'ads', '[]'::jsonb, 'empty', true);
  end if;

  for r in
    select
      c.id as campaign_id, c.vendor_id, c.pricing_model, c.cpc_rate_minor,
      c.cpm_rate_minor, c.priority, c.rotation_weight, c.last_served_at,
      c.name as campaign_name, c.ends_at,
      cr.id as creative_id, cr.headline, cr.headline_ar, cr.body, cr.body_ar,
      cr.image_url, cr.mobile_image_url, cr.image_alt, cr.image_alt_ar,
      cr.cta_label, cr.cta_label_ar, cr.destination_type, cr.destination_id,
      cr.destination_url, cr.sponsored_label, cr.sponsored_label_ar,
      v.name as vendor_name, v.name_ar as vendor_name_ar, v.logo_url as vendor_logo
    from public.advertising_campaigns c
    join public.advertising_placements p on p.id = c.placement_id
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
      and (
        coalesce(nullif(c.frequency_cap_impressions, 0), v_cap) <= 0
        or (
          select count(*)
          from public.advertising_impressions i
          where i.campaign_id = c.id
            and i.viewer_key = v_viewer
            and i.served_at > now() - make_interval(
              mins => coalesce(nullif(c.frequency_cap_window_minutes, 0), v_window))
        ) < coalesce(nullif(c.frequency_cap_impressions, 0), v_cap)
      )
      and not exists (
        select 1
        from public.advertising_impressions i
        where i.campaign_id = c.id
          and i.viewer_key = v_viewer
          and i.served_at > now() - make_interval(secs => v_dedupe)
      )
    order by
      c.priority desc,
      case when v_placement.auction_enabled
           then coalesce(c.cpc_rate_minor, 0) + coalesce(c.cpm_rate_minor, 0)
           else 0 end desc,
      c.last_served_at asc nulls first,
      random() * greatest(c.rotation_weight, 1)
    limit v_limit
  loop
    v_imp := gen_random_uuid();

    insert into public.advertising_impressions
      (id, campaign_id, creative_id, placement_id, vendor_id, viewer_key,
       session_id, request_id, metadata)
    values
      (v_imp, r.campaign_id, r.creative_id, v_placement.id, r.vendor_id, v_viewer,
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
      'ends_at', r.ends_at
    ));
  end loop;

  return jsonb_build_object(
    'placement', p_placement_key,
    'ads', v_items,
    'empty', jsonb_array_length(v_items) = 0
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Stats triggers (counts only; spend is written by the charge function)
-- ---------------------------------------------------------------------------

create or replace function public.advertising_stats_impression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.advertising_bump_stats(new.campaign_id, new.served_at::date, 1, 0, 0, 0);
  return new;
end;
$$;

create or replace function public.advertising_stats_click()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.advertising_bump_stats(new.campaign_id, new.clicked_at::date, 0, 1, 0, 0);
  return new;
end;
$$;

create or replace function public.advertising_stats_conversion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.advertising_bump_stats(new.campaign_id, new.attributed_at::date, 0, 0, 1, 0);
  return new;
end;
$$;

drop trigger if exists advertising_impression_stats on public.advertising_impressions;
create trigger advertising_impression_stats
  after insert on public.advertising_impressions
  for each row execute function public.advertising_stats_impression();

drop trigger if exists advertising_click_stats on public.advertising_clicks;
create trigger advertising_click_stats
  after insert on public.advertising_clicks
  for each row execute function public.advertising_stats_click();

drop trigger if exists advertising_conversion_stats on public.advertising_conversions;
create trigger advertising_conversion_stats
  after insert on public.advertising_conversions
  for each row execute function public.advertising_stats_conversion();
