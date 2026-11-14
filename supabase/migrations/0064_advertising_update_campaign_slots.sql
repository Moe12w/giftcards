-- 0064_advertising_update_campaign_slots.sql
-- Editing a slot-based campaign must use the 6-72 hour window and must not
-- double-book the slot. Day-based placements keep their day range.

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
