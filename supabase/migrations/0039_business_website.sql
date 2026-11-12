-- ---------------------------------------------------------------------------
-- Public business profiles include the website
--
-- The website business page shows a partner's or vendor's site next to the
-- location. The directory view is the single source for both kinds of
-- business, so the field belongs here rather than in a second partner query.
-- ---------------------------------------------------------------------------

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
    v.website,
    v.status::text as status,
    (
      select count(*)::int
      from public.products p
      where p.vendor_id = v.id and p.status = 'published'
    ) as gift_count
  from public.vendors v
  where v.status = 'approved'
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
    coalesce(
      (
        select round(avg(p.rating)::numeric, 1)
        from public.products p
        where p.partner_id = ep.id and p.status = 'published'
      ),
      4.8::numeric
    ) as rating,
    ep.notes,
    ep.website,
    ep.status::text as status,
    (
      select count(*)::int
      from public.products p
      where p.partner_id = ep.id and p.status = 'published'
    ) as gift_count
  from public.enterprise_partners ep
  where ep.status = 'active';

grant select on public.marketplace_businesses to anon, authenticated;
grant all on public.marketplace_businesses to service_role;
