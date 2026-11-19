-- 0128_expo_app_controls.sql
-- Server-side controls for the customer Expo app.
--
-- The app has always rendered categories, collections and the featured shelf
-- from compile-time constants. This migration gives the admin dashboard a
-- supported place to change that merchandising without shipping a new build:
--
--   * categories gain the presentation fields the app already uses (tone) and
--     a home-only visibility flag;
--   * the marketplace view exposes vendors.is_featured so the existing admin
--     checkbox finally has an effect;
--   * public system_settings rows hold the home, featured, collection and
--     maintenance configuration read by the app.
--
-- Every setting is seeded with today's behaviour, so applying this migration
-- does not change what customers see until an admin edits a value.

-- ---------------------------------------------------------------------
-- Categories: presentation + home visibility
-- ---------------------------------------------------------------------
alter table public.categories
  add column if not exists tone text,
  add column if not exists show_on_home boolean not null default true;

update public.categories
set tone = case slug
  when 'coffee' then 'gold'
  when 'dining' then 'pink'
  when 'desserts' then 'pink'
  when 'wellness' then 'teal'
  when 'shopping' then 'lavender'
  when 'experiences' then 'sky'
  when 'beauty' then 'lavender'
  when 'fitness' then 'teal'
  when 'entertainment' then 'pink'
  else 'lavender'
end
where tone is null;

-- ---------------------------------------------------------------------
-- Marketplace view: expose the editorial featured flag
-- ---------------------------------------------------------------------
drop view if exists public.marketplace_businesses;
create view public.marketplace_businesses with (security_invoker = true) as
  select
    v.id,
    'vendor'::text as business_kind,
    v.name,
    v.slug,
    v.logo_url,
    v.banner_url,
    v.city,
    v.area,
    v.rating::numeric as rating,
    v.description,
    v.status::text as status,
    v.is_featured,
    (
      select count(*)::int
      from public.products p
      where p.vendor_id = v.id and p.status = 'published'
    ) as gift_count
  from public.vendors v
  where v.status = 'approved'
    and v.enterprise_partner_id is null
  union all
  select
    ep.id,
    'partner'::text,
    ep.name,
    ep.slug,
    ep.logo_url,
    ep.banner_url,
    null::text,
    null::text,
    0::numeric,
    ep.notes,
    ep.status::text as status,
    false as is_featured,
    (
      select count(*)::int
      from public.products p
      where p.partner_id = ep.id and p.status = 'published'
    ) as gift_count
  from public.enterprise_partners ep
  where ep.status = 'active';

-- ---------------------------------------------------------------------
-- Public app configuration
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public)
values
  (
    'expo.home',
    '{
      "sections": [
        {"key": "heroCarousel", "visible": true, "order": 10},
        {"key": "featuredBusinesses", "visible": true, "order": 20},
        {"key": "activeBasket", "visible": true, "order": 30},
        {"key": "heroCard", "visible": true, "order": 40},
        {"key": "categories", "visible": true, "order": 50},
        {"key": "collections", "visible": true, "order": 60},
        {"key": "sponsoredGifts", "visible": true, "order": 70},
        {"key": "trending", "visible": true, "order": 80},
        {"key": "recommended", "visible": true, "order": 90}
      ],
      "trendingLimit": 8,
      "recommendedLimit": 3
    }'::jsonb,
    'Expo home sections, order and shelf limits',
    true
  ),
  (
    'expo.featured',
    '{
      "mode": "auto",
      "limit": 6,
      "partnerFirst": true,
      "sort": "gift_count",
      "prioritizeFeatured": false,
      "businessIds": []
    }'::jsonb,
    'Expo featured businesses source, order and manual selection',
    true
  ),
  (
    'expo.categories',
    '{"homeLimit": 9}'::jsonb,
    'Number of active categories shown on the Expo home page',
    true
  ),
  (
    'expo.collections',
    '{
      "homeLimit": 7,
      "items": [
        {"slug": "birthday", "visible": true, "order": 10},
        {"slug": "for-her", "visible": true, "order": 20},
        {"slug": "for-him", "visible": true, "order": 30},
        {"slug": "thank-you", "visible": true, "order": 40},
        {"slug": "just-because", "visible": true, "order": 50},
        {"slug": "anniversary", "visible": true, "order": 60},
        {"slug": "congratulations", "visible": true, "order": 70}
      ]
    }'::jsonb,
    'Expo curated collection tiles, order and home limit',
    true
  ),
  (
    'expo.controls',
    '{
      "maintenance": {"enabled": false, "message": "", "messageAr": ""},
      "announcement": {"enabled": false, "text": "", "textAr": ""}
    }'::jsonb,
    'Expo maintenance screen and home announcement banner',
    true
  )
on conflict (key) do nothing;
