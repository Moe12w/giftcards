-- 0001_initial_schema.sql
-- Gift Card Marketplace — core schema.
-- Money is stored as bigint minor units (fils). Balances are derived from
-- ledger_entries, never stored as an editable number.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type vendor_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type card_status as enum ('issued', 'claimed', 'redeemed', 'expired', 'voided');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_entry_type as enum ('issue', 'redeem', 'refund', 'void');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ar')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  name_ar text,
  description text,
  logo_url text,
  status vendor_status not null default 'pending',
  -- 1000 bps = 10%
  commission_bps integer not null default 0 check (commission_bps between 0 and 10000),
  -- Caps outstanding unredeemed value for this vendor.
  max_unredeemed_minor bigint not null default 0 check (max_unredeemed_minor >= 0),
  -- MyFatoorah supplier/submerchant reference (server-side only usage).
  myfatoorah_supplier_code text,
  created_at timestamptz not null default now()
);

create index if not exists vendors_owner_idx on public.vendors (owner_id);
create index if not exists vendors_status_idx on public.vendors (status);

-- ---------------------------------------------------------------------------
-- vendor_documents
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  doc_type text not null,
  file_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists vendor_documents_vendor_idx on public.vendor_documents (vendor_id);

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  title text not null,
  title_ar text,
  description text,
  image_url text,
  min_amount_minor bigint not null check (min_amount_minor > 0),
  max_amount_minor bigint not null check (max_amount_minor > 0),
  preset_amounts_minor bigint[] not null default '{}',
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint offers_amount_range check (min_amount_minor <= max_amount_minor)
);

create index if not exists offers_vendor_idx on public.offers (vendor_id);
create index if not exists offers_active_idx on public.offers (is_active) where is_active;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  offer_id uuid not null references public.offers (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  commission_minor bigint not null default 0 check (commission_minor >= 0),
  vendor_share_minor bigint not null default 0 check (vendor_share_minor >= 0),
  status order_status not null default 'pending',
  -- Unique per payment provider event. Prevents double-issuing cards.
  payment_reference text not null unique,
  created_at timestamptz not null default now(),
  constraint orders_split_matches check (amount_minor = commission_minor + vendor_share_minor)
);

create index if not exists orders_buyer_idx on public.orders (buyer_id);
create index if not exists orders_offer_idx on public.orders (offer_id);

-- ---------------------------------------------------------------------------
-- gift_cards
-- ---------------------------------------------------------------------------
create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  buyer_id uuid references public.profiles (id) on delete set null,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  original_value_minor bigint not null check (original_value_minor > 0),
  status card_status not null default 'issued',
  -- Only the SHA-256 hash of the claim token is stored.
  claim_token_hash text unique,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists gift_cards_offer_idx on public.gift_cards (offer_id);
create index if not exists gift_cards_buyer_idx on public.gift_cards (buyer_id);
create index if not exists gift_cards_claimed_by_idx on public.gift_cards (claimed_by);
create index if not exists gift_cards_status_idx on public.gift_cards (status);

-- ---------------------------------------------------------------------------
-- ledger_entries (append-only, signed minor units)
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.gift_cards (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  entry_type ledger_entry_type not null,
  -- Positive increases balance, negative decreases it.
  amount_minor bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_entries_card_idx on public.ledger_entries (card_id);

-- ---------------------------------------------------------------------------
-- payouts
-- ---------------------------------------------------------------------------
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  myfatoorah_ref text,
  created_at timestamptz not null default now()
);

create index if not exists payouts_vendor_idx on public.payouts (vendor_id);

-- ---------------------------------------------------------------------------
-- payment_events (idempotency log)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'myfatoorah',
  event_id text not null unique,
  order_id uuid references public.orders (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- admin_actions (audit log)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete restrict,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_admin_idx on public.admin_actions (admin_id);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

-- ---------------------------------------------------------------------------
-- Derived balance view
-- ---------------------------------------------------------------------------
create or replace view public.card_balances
with (security_invoker = true) as
select
  c.id as card_id,
  coalesce(sum(le.amount_minor), 0)::bigint as balance_minor
from public.gift_cards c
left join public.ledger_entries le on le.card_id = c.id
group by c.id;
