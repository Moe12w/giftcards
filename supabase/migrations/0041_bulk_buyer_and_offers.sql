-- 0041_bulk_buyer_and_offers.sql
-- Corporate / bulk gift card purchasing foundation.
--
-- Introduces a Business (Bulk Buyer) customer type, vendor-managed bulk offers
-- with tiered pricing, and order/distribution records for bulk purchases.
-- Bulk prices and offers are only readable by approved business buyers, the
-- owning vendor (and its members), and admins.

-- ---------------------------------------------------------------------------
-- 1. Roles and buyer accounts
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'business_buyer'
  ) then
    alter type public.app_role add value 'business_buyer';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'business_account_status') then
    create type public.business_account_status as enum ('pending_approval', 'approved', 'rejected', 'suspended');
  end if;
end $$;

create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  company_name text not null,
  contact_name text not null,
  business_email text not null,
  phone text,
  country text not null default 'Qatar',
  company_registration_number text,
  business_type text,
  status public.business_account_status not null default 'pending_approval',
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_accounts_status_idx on public.business_accounts (status);
create index if not exists business_accounts_user_idx on public.business_accounts (user_id);

create or replace function public.is_approved_business_buyer(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_accounts b
    where b.user_id = p_uid
      and b.status = 'approved'
  );
$$;

-- Convenience: can the current user access bulk buyer features?
create or replace function public.can_access_bulk_buying()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_admin(), false)
      or coalesce(public.is_approved_business_buyer(auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- 2. Bulk offers (vendor-managed, linked to underlying gift card product)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bulk_offer_status') then
    create type public.bulk_offer_status as enum ('draft', 'active', 'paused', 'expired');
  end if;
end $$;

create table if not exists public.bulk_offers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  title text not null,
  description text,
  image_url text,
  face_value_minor bigint not null check (face_value_minor > 0),
  base_unit_price_minor bigint not null check (base_unit_price_minor >= 0),
  currency text not null default 'QAR',
  min_quantity integer not null default 1 check (min_quantity > 0),
  max_quantity integer check (max_quantity is null or max_quantity >= min_quantity),
  available_quantity integer check (available_quantity is null or available_quantity >= 0),
  min_order_value_minor bigint check (min_order_value_minor is null or min_order_value_minor >= 0),
  max_order_value_minor bigint check (max_order_value_minor is null or max_order_value_minor >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  expires_at date,
  delivered_digitally boolean not null default true,
  status public.bulk_offer_status not null default 'draft',
  enabled boolean not null default true,
  additional_conditions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bulk_offer_dates check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists bulk_offers_vendor_idx on public.bulk_offers (vendor_id);
create index if not exists bulk_offers_product_idx on public.bulk_offers (product_id);
create index if not exists bulk_offers_status_idx on public.bulk_offers (status, enabled);

create table if not exists public.bulk_offer_price_tiers (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.bulk_offers(id) on delete cascade,
  min_quantity integer not null check (min_quantity > 0),
  max_quantity integer check (max_quantity is null or max_quantity >= min_quantity),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bulk_offer_price_tiers_offer_idx on public.bulk_offer_price_tiers (offer_id, sort_order, min_quantity);

-- ---------------------------------------------------------------------------
-- 3. Bulk orders and allocations
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bulk_order_status') then
    create type public.bulk_order_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_fulfilled', 'fulfilled');
  end if;
end $$;

create table if not exists public.bulk_orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,
  business_account_id uuid not null references public.business_accounts(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  offer_id uuid not null references public.bulk_offers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  face_value_minor bigint not null check (face_value_minor > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  total_face_value_minor bigint not null check (total_face_value_minor >= 0),
  total_paid_minor bigint not null check (total_paid_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  vendor_payable_minor bigint not null default 0 check (vendor_payable_minor >= 0),
  currency text not null default 'QAR',
  status public.bulk_order_status not null default 'pending',
  payment_status text not null default 'unpaid',
  pricing_tier_snapshot jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bulk_orders_business_idx on public.bulk_orders (business_account_id, created_at desc);
create index if not exists bulk_orders_vendor_idx on public.bulk_orders (vendor_id, created_at desc);
create index if not exists bulk_orders_offer_idx on public.bulk_orders (offer_id);

create table if not exists public.bulk_order_vouchers (
  id uuid primary key default gen_random_uuid(),
  bulk_order_id uuid not null references public.bulk_orders(id) on delete cascade,
  voucher_id uuid references public.vouchers(id) on delete set null,
  voucher_code text,
  recipient_name text,
  recipient_email text,
  delivery_status text not null default 'pending',
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bulk_order_vouchers_order_idx on public.bulk_order_vouchers (bulk_order_id);

-- ---------------------------------------------------------------------------
-- 4. Updated-at triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_business_accounts_updated_at on public.business_accounts;
create trigger trg_business_accounts_updated_at before update on public.business_accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_bulk_offers_updated_at on public.bulk_offers;
create trigger trg_bulk_offers_updated_at before update on public.bulk_offers
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_bulk_orders_updated_at on public.bulk_orders;
create trigger trg_bulk_orders_updated_at before update on public.bulk_orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.business_accounts enable row level security;
alter table public.bulk_offers enable row level security;
alter table public.bulk_offer_price_tiers enable row level security;
alter table public.bulk_orders enable row level security;
alter table public.bulk_order_vouchers enable row level security;

-- Business accounts: owner can read/create/update own pending profile; admin manages all.
drop policy if exists business_accounts_select on public.business_accounts;
create policy business_accounts_select on public.business_accounts
  for select using (
    coalesce(public.is_admin(), false)
    or user_id = auth.uid()
  );

drop policy if exists business_accounts_insert on public.business_accounts;
create policy business_accounts_insert on public.business_accounts
  for insert with check (
    user_id = auth.uid()
  );

drop policy if exists business_accounts_update_owner on public.business_accounts;
create policy business_accounts_update_owner on public.business_accounts
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists business_accounts_admin_all on public.business_accounts;
create policy business_accounts_admin_all on public.business_accounts
  for all using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

-- Bulk offers: only approved business buyers, owning vendor members, or admins can see.
drop policy if exists bulk_offers_select on public.bulk_offers;
create policy bulk_offers_select on public.bulk_offers
  for select using (
    coalesce(public.is_admin(), false)
    or coalesce(public.can_manage_vendor(vendor_id), false)
    or (coalesce(public.can_access_bulk_buying(), false) and enabled = true and status = 'active')
  );

drop policy if exists bulk_offers_vendor_write on public.bulk_offers;
create policy bulk_offers_vendor_write on public.bulk_offers
  for all using (coalesce(public.can_manage_vendor(vendor_id), false) or coalesce(public.is_admin(), false))
  with check (coalesce(public.can_manage_vendor(vendor_id), false) or coalesce(public.is_admin(), false));

-- Tiers follow offer visibility/manageability.
drop policy if exists bulk_offer_price_tiers_select on public.bulk_offer_price_tiers;
create policy bulk_offer_price_tiers_select on public.bulk_offer_price_tiers
  for select using (
    exists (
      select 1 from public.bulk_offers o
      where o.id = offer_id
        and (
          coalesce(public.is_admin(), false)
          or coalesce(public.can_manage_vendor(o.vendor_id), false)
          or (coalesce(public.can_access_bulk_buying(), false) and o.enabled = true and o.status = 'active')
        )
    )
  );

drop policy if exists bulk_offer_price_tiers_write on public.bulk_offer_price_tiers;
create policy bulk_offer_price_tiers_write on public.bulk_offer_price_tiers
  for all using (
    exists (
      select 1 from public.bulk_offers o
      where o.id = offer_id
        and (coalesce(public.can_manage_vendor(o.vendor_id), false) or coalesce(public.is_admin(), false))
    )
  )
  with check (
    exists (
      select 1 from public.bulk_offers o
      where o.id = offer_id
        and (coalesce(public.can_manage_vendor(o.vendor_id), false) or coalesce(public.is_admin(), false))
    )
  );

-- Bulk orders: buyer, vendor, admin.
drop policy if exists bulk_orders_select on public.bulk_orders;
create policy bulk_orders_select on public.bulk_orders
  for select using (
    coalesce(public.is_admin(), false)
    or buyer_user_id = auth.uid()
    or coalesce(public.can_manage_vendor(vendor_id), false)
  );

drop policy if exists bulk_orders_insert on public.bulk_orders;
create policy bulk_orders_insert on public.bulk_orders
  for insert with check (
    buyer_user_id = auth.uid()
    and coalesce(public.is_approved_business_buyer(auth.uid()), false)
  );

drop policy if exists bulk_orders_update on public.bulk_orders;
create policy bulk_orders_update on public.bulk_orders
  for update using (
    coalesce(public.is_admin(), false)
    or buyer_user_id = auth.uid()
    or coalesce(public.can_manage_vendor(vendor_id), false)
  );

-- Allocated vouchers: follow order visibility.
drop policy if exists bulk_order_vouchers_select on public.bulk_order_vouchers;
create policy bulk_order_vouchers_select on public.bulk_order_vouchers
  for select using (
    exists (
      select 1 from public.bulk_orders bo
      where bo.id = bulk_order_id
        and (
          coalesce(public.is_admin(), false)
          or bo.buyer_user_id = auth.uid()
          or coalesce(public.can_manage_vendor(bo.vendor_id), false)
        )
    )
  );

drop policy if exists bulk_order_vouchers_write on public.bulk_order_vouchers;
create policy bulk_order_vouchers_write on public.bulk_order_vouchers
  for all using (
    exists (
      select 1 from public.bulk_orders bo
      where bo.id = bulk_order_id
        and (
          coalesce(public.is_admin(), false)
          or bo.buyer_user_id = auth.uid()
          or coalesce(public.can_manage_vendor(bo.vendor_id), false)
        )
    )
  )
  with check (
    exists (
      select 1 from public.bulk_orders bo
      where bo.id = bulk_order_id
        and (
          coalesce(public.is_admin(), false)
          or bo.buyer_user_id = auth.uid()
          or coalesce(public.can_manage_vendor(bo.vendor_id), false)
        )
    )
  );

-- Grants
grant select, insert, update on public.business_accounts to authenticated;
grant select, insert, update, delete on public.bulk_offers to authenticated;
grant select, insert, update, delete on public.bulk_offer_price_tiers to authenticated;
grant select, insert, update on public.bulk_orders to authenticated;
grant select, insert, update, delete on public.bulk_order_vouchers to authenticated;

-- Admin can manage statuses via standard updates (guarded by RLS policy). For convenience:
create or replace function public.admin_set_business_account_status(
  p_account_id uuid,
  p_status public.business_account_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not allowed';
  end if;

  update public.business_accounts
  set status = p_status,
      decided_at = now(),
      decided_by = auth.uid(),
      decision_note = p_note,
      updated_at = now()
  where id = p_account_id;
end;
$$;

grant execute on function public.admin_set_business_account_status(uuid, public.business_account_status, text) to authenticated;
