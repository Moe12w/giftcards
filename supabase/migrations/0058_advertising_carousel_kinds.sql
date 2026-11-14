-- 0058_advertising_carousel_kinds.sql
-- New placement kinds for per-category and per-collection carousels.

alter type public.advertising_placement_kind add value if not exists 'category_carousel';
alter type public.advertising_placement_kind add value if not exists 'collection_carousel';
