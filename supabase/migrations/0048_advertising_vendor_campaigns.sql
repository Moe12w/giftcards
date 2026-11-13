-- 0048_advertising_vendor_campaigns.sql
-- Vendor-facing campaign creation, editing, duplication, renewal, pause/resume.

-- ---------------------------------------------------------------------------
-- 1. Creative validation
-- ---------------------------------------------------------------------------

create or replace function public.advertising_validate_creative(p_creative jsonb, p_format text)
returns void
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_id uuid;
  v_url text;
  v_headline text;
begin
  if p_creative is null then
    raise exception 'creative_required';
  end if;

  v_headline := trim(coalesce(p_creative->>'headline', ''));
  if v_headline = '' then
    raise exception 'headline_required';
  end if;

  v_type := coalesce(nullif(p_creative->>'destination_type', ''), 'url');
  if v_type not in ('url', 'business', 'gift_card', 'category', 'internal') then
    raise exception 'invalid_destination_type';
  end if;

  v_id := nullif(p_creative->>'destination_id', '')::uuid;
  v_url := nullif(trim(p_creative->>'destination_url'), '');

  if v_type = 'url' then
    if v_url is null or v_url !~* '^https?://' then
      raise exception 'invalid_destination_url';
    end if;
  else
    if v_id is null then
      raise exception 'destination_id_required';
    end if;
    if v_type = 'business' and not exists (select 1 from public.vendors where id = v_id) then
      raise exception 'destination_business_not_found';
    end if;
    if v_type = 'gift_card' and not exists (select 1 from public.offers where id = v_id) then
      raise exception 'destination_offer_not_found';
    end if;
    if v_type = 'category' and not exists (select 1 from public.categories where id = v_id) then
      raise exception 'destination_category_not_found';
    end if;
  end if;

  if p_format in ('banner', 'carousel') and nullif(trim(coalesce(p_creative->>'image_url', '')), '') is null then
    raise exception 'image_required';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Create
-- ---------------------------------------------------------------------------

create or replace function public.advertising_create_campaign(
  p_vendor_id uuid,
  p_placement_key text,
  p_pricing_id uuid,
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_total_budget_minor bigint,
  p_daily_budget_minor bigint,
  p_auto_renew boolean,
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

  select * into pr from public.advertising_pricing
  where id = p_pricing_id and placement_id = p.id and is_active;
  if not found then
    raise exception 'pricing_unavailable';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  v_starts := coalesce(p_starts_at, now());
  v_ends := p_ends_at;
  if v_ends is null or v_ends <= v_starts then
    raise exception 'invalid_dates';
  end if;

  v_days := ceil(extract(epoch from (v_ends - v_starts)) / 86400.0)::integer;
  if v_days < greatest(pr.min_duration_days, public.advertising_rule_int('min_duration_days', 1)) then
    raise exception 'duration_too_short';
  end if;
  if v_days > least(pr.max_duration_days, public.advertising_rule_int('max_duration_days', 365)) then
    raise exception 'duration_too_long';
  end if;

  if pr.pricing_model = 'fixed' then
    v_quote := pr.fixed_price_minor;
    v_total := pr.fixed_price_minor;
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
     auto_renew, auto_renew_authorized_at, pricing_snapshot)
  values
    (p_vendor_id, auth.uid(), p.id, p.key, pr.id, pr.pricing_model,
     pr.currency, trim(p_name), 'draft', v_quote, pr.fixed_price_minor,
     pr.cpc_rate_minor, pr.cpm_rate_minor, v_starts, v_ends, v_total, v_daily,
     coalesce(p_auto_renew, false),
     case when coalesce(p_auto_renew, false) then now() else null end,
     jsonb_build_object(
       'pricing_id', pr.id, 'model', pr.pricing_model,
       'fixed_price_minor', pr.fixed_price_minor,
       'cpc_rate_minor', pr.cpc_rate_minor,
       'cpm_rate_minor', pr.cpm_rate_minor,
       'currency', pr.currency, 'version', pr.version,
       'captured_at', now()))
  returning id into v_id;

  insert into public.advertising_campaign_budgets
    (campaign_id, total_budget_minor, daily_budget_minor, currency)
  values
    (v_id, v_total, v_daily, pr.currency);

  insert into public.advertising_creatives
    (campaign_id, type, headline, headline_ar, body, body_ar, image_url,
     mobile_image_url, image_alt, image_alt_ar, cta_label, cta_label_ar,
     destination_type, destination_id, destination_url, sponsored_label,
     sponsored_label_ar, sort_order)
  values
    (v_id, coalesce(nullif(p_creative->>'type', ''), 'image'),
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

  perform public.advertising_audit(
    'campaign_created', 'advertising_campaign', v_id,
    jsonb_build_object('placement', p.key, 'pricing_model', pr.pricing_model,
                       'quote_minor', v_quote, 'vendor_id', p_vendor_id));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Update
-- ---------------------------------------------------------------------------

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

  if pr.id is not null then
    v_days := ceil(extract(epoch from (p_ends_at - p_starts_at)) / 86400.0)::integer;
    if v_days < greatest(pr.min_duration_days, public.advertising_rule_int('min_duration_days', 1)) then
      raise exception 'duration_too_short';
    end if;
    if v_days > least(pr.max_duration_days, public.advertising_rule_int('max_duration_days', 365)) then
      raise exception 'duration_too_long';
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
      total_budget_minor = coalesce(p_total_budget_minor, total_budget_minor),
      daily_budget_minor = coalesce(p_daily_budget_minor, daily_budget_minor),
      auto_renew = coalesce(p_auto_renew, auto_renew),
      auto_renew_authorized_at = case
        when coalesce(p_auto_renew, auto_renew) then coalesce(auto_renew_authorized_at, now())
        else null
      end,
      updated_at = now()
  where id = c.id;

  update public.advertising_campaign_budgets
  set total_budget_minor = coalesce(p_total_budget_minor, total_budget_minor),
      daily_budget_minor = coalesce(p_daily_budget_minor, daily_budget_minor),
      updated_at = now()
  where campaign_id = c.id;

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

-- ---------------------------------------------------------------------------
-- 4. Duplicate and renew
-- ---------------------------------------------------------------------------

create or replace function public.advertising_copy_campaign(
  p_campaign_id uuid,
  p_as_renewal boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_id uuid;
  v_duration interval;
  v_start timestamptz;
  v_name text;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not (public.advertising_can_manage_vendor(c.vendor_id) or public.is_admin()) then
    raise exception 'not_authorized';
  end if;

  v_duration := c.ends_at - c.starts_at;
  v_start := case when p_as_renewal then greatest(now(), c.ends_at) else now() end;
  v_name := case when p_as_renewal then c.name else c.name || ' (copy)' end;

  insert into public.advertising_campaigns
    (vendor_id, created_by, placement_id, placement_key, pricing_id, pricing_model,
     currency, name, status, quote_amount_minor, fixed_price_minor, cpc_rate_minor,
     cpm_rate_minor, starts_at, ends_at, priority, rotation_weight,
     frequency_cap_impressions, frequency_cap_window_minutes, total_budget_minor,
     daily_budget_minor, auto_renew, pricing_snapshot, metadata, renewal_count,
     renewed_from_campaign_id)
  values
    (c.vendor_id, auth.uid(), c.placement_id, c.placement_key, c.pricing_id,
     c.pricing_model, c.currency, v_name, 'draft', c.quote_amount_minor,
     c.fixed_price_minor, c.cpc_rate_minor, c.cpm_rate_minor, v_start,
     v_start + v_duration, c.priority, c.rotation_weight,
     c.frequency_cap_impressions, c.frequency_cap_window_minutes,
     c.total_budget_minor, c.daily_budget_minor, false, c.pricing_snapshot,
     c.metadata, case when p_as_renewal then c.renewal_count + 1 else 0 end,
     case when p_as_renewal then c.id else null end)
  returning id into v_id;

  insert into public.advertising_campaign_budgets
    (campaign_id, total_budget_minor, daily_budget_minor, currency)
  values
    (v_id, c.total_budget_minor, c.daily_budget_minor, c.currency);

  insert into public.advertising_creatives
    (campaign_id, type, headline, headline_ar, body, body_ar, image_url,
     mobile_image_url, image_alt, image_alt_ar, cta_label, cta_label_ar,
     destination_type, destination_id, destination_url, sponsored_label,
     sponsored_label_ar, sort_order)
  select
    v_id, type, headline, headline_ar, body, body_ar, image_url,
    mobile_image_url, image_alt, image_alt_ar, cta_label, cta_label_ar,
    destination_type, destination_id, destination_url, sponsored_label,
    sponsored_label_ar, sort_order
  from public.advertising_creatives
  where campaign_id = c.id
  order by sort_order asc, created_at asc;

  perform public.advertising_audit(
    case when p_as_renewal then 'campaign_renewed' else 'campaign_duplicated' end,
    'advertising_campaign', v_id,
    jsonb_build_object('source_campaign_id', c.id, 'vendor_id', c.vendor_id));

  return v_id;
end;
$$;

create or replace function public.advertising_duplicate_campaign(p_campaign_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.advertising_copy_campaign(p_campaign_id, false);
$$;

create or replace function public.advertising_renew_campaign(p_campaign_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.advertising_copy_campaign(p_campaign_id, true);
$$;

-- ---------------------------------------------------------------------------
-- 5. Pause and resume
-- ---------------------------------------------------------------------------

create or replace function public.advertising_pause_campaign(
  p_campaign_id uuid,
  p_reason text default 'vendor_paused'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not (public.advertising_can_manage_vendor(c.vendor_id) or public.is_admin()) then
    raise exception 'not_authorized';
  end if;
  if c.status not in ('active', 'scheduled', 'pending_approval') then
    raise exception 'campaign_not_pausable';
  end if;

  update public.advertising_campaigns
  set status = 'paused', paused_at = now(),
      pause_reason = coalesce(nullif(p_reason, ''), 'vendor_paused'),
      auto_resume_at = null, updated_at = now()
  where id = c.id;

  perform public.advertising_release_inventory(c.id);
  perform public.advertising_notify(
    'vendor', c.vendor_id, c.id, 'paused',
    'Campaign paused',
    'Campaign ' || c.name || ' has been paused.',
    jsonb_build_object('campaign_id', c.id, 'reason', p_reason));
  perform public.advertising_audit(
    'campaign_paused', 'advertising_campaign', c.id,
    jsonb_build_object('reason', p_reason, 'actor', case when public.is_admin() then 'admin' else 'vendor' end));
end;
$$;

create or replace function public.advertising_resume_campaign(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not (public.advertising_can_manage_vendor(c.vendor_id) or public.is_admin()) then
    raise exception 'not_authorized';
  end if;
  if c.status <> 'paused' then
    raise exception 'campaign_not_paused';
  end if;
  if c.pause_reason = 'advertiser_suspended' and not public.is_admin() then
    raise exception 'advertiser_suspended';
  end if;
  if c.pause_reason = 'daily_budget'
     and c.auto_resume_at is not null
     and c.auto_resume_at > now()
     and not public.is_admin() then
    raise exception 'daily_budget_wait';
  end if;
  if c.payment_status <> 'paid' then
    raise exception 'payment_required';
  end if;

  update public.advertising_campaigns
  set status = 'scheduled', paused_at = null, pause_reason = null,
      auto_resume_at = null, updated_at = now()
  where id = c.id;

  perform public.advertising_try_activate(c.id);
  perform public.advertising_notify(
    'vendor', c.vendor_id, c.id, 'resumed',
    'Campaign resumed',
    'Campaign ' || c.name || ' has been resumed.',
    jsonb_build_object('campaign_id', c.id));
  perform public.advertising_audit(
    'campaign_resumed', 'advertising_campaign', c.id,
    jsonb_build_object('actor', case when public.is_admin() then 'admin' else 'vendor' end));

  select * into c from public.advertising_campaigns where id = p_campaign_id;
  return c.status::text;
end;
$$;
