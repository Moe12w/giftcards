-- 0152_advertising_delivery_no_maintenance.sql
-- `advertising_deliver` used to call `advertising_run_maintenance()` on every
-- single request. That is a full campaign expiry/budget sweep, so every
-- sponsored carousel mount on every phone was doing maintenance work — a big
-- share of the free-tier DB cost and a visible delay before ads appeared.
--
-- The daily cron already calls `advertising_run_maintenance()` directly, so
-- scheduling is unchanged. This migration recreates the function verbatim with
-- just that one line removed.

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
