-- 0044_advertising_system.sql
-- Advertising & promotions: schema, RLS and default configuration.
--
-- This is deliberately additive. It does not touch gift-card purchasing,
-- orders, payments, vouchers or vendor finance. Advertising money lives in its
-- own transaction and ledger tables.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.advertising_placement_kind as enum (
    'homepage_hero_carousel',
    'homepage_featured_business',
    'homepage_featured_gift_card',
    'homepage_featured_category',
    'marketplace_sponsored_card',
    'marketplace_sponsored_business',
    'marketplace_category_position',
    'search_sponsored_result',
    'trending_placement',
    'discovery_placement'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.advertising_pricing_model as enum ('fixed', 'cpc', 'cpm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.advertising_campaign_status as enum (
    'draft',
    'pending_payment',
    'pending_approval',
    'scheduled',
    'active',
    'paused',
    'budget_exhausted',
    'completed',
    'rejected',
    'cancelled',
    'refunded'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Advertiser privilege on the existing vendor account
-- ---------------------------------------------------------------------------

alter table public.vendors
  add column if not exists advertising_enabled boolean not null default true,
  add column if not exists advertising_verified boolean not null default true,
  add column if not exists advertising_suspended_at timestamptz,
  add column if not exists advertising_suspended_reason text;

-- ---------------------------------------------------------------------------
-- 3. Placements
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_placements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  kind public.advertising_placement_kind not null,
  name text not null,
  name_ar text,
  description text,
  description_ar text,
  format text not null default 'banner'
    check (format in ('banner', 'carousel', 'native', 'card')),
  is_active boolean not null default true,
  supports_carousel boolean not null default false,
  slot_count integer not null default 0 check (slot_count >= 0),
  max_active_campaigns integer not null default 0 check (max_active_campaigns >= 0),
  rotation_mode text not null default 'shared'
    check (rotation_mode in ('fixed', 'shared', 'auction')),
  auction_enabled boolean not null default true,
  priority integer not null default 0,
  sort_order integer not null default 0,
  creative_width integer,
  creative_height integer,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advertising_placements_active_idx
  on public.advertising_placements (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- 4. Pricing (versioned, never retroactive)
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_pricing (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.advertising_placements(id) on delete cascade,
  pricing_model public.advertising_pricing_model not null,
  currency text not null default 'QAR',
  fixed_price_minor bigint not null default 0 check (fixed_price_minor >= 0),
  cpc_rate_minor bigint not null default 0 check (cpc_rate_minor >= 0),
  cpm_rate_minor bigint not null default 0 check (cpm_rate_minor >= 0),
  min_duration_days integer not null default 1 check (min_duration_days > 0),
  max_duration_days integer not null default 365 check (max_duration_days >= min_duration_days),
  default_duration_days integer not null default 30
    check (default_duration_days between min_duration_days and max_duration_days),
  min_budget_minor bigint not null default 0 check (min_budget_minor >= 0),
  max_budget_minor bigint check (max_budget_minor is null or max_budget_minor >= min_budget_minor),
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 10000),
  tax_bps integer not null default 0 check (tax_bps between 0 and 10000),
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists advertising_pricing_one_active_idx
  on public.advertising_pricing (placement_id, pricing_model)
  where is_active;

create index if not exists advertising_pricing_placement_idx
  on public.advertising_pricing (placement_id, is_active);

-- ---------------------------------------------------------------------------
-- 5. Campaigns
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_ref text not null unique
    default ('ADV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  vendor_id uuid references public.vendors(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  placement_id uuid not null references public.advertising_placements(id) on delete restrict,
  placement_key text not null,
  pricing_id uuid references public.advertising_pricing(id) on delete set null,
  pricing_model public.advertising_pricing_model not null,
  currency text not null default 'QAR',
  name text not null,
  status public.advertising_campaign_status not null default 'draft',
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  payment_reference text,
  payment_provider text,
  quote_amount_minor bigint not null default 0 check (quote_amount_minor >= 0),
  fixed_price_minor bigint not null default 0 check (fixed_price_minor >= 0),
  cpc_rate_minor bigint not null default 0 check (cpc_rate_minor >= 0),
  cpm_rate_minor bigint not null default 0 check (cpm_rate_minor >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  priority integer not null default 0,
  rotation_weight integer not null default 100 check (rotation_weight > 0),
  frequency_cap_impressions integer not null default 0 check (frequency_cap_impressions >= 0),
  frequency_cap_window_minutes integer not null default 0 check (frequency_cap_window_minutes >= 0),
  total_budget_minor bigint not null default 0 check (total_budget_minor >= 0),
  daily_budget_minor bigint not null default 0 check (daily_budget_minor >= 0),
  auto_renew boolean not null default false,
  auto_renew_authorized_at timestamptz,
  renewal_count integer not null default 0 check (renewal_count >= 0),
  renewed_from_campaign_id uuid references public.advertising_campaigns(id) on delete set null,
  auto_renewed_at timestamptz,
  capacity_override boolean not null default false,
  eligibility_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  paused_at timestamptz,
  pause_reason text,
  auto_resume_at timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  last_served_at timestamptz,
  last_evaluated_at timestamptz,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertising_campaign_dates check (ends_at > starts_at)
);

create unique index if not exists advertising_campaigns_renewed_from_idx
  on public.advertising_campaigns (renewed_from_campaign_id)
  where renewed_from_campaign_id is not null;

create index if not exists advertising_campaigns_vendor_idx
  on public.advertising_campaigns (vendor_id, status, created_at desc);

create index if not exists advertising_campaigns_placement_idx
  on public.advertising_campaigns (placement_id, status, starts_at, ends_at);

create index if not exists advertising_campaigns_status_idx
  on public.advertising_campaigns (status, starts_at, ends_at);

create index if not exists advertising_campaigns_payment_ref_idx
  on public.advertising_campaigns (payment_reference)
  where payment_reference is not null;

-- ---------------------------------------------------------------------------
-- 6. Creatives
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.advertising_campaigns(id) on delete cascade,
  type text not null default 'image' check (type in ('image', 'native', 'html')),
  headline text not null,
  headline_ar text,
  body text,
  body_ar text,
  image_url text,
  mobile_image_url text,
  image_alt text,
  image_alt_ar text,
  cta_label text,
  cta_label_ar text,
  destination_type text not null default 'url'
    check (destination_type in ('url', 'business', 'gift_card', 'category', 'internal')),
  destination_id uuid,
  destination_url text,
  sponsored_label text not null default 'Sponsored',
  sponsored_label_ar text not null default 'إعلان مدفوع',
  status text not null default 'active' check (status in ('active', 'paused', 'rejected')),
  rejection_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advertising_creatives_campaign_idx
  on public.advertising_creatives (campaign_id, status, sort_order);

-- ---------------------------------------------------------------------------
-- 7. Budgets
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_campaign_budgets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.advertising_campaigns(id) on delete cascade,
  total_budget_minor bigint not null default 0 check (total_budget_minor >= 0),
  daily_budget_minor bigint not null default 0 check (daily_budget_minor >= 0),
  spent_minor bigint not null default 0 check (spent_minor >= 0),
  daily_spent_minor bigint not null default 0 check (daily_spent_minor >= 0),
  daily_spent_date date not null default current_date,
  currency text not null default 'QAR',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Transactions and the separate advertising ledger
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.advertising_campaigns(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  kind text not null
    check (kind in ('payment', 'fixed_charge', 'cpc_charge', 'cpm_charge', 'refund', 'credit', 'renewal', 'adjustment')),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'refunded', 'void')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'QAR',
  provider text,
  provider_reference text,
  idempotency_key text not null unique,
  description text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists advertising_transactions_provider_ref_idx
  on public.advertising_transactions (provider, provider_reference)
  where provider_reference is not null;

create index if not exists advertising_transactions_campaign_idx
  on public.advertising_transactions (campaign_id, created_at desc);

create index if not exists advertising_transactions_vendor_idx
  on public.advertising_transactions (vendor_id, created_at desc);

create table if not exists public.advertising_ledger_entries (
  id bigint generated always as identity primary key,
  transaction_id uuid references public.advertising_transactions(id) on delete set null,
  campaign_id uuid references public.advertising_campaigns(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  entry_type text not null,
  entry_key text not null unique,
  direction text not null check (direction in ('debit', 'credit')),
  amount_minor bigint not null,
  balance_after_minor bigint,
  currency text not null default 'QAR',
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists advertising_ledger_campaign_idx
  on public.advertising_ledger_entries (campaign_id, created_at desc);

create index if not exists advertising_ledger_vendor_idx
  on public.advertising_ledger_entries (vendor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. Delivery tracking
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_impressions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.advertising_campaigns(id) on delete cascade,
  creative_id uuid references public.advertising_creatives(id) on delete set null,
  placement_id uuid not null references public.advertising_placements(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  viewer_key text,
  session_id text,
  request_id text not null unique,
  cost_minor bigint not null default 0 check (cost_minor >= 0),
  billed boolean not null default false,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  served_at timestamptz not null default now()
);

create index if not exists advertising_impressions_campaign_idx
  on public.advertising_impressions (campaign_id, served_at desc);

create index if not exists advertising_impressions_placement_idx
  on public.advertising_impressions (placement_id, served_at desc);

create index if not exists advertising_impressions_viewer_idx
  on public.advertising_impressions (viewer_key, campaign_id, served_at desc);

create table if not exists public.advertising_clicks (
  id uuid primary key default gen_random_uuid(),
  impression_id uuid references public.advertising_impressions(id) on delete set null,
  campaign_id uuid not null references public.advertising_campaigns(id) on delete cascade,
  creative_id uuid references public.advertising_creatives(id) on delete set null,
  placement_id uuid not null references public.advertising_placements(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  viewer_key text,
  session_id text,
  request_id text not null unique,
  cost_minor bigint not null default 0 check (cost_minor >= 0),
  billed boolean not null default false,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  clicked_at timestamptz not null default now()
);

create index if not exists advertising_clicks_campaign_idx
  on public.advertising_clicks (campaign_id, clicked_at desc);

create index if not exists advertising_clicks_impression_idx
  on public.advertising_clicks (impression_id);

create table if not exists public.advertising_conversions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.advertising_campaigns(id) on delete cascade,
  creative_id uuid references public.advertising_creatives(id) on delete set null,
  click_id uuid references public.advertising_clicks(id) on delete set null,
  impression_id uuid references public.advertising_impressions(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  voucher_id uuid references public.vouchers(id) on delete set null,
  conversion_type text not null default 'purchase',
  value_minor bigint not null default 0 check (value_minor >= 0),
  currency text not null default 'QAR',
  request_id text not null unique,
  attribution_window_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  attributed_at timestamptz not null default now()
);

create index if not exists advertising_conversions_campaign_idx
  on public.advertising_conversions (campaign_id, attributed_at desc);

create index if not exists advertising_conversions_vendor_idx
  on public.advertising_conversions (vendor_id, attributed_at desc);

-- ---------------------------------------------------------------------------
-- 10. Approvals, rules, inventory, credits
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_approvals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.advertising_campaigns(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  note text,
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists advertising_approvals_campaign_idx
  on public.advertising_approvals (campaign_id, created_at desc);

create table if not exists public.advertising_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  value jsonb not null,
  value_type text not null default 'json'
    check (value_type in ('boolean', 'integer', 'number', 'string', 'json')),
  scope text not null default 'global' check (scope in ('global', 'placement', 'vendor')),
  scope_id uuid,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advertising_inventory (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.advertising_placements(id) on delete cascade,
  campaign_id uuid references public.advertising_campaigns(id) on delete set null,
  slot_index integer,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'occupied', 'released', 'blocked')),
  capacity_override boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists advertising_inventory_campaign_idx
  on public.advertising_inventory (campaign_id)
  where campaign_id is not null;

create index if not exists advertising_inventory_slot_idx
  on public.advertising_inventory (placement_id, slot_index, status);

create table if not exists public.advertising_promotional_credits (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  remaining_minor bigint not null check (remaining_minor >= 0),
  currency text not null default 'QAR',
  source text not null default 'admin_grant',
  status text not null default 'available'
    check (status in ('available', 'used', 'expired', 'revoked')),
  expires_at timestamptz,
  note text,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advertising_credits_vendor_idx
  on public.advertising_promotional_credits (vendor_id, status, expires_at);

-- ---------------------------------------------------------------------------
-- 11. Notifications, audit and daily rollups
-- ---------------------------------------------------------------------------

create table if not exists public.advertising_notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'vendor' check (audience in ('vendor', 'admin')),
  vendor_id uuid references public.vendors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  campaign_id uuid references public.advertising_campaigns(id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists advertising_notifications_audience_idx
  on public.advertising_notifications (audience, read_at, created_at desc);

create index if not exists advertising_notifications_vendor_idx
  on public.advertising_notifications (vendor_id, created_at desc);

create table if not exists public.advertising_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists advertising_audit_entity_idx
  on public.advertising_audit_logs (entity_type, entity_id, created_at desc);

create table if not exists public.advertising_daily_stats (
  campaign_id uuid not null references public.advertising_campaigns(id) on delete cascade,
  stat_date date not null,
  placement_id uuid references public.advertising_placements(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions bigint not null default 0,
  spend_minor bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, stat_date)
);

create index if not exists advertising_daily_stats_vendor_idx
  on public.advertising_daily_stats (vendor_id, stat_date desc);

-- ---------------------------------------------------------------------------
-- 12. RLS helpers
-- ---------------------------------------------------------------------------

create or replace function public.advertising_can_view_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_admin(), false)
      or (p_vendor_id is not null and coalesce(public.is_vendor_member(p_vendor_id), false));
$$;

create or replace function public.advertising_can_view_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.advertising_campaigns c
    where c.id = p_campaign_id
      and public.advertising_can_view_vendor(c.vendor_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- 13. RLS
-- ---------------------------------------------------------------------------

alter table public.advertising_placements enable row level security;
alter table public.advertising_pricing enable row level security;
alter table public.advertising_campaigns enable row level security;
alter table public.advertising_creatives enable row level security;
alter table public.advertising_campaign_budgets enable row level security;
alter table public.advertising_transactions enable row level security;
alter table public.advertising_ledger_entries enable row level security;
alter table public.advertising_impressions enable row level security;
alter table public.advertising_clicks enable row level security;
alter table public.advertising_conversions enable row level security;
alter table public.advertising_approvals enable row level security;
alter table public.advertising_rules enable row level security;
alter table public.advertising_inventory enable row level security;
alter table public.advertising_promotional_credits enable row level security;
alter table public.advertising_notifications enable row level security;
alter table public.advertising_audit_logs enable row level security;
alter table public.advertising_daily_stats enable row level security;

-- Placements: everyone can read live placements; admins manage.
drop policy if exists advertising_placements_select on public.advertising_placements;
create policy advertising_placements_select on public.advertising_placements
  for select using (is_active or public.is_admin());
drop policy if exists advertising_placements_admin on public.advertising_placements;
create policy advertising_placements_admin on public.advertising_placements
  for all using (public.is_admin()) with check (public.is_admin());

-- Pricing: signed-in vendors can see live prices; admins manage.
drop policy if exists advertising_pricing_select on public.advertising_pricing;
create policy advertising_pricing_select on public.advertising_pricing
  for select using ((is_active and auth.uid() is not null) or public.is_admin());
drop policy if exists advertising_pricing_admin on public.advertising_pricing;
create policy advertising_pricing_admin on public.advertising_pricing
  for all using (public.is_admin()) with check (public.is_admin());

-- Campaigns: vendor members see their own; admins see all. Writes go through
-- security-definer functions, except direct admin edits.
drop policy if exists advertising_campaigns_select on public.advertising_campaigns;
create policy advertising_campaigns_select on public.advertising_campaigns
  for select using (public.advertising_can_view_vendor(vendor_id));
drop policy if exists advertising_campaigns_admin on public.advertising_campaigns;
create policy advertising_campaigns_admin on public.advertising_campaigns
  for all using (public.is_admin()) with check (public.is_admin());

-- Creatives.
drop policy if exists advertising_creatives_select on public.advertising_creatives;
create policy advertising_creatives_select on public.advertising_creatives
  for select using (public.advertising_can_view_campaign(campaign_id));
drop policy if exists advertising_creatives_admin on public.advertising_creatives;
create policy advertising_creatives_admin on public.advertising_creatives
  for all using (public.is_admin()) with check (public.is_admin());

-- Budgets.
drop policy if exists advertising_budgets_select on public.advertising_campaign_budgets;
create policy advertising_budgets_select on public.advertising_campaign_budgets
  for select using (public.advertising_can_view_campaign(campaign_id));
drop policy if exists advertising_budgets_admin on public.advertising_campaign_budgets;
create policy advertising_budgets_admin on public.advertising_campaign_budgets
  for all using (public.is_admin()) with check (public.is_admin());

-- Transactions.
drop policy if exists advertising_transactions_select on public.advertising_transactions;
create policy advertising_transactions_select on public.advertising_transactions
  for select using (public.advertising_can_view_vendor(vendor_id));
drop policy if exists advertising_transactions_admin on public.advertising_transactions;
create policy advertising_transactions_admin on public.advertising_transactions
  for all using (public.is_admin()) with check (public.is_admin());

-- Ledger.
drop policy if exists advertising_ledger_select on public.advertising_ledger_entries;
create policy advertising_ledger_select on public.advertising_ledger_entries
  for select using (public.advertising_can_view_vendor(vendor_id));
drop policy if exists advertising_ledger_admin on public.advertising_ledger_entries;
create policy advertising_ledger_admin on public.advertising_ledger_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- Impressions, clicks, conversions.
drop policy if exists advertising_impressions_select on public.advertising_impressions;
create policy advertising_impressions_select on public.advertising_impressions
  for select using (public.advertising_can_view_vendor(vendor_id));
drop policy if exists advertising_impressions_admin on public.advertising_impressions;
create policy advertising_impressions_admin on public.advertising_impressions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists advertising_clicks_select on public.advertising_clicks;
create policy advertising_clicks_select on public.advertising_clicks
  for select using (public.advertising_can_view_vendor(vendor_id));
drop policy if exists advertising_clicks_admin on public.advertising_clicks;
create policy advertising_clicks_admin on public.advertising_clicks
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists advertising_conversions_select on public.advertising_conversions;
create policy advertising_conversions_select on public.advertising_conversions
  for select using (public.advertising_can_view_vendor(vendor_id));
drop policy if exists advertising_conversions_admin on public.advertising_conversions;
create policy advertising_conversions_admin on public.advertising_conversions
  for all using (public.is_admin()) with check (public.is_admin());

-- Approvals.
drop policy if exists advertising_approvals_select on public.advertising_approvals;
create policy advertising_approvals_select on public.advertising_approvals
  for select using (public.advertising_can_view_campaign(campaign_id));
drop policy if exists advertising_approvals_admin on public.advertising_approvals;
create policy advertising_approvals_admin on public.advertising_approvals
  for all using (public.is_admin()) with check (public.is_admin());

-- Rules: everyone reads active rules; admins manage.
drop policy if exists advertising_rules_select on public.advertising_rules;
create policy advertising_rules_select on public.advertising_rules
  for select using (is_active or public.is_admin());
drop policy if exists advertising_rules_admin on public.advertising_rules;
create policy advertising_rules_admin on public.advertising_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- Inventory.
drop policy if exists advertising_inventory_select on public.advertising_inventory;
create policy advertising_inventory_select on public.advertising_inventory
  for select using (public.is_admin() or public.advertising_can_view_campaign(campaign_id));
drop policy if exists advertising_inventory_admin on public.advertising_inventory;
create policy advertising_inventory_admin on public.advertising_inventory
  for all using (public.is_admin()) with check (public.is_admin());

-- Promotional credits.
drop policy if exists advertising_credits_select on public.advertising_promotional_credits;
create policy advertising_credits_select on public.advertising_promotional_credits
  for select using (public.advertising_can_view_vendor(vendor_id));
drop policy if exists advertising_credits_admin on public.advertising_promotional_credits;
create policy advertising_credits_admin on public.advertising_promotional_credits
  for all using (public.is_admin()) with check (public.is_admin());

-- Notifications.
drop policy if exists advertising_notifications_select on public.advertising_notifications;
create policy advertising_notifications_select on public.advertising_notifications
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or (audience = 'vendor' and public.advertising_can_view_vendor(vendor_id))
  );
drop policy if exists advertising_notifications_update on public.advertising_notifications;
create policy advertising_notifications_update on public.advertising_notifications
  for update using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());
drop policy if exists advertising_notifications_admin on public.advertising_notifications;
create policy advertising_notifications_admin on public.advertising_notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- Audit: admin read only; rows are written by security-definer functions.
drop policy if exists advertising_audit_select on public.advertising_audit_logs;
create policy advertising_audit_select on public.advertising_audit_logs
  for select using (public.is_admin());
drop policy if exists advertising_audit_admin on public.advertising_audit_logs;
create policy advertising_audit_admin on public.advertising_audit_logs
  for all using (public.is_admin()) with check (public.is_admin());

-- Daily stats.
drop policy if exists advertising_stats_select on public.advertising_daily_stats;
create policy advertising_stats_select on public.advertising_daily_stats
  for select using (public.advertising_can_view_vendor(vendor_id));
drop policy if exists advertising_stats_admin on public.advertising_daily_stats;
create policy advertising_stats_admin on public.advertising_daily_stats
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 14. Grants
-- ---------------------------------------------------------------------------

grant select on public.advertising_placements to anon, authenticated;
grant select on public.advertising_rules to anon, authenticated;
grant select on public.advertising_pricing to authenticated;
grant select on public.advertising_campaigns to authenticated;
grant select on public.advertising_creatives to authenticated;
grant select on public.advertising_campaign_budgets to authenticated;
grant select on public.advertising_transactions to authenticated;
grant select on public.advertising_ledger_entries to authenticated;
grant select on public.advertising_impressions to authenticated;
grant select on public.advertising_clicks to authenticated;
grant select on public.advertising_conversions to authenticated;
grant select on public.advertising_approvals to authenticated;
grant select on public.advertising_inventory to authenticated;
grant select on public.advertising_promotional_credits to authenticated;
grant select, update on public.advertising_notifications to authenticated;
grant select on public.advertising_audit_logs to authenticated;
grant select on public.advertising_daily_stats to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 15. Seed: placements
-- ---------------------------------------------------------------------------

insert into public.advertising_placements
  (key, kind, name, name_ar, description, description_ar, format, supports_carousel,
   slot_count, max_active_campaigns, rotation_mode, auction_enabled, priority, sort_order,
   creative_width, creative_height, config)
values
  ('homepage_hero_carousel', 'homepage_hero_carousel', 'Homepage hero carousel',
   'كاروسيل الصفحة الرئيسية', 'The rotating sponsored banner at the top of the customer home screen.',
   'البانر الإعلاني الدوّار أعلى الشاشة الرئيسية للعميل.', 'carousel', true,
   0, 8, 'shared', true, 100, 10, 1200, 600,
   '{"auto_rotate_seconds": 6, "max_per_vendor": 1, "aspect_ratio": "2:1"}'::jsonb),
  ('homepage_featured_business', 'homepage_featured_business', 'Homepage featured business',
   'عمل تجاري مميز في الرئيسية', 'A sponsored business card in the featured businesses row.',
   'بطاقة عمل تجاري مدعومة ضمن صف الأعمال المميزة.', 'card', false,
   3, 3, 'fixed', false, 90, 20, 800, 600,
   '{"max_per_vendor": 1}'::jsonb),
  ('homepage_featured_gift_card', 'homepage_featured_gift_card', 'Homepage featured gift card',
   'بطاقة هدية مميزة في الرئيسية', 'A sponsored gift card in the home discovery feed.',
   'بطاقة هدية مدعومة في صفحة الاكتشاف الرئيسية.', 'card', false,
   0, 4, 'shared', true, 80, 30, 800, 600,
   '{"max_per_vendor": 2}'::jsonb),
  ('homepage_featured_category', 'homepage_featured_category', 'Homepage featured category',
   'فئة مميزة في الرئيسية', 'A sponsored category shortcut on the home screen.',
   'اختصار فئة مدعوم في الشاشة الرئيسية.', 'card', false,
   3, 3, 'fixed', false, 70, 40, 600, 400,
   '{"max_per_vendor": 1}'::jsonb),
  ('marketplace_sponsored_card', 'marketplace_sponsored_card', 'Marketplace sponsored card',
   'بطاقة مدعومة في السوق', 'A sponsored gift card inserted into marketplace listings.',
   'بطاقة هدية مدعومة تُدرج ضمن قوائم السوق.', 'native', false,
   0, 6, 'shared', true, 60, 50, 800, 600,
   '{"max_per_vendor": 2}'::jsonb),
  ('marketplace_sponsored_business', 'marketplace_sponsored_business', 'Marketplace sponsored business',
   'عمل تجاري مدعوم في السوق', 'A sponsored business in marketplace results.',
   'عمل تجاري مدعوم ضمن نتائج السوق.', 'card', false,
   0, 4, 'shared', true, 55, 60, 800, 600,
   '{"max_per_vendor": 1}'::jsonb),
  ('marketplace_category_position', 'marketplace_category_position', 'Marketplace category position',
   'موقع فئة في السوق', 'A fixed position inside a marketplace category.',
   'موقع ثابت داخل فئة في السوق.', 'card', false,
   3, 3, 'fixed', false, 50, 70, 600, 400,
   '{"max_per_vendor": 1}'::jsonb),
  ('search_sponsored_result', 'search_sponsored_result', 'Search sponsored result',
   'نتيجة بحث مدعومة', 'A sponsored result at the top of search.',
   'نتيجة مدعومة أعلى البحث.', 'native', false,
   0, 3, 'auction', true, 65, 80, 800, 400,
   '{"max_per_vendor": 1}'::jsonb),
  ('trending_placement', 'trending_placement', 'Trending placement',
   'موقع الرائج', 'A sponsored card inside trending.',
   'بطاقة مدعومة ضمن الرائج.', 'card', false,
   0, 3, 'shared', true, 45, 90, 600, 400,
   '{"max_per_vendor": 1}'::jsonb),
  ('discovery_placement', 'discovery_placement', 'Discovery placement',
   'موقع الاكتشاف', 'A sponsored card in the discovery feed.',
   'بطاقة مدعومة في صفحة الاكتشاف.', 'native', false,
   0, 4, 'shared', true, 40, 100, 600, 400,
   '{"max_per_vendor": 2}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 16. Seed: pricing (admin-editable defaults, never hardcoded in the apps)
-- ---------------------------------------------------------------------------

insert into public.advertising_pricing
  (placement_id, pricing_model, fixed_price_minor, cpc_rate_minor, cpm_rate_minor,
   min_duration_days, max_duration_days, default_duration_days, min_budget_minor,
   version, is_active)
select p.id, v.model, v.fixed, v.cpc, v.cpm, 1, 365, 30, v.min_budget, 1, true
from public.advertising_placements p
cross join (values
  ('homepage_hero_carousel'::text,        'fixed'::public.advertising_pricing_model, 150000::bigint,    0::bigint,     0::bigint,  50000::bigint),
  ('homepage_hero_carousel'::text,        'cpc'::public.advertising_pricing_model,        0::bigint,  250::bigint,     0::bigint,  50000::bigint),
  ('homepage_hero_carousel'::text,        'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint, 12000::bigint,  50000::bigint),
  ('homepage_featured_business'::text,    'fixed'::public.advertising_pricing_model, 100000::bigint,    0::bigint,     0::bigint,  30000::bigint),
  ('homepage_featured_business'::text,    'cpc'::public.advertising_pricing_model,        0::bigint,  200::bigint,     0::bigint,  30000::bigint),
  ('homepage_featured_business'::text,    'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  9000::bigint,  30000::bigint),
  ('homepage_featured_gift_card'::text,   'fixed'::public.advertising_pricing_model,  75000::bigint,    0::bigint,     0::bigint,  25000::bigint),
  ('homepage_featured_gift_card'::text,   'cpc'::public.advertising_pricing_model,        0::bigint,  150::bigint,     0::bigint,  25000::bigint),
  ('homepage_featured_gift_card'::text,   'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  7000::bigint,  25000::bigint),
  ('homepage_featured_category'::text,    'fixed'::public.advertising_pricing_model,  60000::bigint,    0::bigint,     0::bigint,  20000::bigint),
  ('homepage_featured_category'::text,    'cpc'::public.advertising_pricing_model,        0::bigint,  120::bigint,     0::bigint,  20000::bigint),
  ('homepage_featured_category'::text,    'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  6000::bigint,  20000::bigint),
  ('marketplace_sponsored_card'::text,    'fixed'::public.advertising_pricing_model,  50000::bigint,    0::bigint,     0::bigint,  15000::bigint),
  ('marketplace_sponsored_card'::text,    'cpc'::public.advertising_pricing_model,        0::bigint,  100::bigint,     0::bigint,  15000::bigint),
  ('marketplace_sponsored_card'::text,    'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  5000::bigint,  15000::bigint),
  ('marketplace_sponsored_business'::text,'fixed'::public.advertising_pricing_model,  80000::bigint,    0::bigint,     0::bigint,  25000::bigint),
  ('marketplace_sponsored_business'::text,'cpc'::public.advertising_pricing_model,        0::bigint,  180::bigint,     0::bigint,  25000::bigint),
  ('marketplace_sponsored_business'::text,'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  8000::bigint,  25000::bigint),
  ('marketplace_category_position'::text, 'fixed'::public.advertising_pricing_model,  40000::bigint,    0::bigint,     0::bigint,  12000::bigint),
  ('marketplace_category_position'::text, 'cpc'::public.advertising_pricing_model,        0::bigint,   90::bigint,     0::bigint,  12000::bigint),
  ('marketplace_category_position'::text, 'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  4500::bigint,  12000::bigint),
  ('search_sponsored_result'::text,       'fixed'::public.advertising_pricing_model,  45000::bigint,    0::bigint,     0::bigint,  15000::bigint),
  ('search_sponsored_result'::text,       'cpc'::public.advertising_pricing_model,        0::bigint,  120::bigint,     0::bigint,  15000::bigint),
  ('search_sponsored_result'::text,       'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  5000::bigint,  15000::bigint),
  ('trending_placement'::text,            'fixed'::public.advertising_pricing_model,  70000::bigint,    0::bigint,     0::bigint,  20000::bigint),
  ('trending_placement'::text,            'cpc'::public.advertising_pricing_model,        0::bigint,  160::bigint,     0::bigint,  20000::bigint),
  ('trending_placement'::text,            'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  6500::bigint,  20000::bigint),
  ('discovery_placement'::text,           'fixed'::public.advertising_pricing_model,  55000::bigint,    0::bigint,     0::bigint,  18000::bigint),
  ('discovery_placement'::text,           'cpc'::public.advertising_pricing_model,        0::bigint,  110::bigint,     0::bigint,  18000::bigint),
  ('discovery_placement'::text,           'cpm'::public.advertising_pricing_model,        0::bigint,    0::bigint,  5200::bigint,  18000::bigint)
) as v(key, model, fixed, cpc, cpm, min_budget)
where p.key = v.key
  and not exists (
    select 1 from public.advertising_pricing x
    where x.placement_id = p.id and x.pricing_model = v.model and x.is_active
  );

-- ---------------------------------------------------------------------------
-- 17. Seed: rules
-- ---------------------------------------------------------------------------

insert into public.advertising_rules (key, name, description, value, value_type)
values
  ('approval_required', 'Campaign approval required',
   'A paid campaign waits for admin approval before it can activate.',
   'true'::jsonb, 'boolean'),
  ('auto_activate_after_payment', 'Auto-activate after payment',
   'Activate or schedule automatically once payment and approval are complete.',
   'true'::jsonb, 'boolean'),
  ('payment_expiry_hours', 'Unpaid campaign expiry (hours)',
   'Cancel campaigns that remain unpaid for this many hours.',
   '48'::jsonb, 'integer'),
  ('max_active_campaigns_per_vendor', 'Maximum active campaigns per vendor',
   '0 means unlimited. Counts active and scheduled campaigns.',
   '10'::jsonb, 'integer'),
  ('max_active_campaigns_per_placement', 'Default placement capacity',
   'Fallback when a placement has no explicit max_active_campaigns.',
   '5'::jsonb, 'integer'),
  ('min_duration_days', 'Minimum campaign duration (days)',
   'Global floor applied on top of each pricing row.',
   '1'::jsonb, 'integer'),
  ('max_duration_days', 'Maximum campaign duration (days)',
   'Global ceiling applied on top of each pricing row.',
   '365'::jsonb, 'integer'),
  ('daily_budget_enforcement', 'Enforce daily budgets',
   'Pause a campaign when its daily budget is reached and resume next day.',
   'true'::jsonb, 'boolean'),
  ('auto_renew_default', 'Auto-renew default',
   'Default value for new campaigns. Vendors must explicitly authorise it.',
   'false'::jsonb, 'boolean'),
  ('attribution_window_minutes', 'Conversion attribution window (minutes)',
   'A conversion must happen within this window after a click.',
   '43200'::jsonb, 'integer'),
  ('frequency_cap_default_impressions', 'Default frequency cap',
   'Maximum impressions per viewer in the window. 0 disables the cap.',
   '3'::jsonb, 'integer'),
  ('frequency_cap_default_window_minutes', 'Default frequency window (minutes)',
   'Window used when a campaign does not override it.',
   '60'::jsonb, 'integer'),
  ('impression_dedupe_seconds', 'Impression dedupe (seconds)',
   'Minimum gap between counted impressions for the same viewer and campaign.',
   '30'::jsonb, 'integer'),
  ('click_dedupe_seconds', 'Click dedupe (seconds)',
   'Minimum gap between counted clicks for the same viewer and campaign.',
   '5'::jsonb, 'integer'),
  ('fair_rotation', 'Fair rotation',
   'Rotate shared inventory so no campaign dominates delivery.',
   'true'::jsonb, 'boolean'),
  ('auction_enabled', 'Auction ranking',
   'Rank shared inventory by bid rate after priority and fairness.',
   'true'::jsonb, 'boolean'),
  ('max_renewals', 'Maximum automatic renewals',
   'How many times a campaign may renew automatically.',
   '12'::jsonb, 'integer'),
  ('conversion_value_required', 'Require conversion value',
   'Reject conversions without a positive order value.',
   'false'::jsonb, 'boolean')
on conflict (key) do nothing;
