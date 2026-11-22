-- 0158_purge_placeholder_partner_images.sql
-- No placeholder service artwork may reach a customer.
--
-- Migration 0038 filled the demo partner's image columns with placehold.co
-- URLs, and the seed did the same for vendors and basket items. Those rows are
-- not brand imagery: a storefront card showing "placehold.co" looks unfinished
-- and reads as placeholder content in review. The photo CDN below is already
-- allowlisted by the app and the site.
--
-- Idempotent: rows that already point somewhere else are untouched, so it is
-- safe on a database that was seeded after the artwork changed.

update public.enterprise_partners
set logo_url = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&h=200&fit=crop'
where logo_url like 'https://placehold.co/%';

update public.enterprise_partners
set banner_url = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&h=300&fit=crop'
where banner_url like 'https://placehold.co/%';

update public.vendors
set logo_url = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=200&h=200&fit=crop'
where logo_url like 'https://placehold.co/%';

update public.vendors
set banner_url = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&h=300&fit=crop'
where banner_url like 'https://placehold.co/%';

update public.gift_basket_items
set logo_url = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=200&h=200&fit=crop'
where logo_url like 'https://placehold.co/%';

update public.gift_basket_items
set banner_url = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&h=300&fit=crop'
where banner_url like 'https://placehold.co/%';
