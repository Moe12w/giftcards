-- 0065_advertising_copy_campaign_slots.sql
-- Duplicate and renew must carry the slot number and reserve the next free
-- window instead of dropping the campaign into shared rotation.

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

  -- A slot campaign keeps its numbered slot. If the slot is still busy at the
  -- requested start, the copy starts when the queue clears.
  if c.slot_number is not null then
    v_start := public.advertising_slot_next_available(c.placement_key, c.slot_number, v_start);
  end if;

  insert into public.advertising_campaigns
    (vendor_id, created_by, placement_id, placement_key, pricing_id, pricing_model,
     currency, name, status, quote_amount_minor, fixed_price_minor, cpc_rate_minor,
     cpm_rate_minor, starts_at, ends_at, priority, rotation_weight,
     frequency_cap_impressions, frequency_cap_window_minutes, total_budget_minor,
     daily_budget_minor, auto_renew, pricing_snapshot, metadata, renewal_count,
     renewed_from_campaign_id, slot_number)
  values
    (c.vendor_id, auth.uid(), c.placement_id, c.placement_key, c.pricing_id,
     c.pricing_model, c.currency, v_name, 'draft', c.quote_amount_minor,
     c.fixed_price_minor, c.cpc_rate_minor, c.cpm_rate_minor, v_start,
     v_start + v_duration, c.priority, c.rotation_weight,
     c.frequency_cap_impressions, c.frequency_cap_window_minutes,
     c.total_budget_minor, c.daily_budget_minor, false,
     c.pricing_snapshot || jsonb_build_object('slot_number', c.slot_number),
     c.metadata, case when p_as_renewal then c.renewal_count + 1 else 0 end,
     case when p_as_renewal then c.id else null end, c.slot_number)
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

  if c.slot_number is not null then
    insert into public.advertising_inventory
      (placement_id, campaign_id, slot_index, status, starts_at, ends_at)
    values
      (c.placement_id, v_id, c.slot_number, 'reserved', v_start, v_start + v_duration);
  end if;

  perform public.advertising_audit(
    case when p_as_renewal then 'campaign_renewed' else 'campaign_duplicated' end,
    'advertising_campaign', v_id,
    jsonb_build_object('source_campaign_id', c.id, 'vendor_id', c.vendor_id));

  return v_id;
end;
$$;

grant execute on function public.advertising_copy_campaign(uuid, boolean) to authenticated;
grant execute on function public.advertising_copy_campaign(uuid, boolean) to service_role;
