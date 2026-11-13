-- 0052_advertising_bulk_deals_ranking_seed.sql
-- Seeds the sponsored bulk-deals ranking placement and its default pricing.

insert into public.advertising_placements
  (key, kind, name, name_ar, description, description_ar, format, supports_carousel,
   slot_count, max_active_campaigns, rotation_mode, auction_enabled, priority, sort_order,
   creative_width, creative_height, config)
values
  ('bulk_deals_ranking', 'bulk_deals_ranking', 'Bulk deals ranking',
   'ترتيب عروض الجملة',
   'Sponsored gift cards ranked higher in the bulk deals list.',
   'بطاقات مكافأة مدعومة تُرتب أعلى قائمة عروض الجملة.',
   'native', false, 0, 3, 'auction', true, 62, 95, 800, 400,
   '{"max_per_vendor": 3}'::jsonb)
on conflict (key) do nothing;

insert into public.advertising_pricing
  (placement_id, pricing_model, fixed_price_minor, cpc_rate_minor, cpm_rate_minor,
   min_duration_days, max_duration_days, default_duration_days, min_budget_minor, version, is_active)
select p.id, v.model, v.fixed, v.cpc, v.cpm, 1, 365, 30, v.min_budget, 1, true
from public.advertising_placements p
cross join (values
  ('bulk_deals_ranking'::text, 'fixed'::public.advertising_pricing_model, 30000::bigint, 0::bigint, 0::bigint, 10000::bigint),
  ('bulk_deals_ranking'::text, 'cpc'::public.advertising_pricing_model,        0::bigint,  90::bigint,     0::bigint, 10000::bigint),
  ('bulk_deals_ranking'::text, 'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint, 4000::bigint, 10000::bigint)
) as v(key, model, fixed, cpc, cpm, min_budget)
where p.key = v.key
  and not exists (
    select 1 from public.advertising_pricing x
    where x.placement_id = p.id and x.pricing_model = v.model and x.is_active
  );
