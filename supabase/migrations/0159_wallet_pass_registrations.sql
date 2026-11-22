-- 0159_wallet_pass_registrations.sql
-- Apple Wallet pass web service state.
--
-- Wallet calls back to the `wallet-pass` Edge Function with a device library
-- identifier and the push token it wants updates on. Nothing else about a pass
-- is stored: the pass content is rebuilt from the voucher row on every request,
-- and the per-pass authentication token is derived from the voucher id with the
-- server secret, so there is no token table to drift out of sync.
--
-- Google Wallet needs no local state; its object id is derived the same way.
--
-- Both tables are service-role only: the pass service runs with the service
-- role, and no browser or app client has any business reading device tokens.

create table if not exists public.wallet_pass_registrations (
  device_library_id text not null,
  pass_type_id text not null,
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  push_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device_library_id, voucher_id)
);

create index if not exists wallet_pass_registrations_voucher_idx
  on public.wallet_pass_registrations (voucher_id);

comment on table public.wallet_pass_registrations is
  'Devices registered with the Apple Wallet pass web service, one row per pass per device.';

alter table public.wallet_pass_registrations enable row level security;

revoke all on public.wallet_pass_registrations from anon, authenticated;
grant all on public.wallet_pass_registrations to service_role;
