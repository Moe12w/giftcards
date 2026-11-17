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
--
-- The list is derived from the catalogue at apply time rather than hard-coded,
-- so a signature drift in an earlier migration cannot break this one.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}')) as c
        where c like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = public', r.signature);
  end loop;
end $$;

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
