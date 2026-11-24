-- 0166_unify_business_logos.sql
-- Every business now uses the same logo artwork, matching The Coffee House.
-- The seed files only affect a fresh database, so an already-seeded
-- environment keeps the old per-vendor logos until it runs this migration.
--
-- Business logos are read live from public.vendors and public.enterprise_partners
-- (the marketplace view lists both), but gift baskets snapshot the logo onto
-- each item when it is added, so that table needs the same value.
--
-- Idempotent: rows that already point at the logo are skipped, so it is safe to
-- run on a database seeded after the artwork changed.

update public.vendors
set logo_url = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop'
where logo_url is distinct from 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop';

update public.enterprise_partners
set logo_url = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop'
where logo_url is distinct from 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop';

update public.gift_basket_items
set logo_url = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop'
where logo_url is distinct from 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop';
