-- 0051_advertising_bulk_deals_ranking.sql
-- Adds a new advertising placement kind: sponsored ranking inside the bulk
-- deals list (web-only surface for approved business accounts).

alter type public.advertising_placement_kind add value if not exists 'bulk_deals_ranking';
