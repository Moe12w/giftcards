-- 0016_customer_data.sql
-- Customer-owned data that the app currently keeps in mock arrays:
-- saved recipients, saved payment methods, favourites and business locations.

-- ---------------------------------------------------------------------------
-- recipients
-- ---------------------------------------------------------------------------
create table if not exists public.recipients (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  relation text,
  created_at timestamptz not null default now()
);

create index if not exists recipients_customer_idx on public.recipients (customer_id);

-- ---------------------------------------------------------------------------
-- payment_methods: a token reference only, never a card number.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'card',
  provider_token text,
  brand text,
  last4 text,
  expiry text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists payment_methods_customer_idx
  on public.payment_methods (customer_id);

-- ---------------------------------------------------------------------------
-- favourites
-- ---------------------------------------------------------------------------
create table if not exists public.favourites (
  customer_id uuid not null references auth.users (id) on delete cascade,
  vendor_id uuid references public.vendors (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, vendor_id, product_id),
  constraint favourites_one_target check (
    (vendor_id is not null and product_id is null)
    or (vendor_id is null and product_id is not null)
  )
);

create index if not exists favourites_product_idx on public.favourites (product_id);
create index if not exists favourites_vendor_idx on public.favourites (vendor_id);

-- ---------------------------------------------------------------------------
-- vendor_locations: the branches shown on a business page.
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_locations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  area text,
  address text,
  hours text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists vendor_locations_vendor_idx on public.vendor_locations (vendor_id);

-- ---------------------------------------------------------------------------
-- Notifications preferences live with the user.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gift_updates boolean not null default true,
  promotions boolean not null default true,
  expiry_reminders boolean not null default true,
  email boolean not null default true,
  push boolean not null default true,
  sms boolean not null default false,
  updated_at timestamptz not null default now()
);
