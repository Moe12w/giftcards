-- 0011_product_catalogue.sql
-- The shared gift-card catalogue.
--
-- `offers` becomes `products` — one catalogue for all three fulfilment types.
-- Denominations and session packages live in `product_variants` so a card with
-- several price points is one product with several SKUs, not several products.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.fulfilment_type as enum (
    'monetary',
    'experience',
    'enterprise_code'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_status as enum (
    'draft',
    'published',
    'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.variant_kind as enum (
    'denomination',
    'package'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- vendors: the business profile the customer app and the website render
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists slug text unique;
alter table public.vendors
  add column if not exists banner_url text;
alter table public.vendors
  add column if not exists cover_url text;
alter table public.vendors
  add column if not exists category_id uuid references public.categories (id) on delete set null;
alter table public.vendors
  add column if not exists city text;
alter table public.vendors
  add column if not exists area text;
alter table public.vendors
  add column if not exists address text;
alter table public.vendors
  add column if not exists latitude numeric(9, 6);
alter table public.vendors
  add column if not exists longitude numeric(9, 6);
alter table public.vendors
  add column if not exists website text;
alter table public.vendors
  add column if not exists phone text;
alter table public.vendors
  add column if not exists email text;
alter table public.vendors
  add column if not exists social_handle text;
alter table public.vendors
  add column if not exists rating numeric(2, 1) not null default 4.8;
alter table public.vendors
  add column if not exists is_featured boolean not null default false;
alter table public.vendors
  add column if not exists approved_at timestamptz;
alter table public.vendors
  add column if not exists updated_at timestamptz not null default now();

create index if not exists vendors_featured_idx on public.vendors (is_featured) where is_featured;
create index if not exists vendors_status_idx2 on public.vendors (status);

-- ---------------------------------------------------------------------------
-- enterprise_products: a partner's catalogue, before it becomes a marketplace
-- product. (The code inventory itself lands in 0014.)
-- ---------------------------------------------------------------------------
create table if not exists public.enterprise_products (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.enterprise_partners (id) on delete cascade,
  name text not null,
  external_ref text,
  denomination_minor bigint not null check (denomination_minor > 0),
  currency text not null default 'QAR',
  selling_price_minor bigint not null check (selling_price_minor > 0),
  wholesale_cost_minor bigint check (wholesale_cost_minor is null or wholesale_cost_minor >= 0),
  commission_bps integer not null default 0 check (commission_bps between 0 and 10000),
  terms_and_conditions text,
  redemption_instructions text,
  expiry_days integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enterprise_products_partner_idx
  on public.enterprise_products (partner_id, is_active);

-- ---------------------------------------------------------------------------
-- offers -> products
-- ---------------------------------------------------------------------------
alter table public.offers rename to products;

alter table public.products
  add column if not exists slug text;
alter table public.products
  add column if not exists fulfilment_type public.fulfilment_type not null default 'monetary';
alter table public.products
  add column if not exists category_id uuid references public.categories (id) on delete set null;
alter table public.products
  add column if not exists enterprise_product_id uuid references public.enterprise_products (id) on delete cascade;
alter table public.products
  add column if not exists session_count integer;
alter table public.products
  add column if not exists terms_and_conditions text;
alter table public.products
  add column if not exists redemption_instructions text;
alter table public.products
  add column if not exists booking_required boolean not null default false;
alter table public.products
  add column if not exists split_session_allowed boolean not null default true;
alter table public.products
  add column if not exists multi_session_per_visit boolean not null default true;
alter table public.products
  add column if not exists currency text not null default 'QAR';
alter table public.products
  add column if not exists expiry_days integer;
alter table public.products
  add column if not exists status public.product_status not null default 'draft';
alter table public.products
  add column if not exists icon text;
alter table public.products
  add column if not exists tone text;
alter table public.products
  add column if not exists rating numeric(2, 1) not null default 4.8;
alter table public.products
  add column if not exists location text;
alter table public.products
  add column if not exists occasions text[] not null default '{}';
alter table public.products
  add column if not exists updated_at timestamptz not null default now();

-- The fulfilment type decides the shape of the product.
alter table public.products
  drop constraint if exists products_fulfilment_shape;

alter table public.products
  add constraint products_fulfilment_shape check (
    (fulfilment_type = 'monetary' and session_count is null) or
    (fulfilment_type = 'experience' and session_count is not null and session_count > 0) or
    (fulfilment_type = 'enterprise_code' and enterprise_product_id is not null and vendor_id is null)
  );

-- Only an approved vendor may own a marketplace product.
alter table public.products
  drop constraint if exists products_owner_shape;

alter table public.products
  add constraint products_owner_shape check (
    (fulfilment_type = 'enterprise_code' and vendor_id is null and enterprise_product_id is not null)
    or (fulfilment_type <> 'enterprise_code' and vendor_id is not null)
  );

create unique index if not exists products_slug_idx
  on public.products (slug) where slug is not null;
create index if not exists products_fulfilment_idx on public.products (fulfilment_type);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_status_idx on public.products (status, is_active);
create index if not exists products_occasions_idx on public.products using gin (occasions);
create index if not exists products_vendor_idx2 on public.products (vendor_id);

-- ---------------------------------------------------------------------------
-- product_variants: denominations and packages
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  kind public.variant_kind not null,
  label text not null,
  -- Monetary denominations.
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  -- Experience packages: how many sessions this variant grants.
  session_count integer check (session_count is null or session_count > 0),
  price_minor bigint not null check (price_minor > 0),
  currency text not null default 'QAR',
  terms_and_conditions text,
  redemption_instructions text,
  booking_required boolean not null default false,
  split_session_allowed boolean not null default true,
  multi_session_per_visit boolean not null default true,
  expiry_days integer,
  valid_until timestamptz,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_shape check (
    (kind = 'denomination' and amount_minor is not null and session_count is null) or
    (kind = 'package' and session_count is not null and amount_minor is null)
  )
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, active, sort_order);

-- ---------------------------------------------------------------------------
-- Denominations must not overlap inside one product.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_duplicate_denomination()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.product_variants v
    where v.product_id = new.product_id
      and v.id <> new.id
      and v.active
      and v.kind = new.kind
      and v.amount_minor is not distinct from new.amount_minor
      and v.session_count is not distinct from new.session_count
  ) then
    raise exception 'duplicate denomination or package for this product';
  end if;
  return new;
end;
$$;

drop trigger if exists product_variants_no_duplicates on public.product_variants;
create trigger product_variants_no_duplicates
  before insert or update on public.product_variants
  for each row execute function public.prevent_duplicate_denomination();

-- ---------------------------------------------------------------------------
-- Backfill slugs for the existing catalogue so URLs are stable.
-- ---------------------------------------------------------------------------
update public.products
set slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;

-- ---------------------------------------------------------------------------
-- Compatibility view: legacy readers keep using `offers`.
-- New code should read `products` directly.
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
  p.redemption_mode,
  p.session_count
from public.products p;

comment on view public.offers is
  'Legacy compatibility view over products. Read-only. New code should use products.';

-- ---------------------------------------------------------------------------
-- Publish rules and catalogue policies
-- ---------------------------------------------------------------------------
drop policy if exists offers_select_public on public.products;
create policy products_select_public on public.products
  for select using (
    (
      is_active
      and status = 'published'
      and (
        exists (
          select 1 from public.vendors v
          where v.id = products.vendor_id and v.status = 'approved'
        )
        or fulfilment_type = 'enterprise_code'
      )
    )
    or vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active
    )
    or public.is_admin()
  );

drop policy if exists offers_insert_vendor on public.products;
create policy products_insert_vendor on public.products
  for insert with check (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
    )
    or public.is_admin()
  );

drop policy if exists offers_update_vendor on public.products;
create policy products_update_vendor on public.products
  for update using (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
    )
    or public.is_admin()
  ) with check (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
    )
    or public.is_admin()
  );

drop policy if exists offers_delete_vendor on public.products;
create policy products_delete_vendor on public.products
  for delete using (
    vendor_id in (
      select vm.vendor_id from public.vendor_members vm
      where vm.user_id = auth.uid() and vm.active and vm.role = 'owner'
    )
    or public.is_admin()
  );

-- Enterprise products are managed by their partner.
drop policy if exists products_enterprise_partner on public.products;
create policy products_enterprise_partner on public.products
  for all using (
    enterprise_product_id in (
      select ep.id from public.enterprise_products ep
      where ep.partner_id in (
        select em.partner_id from public.enterprise_members em
        where em.user_id = auth.uid() and em.active
      )
    )
    or public.is_admin()
  ) with check (
    enterprise_product_id in (
      select ep.id from public.enterprise_products ep
      where ep.partner_id in (
        select em.partner_id from public.enterprise_members em
        where em.user_id = auth.uid() and em.active
      )
    )
    or public.is_admin()
  );

alter table public.product_variants enable row level security;

drop policy if exists product_variants_select on public.product_variants;
create policy product_variants_select on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_variants.product_id)
    or public.is_admin()
  );

drop policy if exists product_variants_write on public.product_variants;
create policy product_variants_write on public.product_variants
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (
          p.vendor_id in (
            select vm.vendor_id from public.vendor_members vm
            where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
          )
          or public.is_admin()
        )
    )
  ) with check (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (
          p.vendor_id in (
            select vm.vendor_id from public.vendor_members vm
            where vm.user_id = auth.uid() and vm.active and vm.role in ('owner', 'manager')
          )
          or public.is_admin()
        )
    )
  );
