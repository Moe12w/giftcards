-- 0146_marketplace_businesses_gift_count.sql
-- The directory view is used by the mobile home, public site, admin and MCP.
-- Its correlated COUNT subqueries re-scanned products for every business on
-- every read. Pre-aggregate once per owner instead; same columns, same RLS
-- (security_invoker means the product rows still obey the caller's policies).
create or replace view public.marketplace_businesses with (security_invoker = true) as
with vendor_gifts as (
  select vendor_id as owner_id, count(*)::int as gift_count
  from public.products
  where vendor_id is not null and status = 'published'
  group by vendor_id
),
partner_gifts as (
  select partner_id as owner_id, count(*)::int as gift_count
  from public.products
  where partner_id is not null and status = 'published'
  group by partner_id
)
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
  coalesce(vg.gift_count, 0) as gift_count
from public.vendors v
left join vendor_gifts vg on vg.owner_id = v.id
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
  coalesce(pg.gift_count, 0) as gift_count
from public.enterprise_partners ep
left join partner_gifts pg on pg.owner_id = ep.id
where ep.status = 'active';

grant select on public.marketplace_businesses to anon, authenticated, service_role;
