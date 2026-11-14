-- 0060_advertising_extra_collections.sql
-- Completes the per-collection carousels: the two remaining collection routes
-- (featured businesses and new arrivals) get their own 8-slot placement and a
-- full set of seeded campaigns, exactly like the other collections.

insert into public.advertising_placements
  (key, kind, name, name_ar, description, description_ar, format, supports_carousel,
   slot_count, max_active_campaigns, rotation_mode, auction_enabled, priority, sort_order,
   creative_width, creative_height, config, allowed_pricing_models, slot_prices_minor)
select
  'collection_' || v.slug,
  'collection_carousel'::public.advertising_placement_kind,
  v.name_en || ' collection carousel',
  v.name_ar || ' - كاروسيل المجموعة',
  'Sponsored strip at the top of the ' || v.name_en || ' collection page.',
  'شريط إعلاني أعلى صفحة مجموعة ' || v.name_ar || '.',
  'native', false, 8, 8, 'fixed', false, 28, v.sort_order, 800, 400,
  '{"max_per_vendor": 2, "auto_rotate_seconds": 15}'::jsonb,
  '{fixed}'::text[],
  ARRAY[40000, 35000, 30000, 25000, 20000, 18000, 15000, 12000]::bigint[]
from (values
  ('featured-businesses', 'Featured businesses', 'الأعمال المميزة', 142),
  ('new-arrivals',        'New arrivals',        'أحدث الإضافات',  143)
) as v(slug, name_en, name_ar, sort_order)
on conflict (key) do nothing;

insert into public.advertising_pricing
  (placement_id, pricing_model, fixed_price_minor, cpc_rate_minor, cpm_rate_minor,
   min_duration_days, max_duration_days, default_duration_days, min_budget_minor,
   version, is_active)
select
  p.id, 'fixed'::public.advertising_pricing_model,
  coalesce(p.slot_prices_minor[1], 40000), 0, 0,
  1, 3, 1,
  coalesce(p.slot_prices_minor[array_length(p.slot_prices_minor, 1)], 12000),
  1, true
from public.advertising_placements p
where p.kind = 'collection_carousel'
  and not exists (
    select 1 from public.advertising_pricing x
    where x.placement_id = p.id and x.pricing_model = 'fixed' and x.is_active
  );

do $$
declare
  v_user uuid := '99999999-9999-4999-8999-999999999999';
  v_placement record;
  v_slot integer;
  v_campaign uuid;
  v_pricing uuid;
  v_price bigint;
  v_vendor uuid;
  v_vendor_name text;
  v_idx integer;
  v_headline text;
  v_body text;
  v_names text[] := ARRAY['The Coffee House', 'Dune Spa', 'Souq Kitchen', 'Bloom Beauty'];
  v_vendors uuid[] := ARRAY[
    '58852d5f-8486-42fa-a423-b199925159b0'::uuid,
    '2533ec89-f5b1-4409-9273-c87bf133d095'::uuid,
    'a010f419-3183-4fb5-bd38-e73ba7f51317'::uuid,
    'b11ee824-7866-4b02-abcd-08bc5e077018'::uuid
  ];
  v_images text[] := ARRAY[
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&h=600&fit=crop'
  ];
  v_mobile text[] := ARRAY[
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&h=400&fit=crop'
  ];
begin
  for v_placement in
    select *
    from public.advertising_placements
    where key in ('collection_featured-businesses', 'collection_new-arrivals')
      and is_active
    order by sort_order
  loop
    select id into v_pricing
    from public.advertising_pricing
    where placement_id = v_placement.id and pricing_model = 'fixed' and is_active
    limit 1;

    if v_pricing is null then
      continue;
    end if;

    for v_slot in 1..greatest(coalesce(v_placement.slot_count, 8), 8) loop
      if exists (
        select 1 from public.advertising_campaigns c
        where c.placement_id = v_placement.id
          and c.slot_number = v_slot
          and c.status in ('active', 'scheduled', 'pending_approval', 'pending_payment')
      ) then
        continue;
      end if;

      v_idx := ((v_slot - 1) % 4) + 1;
      v_vendor := v_vendors[v_idx];
      v_vendor_name := v_names[v_idx];
      v_price := coalesce(v_placement.slot_prices_minor[v_slot], 15000);
      v_headline := v_vendor_name || ' - Special Offers!';
      v_body := 'Check out our latest deals and exclusive offers. Shop now!';

      insert into public.advertising_campaigns
        (vendor_id, created_by, placement_id, placement_key, pricing_id, pricing_model,
         currency, name, status, payment_status, payment_reference, payment_provider,
         quote_amount_minor, fixed_price_minor, cpc_rate_minor, cpm_rate_minor,
         starts_at, ends_at, total_budget_minor, daily_budget_minor,
         auto_renew, priority, rotation_weight, frequency_cap_impressions,
         frequency_cap_window_minutes, capacity_override, eligibility_reason,
         submitted_at, approved_at, approved_by, activated_at,
         pricing_snapshot, metadata, slot_number, created_at, updated_at)
      values
        (v_vendor, v_user, v_placement.id, v_placement.key, v_pricing, 'fixed',
         'QAR', 'Seed Ad - ' || v_placement.name || ' #' || v_slot, 'active', 'paid',
         'SEED-' || v_placement.key || '-' || v_slot, 'manual',
         v_price, v_price, 0, 0,
         now(), now() + interval '71 hours', v_price, 0,
         false, v_placement.priority, 100, 0, 0, false, null,
         now(), now(), v_user, now(),
         jsonb_build_object('pricing_id', v_pricing, 'model', 'fixed',
                            'fixed_price_minor', v_price, 'currency', 'QAR',
                            'version', 1, 'captured_at', now(),
                            'slot_number', v_slot),
         '{}'::jsonb, v_slot, now(), now())
      returning id into v_campaign;

      insert into public.advertising_creatives
        (campaign_id, type, headline, headline_ar, body, body_ar, image_url, mobile_image_url,
         image_alt, cta_label, destination_type, destination_id, destination_url,
         sponsored_label, sponsored_label_ar, status, created_at, updated_at)
      values
        (v_campaign, 'image',
         v_headline, 'اكتشف ' || v_vendor_name || ' - عروض خاصة!',
         v_body, 'تحقق من أحدث عروضنا وصفقاتنا الحصرية. تسوق الآن!',
         v_images[v_idx], v_mobile[v_idx],
         v_vendor_name || ' advertisement', 'Learn more',
         'business', v_vendor, null,
         'Sponsored', 'إعلان مدفوع', 'active', now(), now());

      insert into public.advertising_campaign_budgets
        (campaign_id, currency, total_budget_minor, daily_budget_minor, spent_minor, daily_spent_minor)
      values
        (v_campaign, 'QAR', v_price, 0, 0, 0);

      insert into public.advertising_inventory
        (placement_id, campaign_id, slot_index, status, starts_at, ends_at)
      values
        (v_placement.id, v_campaign, v_slot, 'occupied', now(), now() + interval '71 hours');
    end loop;
  end loop;
end;
$$;
