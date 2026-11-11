-- 0027_customer_settings.sql
-- The remaining customer owned data: addresses, preferences, support requests
-- and the promo codes used at checkout.

-- ---------------------------------------------------------------------------
-- Saved addresses
-- ---------------------------------------------------------------------------
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  line1 text not null,
  city text not null,
  postcode text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_customer_idx
  on public.customer_addresses (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Preferences (dark mode, biometrics, privacy)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dark_mode boolean not null default false,
  biometrics boolean not null default false,
  privacy_analytics boolean not null default true,
  privacy_personalised boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Support requests
-- ---------------------------------------------------------------------------
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('contact', 'report', 'report_gift', 'refund', 'chat')),
  subject text,
  body text not null,
  reference text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists support_requests_customer_idx
  on public.support_requests (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Promo codes
-- ---------------------------------------------------------------------------
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null default 'percent' check (kind in ('percent', 'fixed')),
  value bigint not null check (value > 0),
  min_subtotal_minor bigint not null default 0 check (min_subtotal_minor >= 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.validate_promo_code(
  p_code text,
  p_subtotal_minor bigint
)
returns table (
  code text,
  discount_minor bigint,
  message text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_discount bigint;
begin
  select * into v_promo
  from public.promo_codes
  where upper(code) = upper(trim(p_code)) and active
  limit 1;

  if not found then
    return query select null::text, 0::bigint, 'promoInvalid'::text;
    return;
  end if;

  if v_promo.starts_at is not null and v_promo.starts_at > now() then
    return query select v_promo.code, 0::bigint, 'promoNotStarted'::text;
    return;
  end if;

  if v_promo.ends_at is not null and v_promo.ends_at < now() then
    return query select v_promo.code, 0::bigint, 'promoExpired'::text;
    return;
  end if;

  if v_promo.max_redemptions is not null and v_promo.redeemed_count >= v_promo.max_redemptions then
    return query select v_promo.code, 0::bigint, 'promoUsedUp'::text;
    return;
  end if;

  if p_subtotal_minor < v_promo.min_subtotal_minor then
    return query select v_promo.code, 0::bigint, 'promoMinimum'::text;
    return;
  end if;

  v_discount := case
    when v_promo.kind = 'percent' then round(p_subtotal_minor * v_promo.value / 100)
    else v_promo.value
  end;
  v_discount := least(v_discount, p_subtotal_minor);

  return query select v_promo.code, v_discount, 'promoApplied'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.customer_addresses enable row level security;

drop policy if exists customer_addresses_own on public.customer_addresses;
create policy customer_addresses_own on public.customer_addresses
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

alter table public.customer_preferences enable row level security;

drop policy if exists customer_preferences_own on public.customer_preferences;
create policy customer_preferences_own on public.customer_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.support_requests enable row level security;

drop policy if exists support_requests_select on public.support_requests;
create policy support_requests_select on public.support_requests
  for select using (customer_id = auth.uid() or public.is_admin());

drop policy if exists support_requests_insert on public.support_requests;
create policy support_requests_insert on public.support_requests
  for insert with check (customer_id = auth.uid() or customer_id is null);

alter table public.promo_codes enable row level security;

drop policy if exists promo_codes_select on public.promo_codes;
create policy promo_codes_select on public.promo_codes
  for select using (active or public.is_admin());

revoke all on function public.validate_promo_code(text, bigint) from public;
grant execute on function public.validate_promo_code(text, bigint) to authenticated;
