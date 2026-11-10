-- 0015_promotions_and_finance.sql
-- Featured placements, promotional campaigns, and the money structures that
-- payment processing and settlement will use later.
--
-- The finance tables are created now so the shape is settled, but nothing in
-- this phase writes to them.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.campaign_kind as enum (
    'banner',
    'featured_vendor',
    'featured_product',
    'category_placement',
    'homepage_placement'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum (
    'draft',
    'scheduled',
    'live',
    'ended'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Campaigns and placements
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.campaign_kind not null,
  status public.campaign_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  target_segment jsonb not null default '{}'::jsonb,
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists campaigns_live_idx
  on public.campaigns (status, starts_at, ends_at);

create table if not exists public.campaign_placements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  placement text not null check (placement in ('homepage', 'category', 'vendor_page', 'search')),
  entity_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists campaign_placements_campaign_idx
  on public.campaign_placements (campaign_id, placement, sort_order);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  title text not null,
  subtitle text,
  image_url text,
  cta_label text,
  cta_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Future money structures (structure only in this phase)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  provider_reference text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'QAR',
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create unique index if not exists payment_transactions_provider_ref_idx
  on public.payment_transactions (provider, provider_reference)
  where provider_reference is not null;

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_transaction_id uuid references public.payment_transactions (id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.vendor_commissions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  sale_minor bigint not null,
  commission_bps integer not null check (commission_bps between 0 and 10000),
  commission_minor bigint not null,
  vendor_share_minor bigint not null,
  status text not null default 'accrued' check (status in ('accrued', 'payable', 'paid', 'reversed')),
  created_at timestamptz not null default now()
);

create index if not exists vendor_commissions_vendor_idx
  on public.vendor_commissions (vendor_id, status);

create table if not exists public.platform_fees (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  fee_kind text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'QAR',
  created_at timestamptz not null default now()
);

create table if not exists public.partner_settlements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.enterprise_partners (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_minor bigint not null default 0,
  commission_minor bigint not null default 0,
  net_minor bigint not null default 0,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'void')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.financial_ledger (
  id bigint generated always as identity primary key,
  entry_type text not null,
  vendor_id uuid references public.vendors (id) on delete set null,
  partner_id uuid references public.enterprise_partners (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  amount_minor bigint not null,
  currency text not null default 'QAR',
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_order_idx on public.financial_ledger (order_id);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists webhook_events_provider_event_idx
  on public.webhook_events (provider, event_id);

-- ---------------------------------------------------------------------------
-- A campaign may not be live outside its window.
-- ---------------------------------------------------------------------------
create or replace function public.campaign_is_live(p_campaign_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = p_campaign_id
      and c.status = 'live'
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at >= now())
  );
$$;
