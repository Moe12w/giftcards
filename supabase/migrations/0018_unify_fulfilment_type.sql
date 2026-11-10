-- 0018_unify_fulfilment_type.sql
-- One source of truth for "how is this card fulfilled".
--
-- Migration 0009 introduced `redemption_mode` on the catalogue and on the
-- issued card. Migration 0011/0012 introduced `fulfilment_type`, which also
-- covers the third fulfilment type (enterprise code). The older column and its
-- check constraints are dropped here so there is exactly one field to read,
-- write and enforce.

-- ---------------------------------------------------------------------------
-- The legacy view reads redemption_mode, so it is rebuilt afterwards.
-- ---------------------------------------------------------------------------
drop view if exists public.offers;

-- ---------------------------------------------------------------------------
-- The catalogue
-- ---------------------------------------------------------------------------
alter table public.products drop constraint if exists offers_session_count_matches_mode;
alter table public.products drop column if exists redemption_mode;

-- ---------------------------------------------------------------------------
-- The issued voucher
-- ---------------------------------------------------------------------------
alter table public.vouchers drop constraint if exists gift_cards_sessions_total_matches_mode;
alter table public.vouchers drop column if exists redemption_mode;

-- ---------------------------------------------------------------------------
-- Compatibility view: legacy readers keep using `offers`.
-- ---------------------------------------------------------------------------
create or replace view public.offers
with (security_invoker = true) as
select
  p.id,
  p.vendor_id,
  p.title,
  p.title_ar,
  p.description,
  p.image_url,
  p.min_amount_minor,
  p.max_amount_minor,
  p.preset_amounts_minor,
  p.valid_until,
  p.is_active,
  p.created_at,
  p.icon,
  p.tone,
  p.category_id,
  p.occasions,
  p.rating,
  p.location,
  p.fulfilment_type,
  p.session_count
from public.products p;

comment on view public.offers is
  'Legacy compatibility view over products. Read-only. New code should use products.';

-- ---------------------------------------------------------------------------
-- The fulfilment rules now live in one place
-- ---------------------------------------------------------------------------
create or replace function public.voucher_fulfilment(p_voucher_id uuid)
returns public.fulfilment_type
language sql
stable
as $$
  select fulfilment_type from public.vouchers where id = p_voucher_id;
$$;

comment on column public.products.fulfilment_type is
  'How this product is fulfilled: monetary, experience or enterprise_code.';
comment on column public.vouchers.fulfilment_type is
  'How this voucher is fulfilled: monetary, experience or enterprise_code.';
comment on column public.products.session_count is
  'Sessions included on an experience product. Null for every other type.';
comment on column public.vouchers.total_sessions is
  'Sessions issued on an experience voucher. Null for every other type.';
