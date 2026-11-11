-- ---------------------------------------------------------------------------
-- Partners are businesses
--
-- A partner (Snoonu, Talabat, Rafeeq) is a business in the marketplace in
-- every way a vendor is: it has its own name, its own logo, its own gifts and
-- its own dashboard. The only differences are the kind of gift it sells and
-- the flow it runs (its own codes, redeemed in its own app).
--
-- These changes make that true in the data:
--   - a catalogue gift can belong to a partner
--   - a partner can have a logo
--   - an active partner is readable by everyone, like an approved vendor
--   - one view lists both kinds of business for the app and the website
--   - a partner can hold API keys, so their system can tell us a code was used
-- ---------------------------------------------------------------------------

-- A gift can belong to a partner business.
alter table public.products
  add column if not exists partner_id uuid references public.enterprise_partners (id) on delete set null;

create index if not exists products_partner_idx on public.products (partner_id);

-- A partner can have a logo and a banner, like a vendor.
alter table public.enterprise_partners
  add column if not exists logo_url text;
alter table public.enterprise_partners
  add column if not exists banner_url text;

-- An active partner is a public business: anyone can see its storefront.
drop policy if exists enterprise_partners_public_read on public.enterprise_partners;
create policy enterprise_partners_public_read on public.enterprise_partners
  for select to public
  using (status = 'active');

-- Keys a partner's own system uses to tell us that a code was used.
create table if not exists public.enterprise_api_keys (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.enterprise_partners (id) on delete cascade,
  label text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists enterprise_api_keys_partner_idx
  on public.enterprise_api_keys (partner_id);

alter table public.enterprise_api_keys enable row level security;

drop policy if exists enterprise_api_keys_read_own on public.enterprise_api_keys;
create policy enterprise_api_keys_read_own on public.enterprise_api_keys
  for select to authenticated
  using (public.can_manage_partner(partner_id) or public.is_admin());

drop policy if exists enterprise_api_keys_write_own on public.enterprise_api_keys;
create policy enterprise_api_keys_write_own on public.enterprise_api_keys
  for insert to authenticated
  with check (public.can_manage_partner(partner_id) or public.is_admin());

drop policy if exists enterprise_api_keys_update_own on public.enterprise_api_keys;
create policy enterprise_api_keys_update_own on public.enterprise_api_keys
  for update to authenticated
  using (public.can_manage_partner(partner_id) or public.is_admin())
  with check (public.can_manage_partner(partner_id) or public.is_admin());

drop policy if exists enterprise_api_keys_delete_own on public.enterprise_api_keys;
create policy enterprise_api_keys_delete_own on public.enterprise_api_keys
  for delete to authenticated
  using (public.can_manage_partner(partner_id) or public.is_admin());

-- One list of businesses for the app and the website: vendors and partners.
create or replace view public.marketplace_businesses with (security_invoker = true) as
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
    0::numeric,
    ep.notes,
    ep.status::text as status,
    (
      select count(*)::int
      from public.products p
      where p.partner_id = ep.id and p.status = 'published'
    ) as gift_count
  from public.enterprise_partners ep
  where ep.status = 'active';
