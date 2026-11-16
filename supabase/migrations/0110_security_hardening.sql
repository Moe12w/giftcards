-- 0110_security_hardening.sql
--
-- Defence in depth for the database:
--   1. Pin search_path on every SECURITY DEFINER function so a caller cannot
--      influence name resolution inside the function body.
--   2. Add a server-side login-attempt ledger used by the dashboards and the
--      auth-gate Edge Function to throttle password sign-in.
--   3. Keep the ledger out of reach of anon/authenticated clients: RLS is
--      enabled with no policies, so only the service role can read or write it.

-- ---------------------------------------------------------------------------
-- 1. search_path for SECURITY DEFINER functions
-- ---------------------------------------------------------------------------
-- Supabase's own linter flags SECURITY DEFINER functions without an explicit
-- search_path. These functions all reference public.* qualified names, so
-- pinning the path changes no behaviour; it removes the ability for a caller
-- to shadow a relation or function used inside them.

alter function public.admin_issue_manual_voucher(uuid, bigint, text, text, text, timestamptz, text) set search_path = public;
alter function public.admin_rotate_claim_token(uuid) set search_path = public;
alter function public.admin_set_bulk_order_status(uuid, public.bulk_order_status, text) set search_path = public;
alter function public.admin_set_business_account_status(uuid, public.business_account_status, text) set search_path = public;
alter function public.admin_set_vendor_status(uuid, public.vendor_status, text) set search_path = public;
alter function public.advertising_activation_ready(uuid) set search_path = public;
alter function public.advertising_admin_run_maintenance() set search_path = public;
alter function public.advertising_campaign_is_eligible(uuid) set search_path = public;
alter function public.advertising_can_view_campaign(uuid) set search_path = public;
alter function public.advertising_can_view_vendor(uuid) set search_path = public;
alter function public.advertising_copy_campaign(uuid, boolean) set search_path = public;
alter function public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb) set search_path = public;
alter function public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, integer, jsonb) set search_path = public;
alter function public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, integer, jsonb, integer) set search_path = public;
alter function public.advertising_deliver(text, integer, text, text, jsonb) set search_path = public;
alter function public.advertising_pay_with_credit(uuid) set search_path = public;
alter function public.advertising_resume_campaign(uuid) set search_path = public;
alter function public.advertising_run_maintenance() set search_path = public;
alter function public.advertising_slot_map() set search_path = public;
alter function public.advertising_stats_conversion() set search_path = public;
alter function public.advertising_sync_category_placement() set search_path = public;
alter function public.advertising_update_campaign(uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb) set search_path = public;
alter function public.audit_count_for(text, uuid) set search_path = public;
alter function public.bulk_registration_requires_approval() set search_path = public;
alter function public.buyer_claim_link(uuid) set search_path = public;
alter function public.buyer_owns_order(uuid) set search_path = public;
alter function public.can_access_bulk_buying() set search_path = public;
alter function public.claim_voucher(text) set search_path = public;
alter function public.delete_my_account() set search_path = public;
alter function public.deliver_scheduled_gifts(integer) set search_path = public;
alter function public.get_basket_by_code(text) set search_path = public;
alter function public.guard_profile_admin() set search_path = public;
alter function public.import_enterprise_redemptions(uuid, jsonb) set search_path = public;
alter function public.mcp_take_rate_limit(text, integer, integer) set search_path = public;
alter function public.notify_on_support_reply() set search_path = public;
alter function public.notify_on_voucher_expiry() set search_path = public;
alter function public.record_admin_action(text, text, uuid, jsonb) set search_path = public;
alter function public.report_enterprise_code_usage(uuid, text) set search_path = public;
alter function public.sync_product_partner() set search_path = public;
alter function public.validate_promo_code(text, bigint) set search_path = public;
alter function public.vendor_outstanding_minor(uuid) set search_path = public;
alter function public.write_audit(text, text, text, jsonb, jsonb) set search_path = public;

-- ---------------------------------------------------------------------------
-- 2. Login attempt ledger
-- ---------------------------------------------------------------------------
-- One row per attempt. `identifier` is the normalised e-mail address, or
-- `ip:<address>` when the caller wants to throttle a network instead.
-- Clients never read or write this table directly.

create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists auth_attempts_identifier_created_idx
  on public.auth_attempts (identifier, created_at desc);

create index if not exists auth_attempts_created_idx
  on public.auth_attempts (created_at desc);

alter table public.auth_attempts enable row level security;

-- No policies: the service role bypasses RLS, anon/authenticated are denied.

create or replace function public.record_auth_attempt(p_identifier text, p_success boolean default false)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.auth_attempts (identifier, success)
  values (lower(trim(coalesce(p_identifier, ''))), coalesce(p_success, false));
$$;

create or replace function public.clear_auth_attempts(p_identifier text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_attempts
  where identifier = lower(trim(coalesce(p_identifier, '')));
$$;

create or replace function public.auth_attempts_exceeded(
  p_identifier text,
  p_window_seconds integer default 900,
  p_max_failed integer default 8
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) >= greatest(p_max_failed, 0)
  from public.auth_attempts
  where identifier = lower(trim(coalesce(p_identifier, '')))
    and success = false
    and created_at > now() - make_interval(secs => greatest(coalesce(p_window_seconds, 900), 60));
$$;

-- Only the service role (Edge Functions, server actions using the admin client)
-- may read the ledger or write to it.
revoke all on function public.record_auth_attempt(text, boolean) from public;
revoke all on function public.record_auth_attempt(text, boolean) from anon;
revoke all on function public.record_auth_attempt(text, boolean) from authenticated;
revoke all on function public.clear_auth_attempts(text) from public;
revoke all on function public.clear_auth_attempts(text) from anon;
revoke all on function public.clear_auth_attempts(text) from authenticated;
revoke all on function public.auth_attempts_exceeded(text, integer, integer) from public;
revoke all on function public.auth_attempts_exceeded(text, integer, integer) from anon;
revoke all on function public.auth_attempts_exceeded(text, integer, integer) from authenticated;

grant execute on function public.record_auth_attempt(text, boolean) to service_role;
grant execute on function public.clear_auth_attempts(text) to service_role;
grant execute on function public.auth_attempts_exceeded(text, integer, integer) to service_role;
