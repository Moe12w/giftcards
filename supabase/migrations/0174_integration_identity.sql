-- 0174_integration_identity.sql
--
-- Phase 3 of the external-platform integration: the identity layer.
--
-- Adds a platform registry, per-platform credentials, external vendor/branch
-- mappings, mapping history and the admin RPCs that manage them.
--
-- This migration is additive. It does not touch the gift-card engine.
--
-- Design notes:
--   * API keys are stored as SHA-256 hashes. The plaintext is shown once.
--   * HMAC signing secrets are encrypted at rest with a key held in
--     system_settings under 'integrations.signing_key', mirroring the existing
--     enterprise_code_key() pattern.
--   * A manually entered vendor id is never proof of ownership. Mappings start
--     as pending_verification and must be verified before activation.
--   * One external identity may belong to only one live business per platform.

-- ---------------------------------------------------------------------------
-- Platform registry
-- ---------------------------------------------------------------------------
create table if not exists public.integration_platforms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'retired')),
  capabilities jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integration_platforms is
  'External ordering/payment platforms. Capabilities are declared and separately verified; status is not a single generic "connected" flag.';

-- ---------------------------------------------------------------------------
-- Platform credentials
-- ---------------------------------------------------------------------------
create table if not exists public.integration_platform_credentials (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  label text not null,
  key_prefix text not null,
  key_hash text not null unique,
  signing_secret_ciphertext bytea,
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (platform_id, environment, label)
);

create index if not exists integration_credentials_platform_idx
  on public.integration_platform_credentials (platform_id, environment, status);

-- ---------------------------------------------------------------------------
-- External vendor / branch mappings
-- ---------------------------------------------------------------------------
create table if not exists public.integration_vendor_mappings (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.integration_platforms (id) on delete cascade,
  business_kind text not null default 'vendor' check (business_kind in ('vendor', 'partner')),
  vendor_id uuid references public.vendors (id) on delete cascade,
  partner_id uuid references public.enterprise_partners (id) on delete cascade,
  external_vendor_id text not null,
  external_vendor_name text,
  external_branch_id text not null default '',
  external_branch_name text,
  internal_location_id uuid references public.vendor_locations (id) on delete set null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'active', 'suspended', 'disconnected', 'rejected')),
  verification_method text
    check (verification_method in ('platform_api', 'platform_confirmation', 'documented_evidence', 'manual')),
  verification_evidence jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  suspended_at timestamptz,
  disconnected_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_mapping_one_business
    check (num_nonnulls(vendor_id, partner_id) = 1)
);

create unique index if not exists integration_mapping_identity_live
  on public.integration_vendor_mappings (platform_id, external_vendor_id, external_branch_id)
  where status not in ('disconnected', 'rejected');

create index if not exists integration_mapping_vendor_idx
  on public.integration_vendor_mappings (vendor_id, platform_id, status);
create index if not exists integration_mapping_platform_idx
  on public.integration_vendor_mappings (platform_id, status);

comment on table public.integration_vendor_mappings is
  'Verified relationship between a Tazella business and an external platform vendor/branch identifier. The external id is never accepted as proof of ownership on its own.';

-- ---------------------------------------------------------------------------
-- Mapping history (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.integration_mapping_events (
  id bigint generated always as identity primary key,
  mapping_id uuid not null references public.integration_vendor_mappings (id) on delete cascade,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists integration_mapping_events_mapping_idx
  on public.integration_mapping_events (mapping_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Request log (observability only; never financial authority)
-- ---------------------------------------------------------------------------
create table if not exists public.integration_request_log (
  id bigint generated always as identity primary key,
  platform_id uuid references public.integration_platforms (id) on delete set null,
  credential_id uuid references public.integration_platform_credentials (id) on delete set null,
  operation text not null,
  status_code integer,
  error_code text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists integration_request_log_platform_idx
  on public.integration_request_log (platform_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Key hashing / secret encryption helpers
-- ---------------------------------------------------------------------------
create or replace function public.integration_hash_key(p_key text)
returns text
language sql
immutable
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
$$;

create or replace function public.integration_signing_key()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select value ->> 'key' into v_key
  from public.system_settings
  where key = 'integrations.signing_key';

  if v_key is null or v_key = '' then
    raise exception 'integration signing key is not configured';
  end if;
  return v_key;
end;
$$;

create or replace function public.integration_encrypt_secret(p_secret text)
returns bytea
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select extensions.pgp_sym_encrypt(p_secret, public.integration_signing_key());
$$;

create or replace function public.integration_decrypt_secret(p_ciphertext bytea)
returns text
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select extensions.pgp_sym_decrypt(p_ciphertext, public.integration_signing_key());
$$;

revoke all on function public.integration_hash_key(text) from public, anon, authenticated;
revoke all on function public.integration_signing_key() from public, anon, authenticated;
revoke all on function public.integration_encrypt_secret(text) from public, anon, authenticated;
revoke all on function public.integration_decrypt_secret(bytea) from public, anon, authenticated;
grant execute on function public.integration_hash_key(text) to service_role;
grant execute on function public.integration_signing_key() to service_role;
grant execute on function public.integration_encrypt_secret(text) to service_role;
grant execute on function public.integration_decrypt_secret(bytea) to service_role;

-- ---------------------------------------------------------------------------
-- Credential authentication (gateway, service role only)
-- ---------------------------------------------------------------------------
create or replace function public.integration_authenticate(
  p_key_hash text,
  p_platform_code text,
  p_environment text
)
returns table (
  credential_id uuid,
  platform_id uuid,
  platform_code text,
  platform_name text,
  platform_status text,
  credential_status text,
  environment text,
  signing_secret text,
  capabilities jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cred public.integration_platform_credentials%rowtype;
  v_platform public.integration_platforms%rowtype;
begin
  if p_key_hash is null or p_key_hash = '' then
    return;
  end if;
  if p_environment not in ('sandbox', 'production') then
    return;
  end if;

  select * into v_cred
  from public.integration_platform_credentials
  where key_hash = p_key_hash
    and environment = p_environment
  limit 1;

  if v_cred.id is null then
    return;
  end if;

  select * into v_platform
  from public.integration_platforms
  where id = v_cred.platform_id
    and code = p_platform_code
  limit 1;

  if v_platform.id is null then
    return;
  end if;

  update public.integration_platform_credentials
  set last_used_at = now()
  where id = v_cred.id;

  return query
  select
    v_cred.id,
    v_platform.id,
    v_platform.code,
    v_platform.name,
    v_platform.status,
    v_cred.status,
    v_cred.environment,
    case
      when v_cred.signing_secret_ciphertext is null then null
      else public.integration_decrypt_secret(v_cred.signing_secret_ciphertext)
    end,
    v_platform.capabilities;
end;
$$;

revoke all on function public.integration_authenticate(text, text, text) from public, anon, authenticated;
grant execute on function public.integration_authenticate(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Mapping resolution (gateway, service role only)
--
-- Exact branch first, then a vendor-level mapping (external_branch_id = '').
-- Returns the row even when it is not active so the gateway can return a
-- precise error without leaking another business's identity.
-- ---------------------------------------------------------------------------
create or replace function public.integration_resolve_mapping(
  p_platform_id uuid,
  p_external_vendor_id text,
  p_external_branch_id text default ''
)
returns table (
  mapping_id uuid,
  vendor_id uuid,
  partner_id uuid,
  status text,
  external_vendor_id text,
  external_branch_id text,
  internal_location_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.vendor_id,
    m.partner_id,
    m.status,
    m.external_vendor_id,
    m.external_branch_id,
    m.internal_location_id
  from public.integration_vendor_mappings m
  where m.platform_id = p_platform_id
    and m.external_vendor_id = p_external_vendor_id
    and m.external_branch_id in (coalesce(p_external_branch_id, ''), '')
  order by
    (m.external_branch_id = coalesce(p_external_branch_id, '')) desc,
    (m.external_branch_id = '') asc
  limit 1;
$$;

revoke all on function public.integration_resolve_mapping(uuid, text, text) from public, anon, authenticated;
grant execute on function public.integration_resolve_mapping(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limiting (reuses the existing auth_attempts ledger)
-- ---------------------------------------------------------------------------
create or replace function public.integration_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.auth_attempts
    where identifier = p_key
      and created_at > now() - make_interval(secs => greatest(p_window_seconds, 60))
  ) >= greatest(p_max, 1) then
    raise exception 'too_many_requests';
  end if;

  insert into public.auth_attempts (identifier, success) values (p_key, true);
end;
$$;

revoke all on function public.integration_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.integration_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Admin RPCs: create a credential
-- ---------------------------------------------------------------------------
create or replace function public.integration_admin_create_credential(
  p_platform_code text,
  p_environment text,
  p_label text,
  p_key text,
  p_signing_secret text default null
)
returns table (credential_id uuid, key_prefix text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_platform uuid;
  v_id uuid;
  v_prefix text;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_environment not in ('sandbox', 'production') then
    raise exception 'invalid environment';
  end if;
  if p_key is null or length(p_key) < 24 then
    raise exception 'key too short';
  end if;

  select id into v_platform
  from public.integration_platforms
  where code = p_platform_code;

  if v_platform is null then
    raise exception 'platform not found';
  end if;

  v_prefix := left(p_key, 12);

  insert into public.integration_platform_credentials (
    platform_id, environment, label, key_prefix, key_hash,
    signing_secret_ciphertext, created_by
  )
  values (
    v_platform,
    p_environment,
    coalesce(nullif(trim(p_label), ''), 'default'),
    v_prefix,
    public.integration_hash_key(p_key),
    case
      when p_signing_secret is null or p_signing_secret = '' then null
      else public.integration_encrypt_secret(p_signing_secret)
    end,
    auth.uid()
  )
  returning id into v_id;

  perform public.write_audit(
    'integration_credential_created',
    'integration_platform_credentials',
    v_id::text,
    null,
    jsonb_build_object(
      'platform', p_platform_code,
      'environment', p_environment,
      'label', p_label,
      'key_prefix', v_prefix
    )
  );

  return query select v_id, v_prefix;
end;
$$;

create or replace function public.integration_admin_revoke_credential(p_credential_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  update public.integration_platform_credentials
  set status = 'revoked', revoked_at = now()
  where id = p_credential_id
    and status = 'active';

  perform public.write_audit(
    'integration_credential_revoked',
    'integration_platform_credentials',
    p_credential_id::text,
    null,
    null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs: mapping lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.integration_admin_create_mapping(
  p_platform_code text,
  p_vendor_id uuid,
  p_external_vendor_id text,
  p_external_branch_id text default '',
  p_internal_location_id uuid default null,
  p_verification_method text default 'manual',
  p_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform uuid;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_external_vendor_id is null or trim(p_external_vendor_id) = '' then
    raise exception 'external vendor id is required';
  end if;
  if p_verification_method not in ('platform_api', 'platform_confirmation', 'documented_evidence', 'manual') then
    raise exception 'invalid verification method';
  end if;

  select id into v_platform from public.integration_platforms where code = p_platform_code;
  if v_platform is null then
    raise exception 'platform not found';
  end if;

  if not exists (select 1 from public.vendors where id = p_vendor_id) then
    raise exception 'business not found';
  end if;

  if p_internal_location_id is not null and not exists (
    select 1 from public.vendor_locations
    where id = p_internal_location_id and vendor_id = p_vendor_id
  ) then
    raise exception 'branch does not belong to business';
  end if;

  insert into public.integration_vendor_mappings (
    platform_id, business_kind, vendor_id, external_vendor_id,
    external_branch_id, internal_location_id, status,
    verification_method, verification_evidence, created_by
  )
  values (
    v_platform, 'vendor', p_vendor_id, trim(p_external_vendor_id),
    coalesce(p_external_branch_id, ''), p_internal_location_id, 'pending_verification',
    p_verification_method, coalesce(p_evidence, '{}'::jsonb), auth.uid()
  )
  returning id into v_id;

  insert into public.integration_mapping_events (mapping_id, action, after_data, actor_user_id)
  values (v_id, 'created', to_jsonb((select m from public.integration_vendor_mappings m where m.id = v_id)), auth.uid());

  perform public.write_audit(
    'integration_mapping_created',
    'integration_vendor_mappings',
    v_id::text,
    null,
    jsonb_build_object(
      'platform', p_platform_code,
      'vendor_id', p_vendor_id,
      'external_vendor_id', p_external_vendor_id,
      'external_branch_id', coalesce(p_external_branch_id, '')
    )
  );

  return v_id;
end;
$$;

create or replace function public.integration_admin_verify_mapping(
  p_mapping_id uuid,
  p_evidence jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping public.integration_vendor_mappings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  select * into v_mapping
  from public.integration_vendor_mappings
  where id = p_mapping_id
  for update;

  if v_mapping.id is null then
    raise exception 'mapping not found';
  end if;
  if v_mapping.status not in ('pending_verification', 'verified') then
    raise exception 'mapping cannot be verified in its current state';
  end if;
  if coalesce(p_evidence, '{}'::jsonb) = '{}'::jsonb then
    raise exception 'verification evidence is required';
  end if;

  update public.integration_vendor_mappings
  set status = 'verified',
      verification_evidence = coalesce(p_evidence, '{}'::jsonb),
      verified_at = now(),
      verified_by = auth.uid(),
      updated_at = now()
  where id = p_mapping_id;

  insert into public.integration_mapping_events (mapping_id, action, before_data, after_data, actor_user_id)
  values (
    p_mapping_id,
    'verified',
    jsonb_build_object('status', v_mapping.status),
    jsonb_build_object('status', 'verified', 'evidence', p_evidence),
    auth.uid()
  );

  perform public.write_audit(
    'integration_mapping_verified',
    'integration_vendor_mappings',
    p_mapping_id::text,
    jsonb_build_object('status', v_mapping.status),
    jsonb_build_object('status', 'verified')
  );
end;
$$;

create or replace function public.integration_admin_set_mapping_status(
  p_mapping_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping public.integration_vendor_mappings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_status not in ('active', 'suspended', 'disconnected', 'rejected') then
    raise exception 'invalid status';
  end if;

  select * into v_mapping
  from public.integration_vendor_mappings
  where id = p_mapping_id
  for update;

  if v_mapping.id is null then
    raise exception 'mapping not found';
  end if;

  if p_status = 'active' and v_mapping.status not in ('verified', 'active', 'suspended') then
    raise exception 'mapping must be verified before activation';
  end if;

  update public.integration_vendor_mappings
  set status = p_status,
      activated_at = case when p_status = 'active' then now() else activated_at end,
      suspended_at = case when p_status = 'suspended' then now() else suspended_at end,
      disconnected_at = case when p_status = 'disconnected' then now() else disconnected_at end,
      updated_at = now()
  where id = p_mapping_id;

  insert into public.integration_mapping_events (mapping_id, action, before_data, after_data, actor_user_id)
  values (
    p_mapping_id,
    'status_changed',
    jsonb_build_object('status', v_mapping.status),
    jsonb_build_object('status', p_status, 'reason', p_reason),
    auth.uid()
  );

  perform public.write_audit(
    'integration_mapping_status_changed',
    'integration_vendor_mappings',
    p_mapping_id::text,
    jsonb_build_object('status', v_mapping.status),
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );
end;
$$;

revoke all on function public.integration_admin_create_credential(text, text, text, text, text) from public, anon;
revoke all on function public.integration_admin_revoke_credential(uuid) from public, anon;
revoke all on function public.integration_admin_create_mapping(text, uuid, text, text, uuid, text, jsonb) from public, anon;
revoke all on function public.integration_admin_verify_mapping(uuid, jsonb) from public, anon;
revoke all on function public.integration_admin_set_mapping_status(uuid, text, text) from public, anon;

grant execute on function public.integration_admin_create_credential(text, text, text, text, text) to authenticated;
grant execute on function public.integration_admin_revoke_credential(uuid) to authenticated;
grant execute on function public.integration_admin_create_mapping(text, uuid, text, text, uuid, text, jsonb) to authenticated;
grant execute on function public.integration_admin_verify_mapping(uuid, jsonb) to authenticated;
grant execute on function public.integration_admin_set_mapping_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.integration_platforms enable row level security;
alter table public.integration_platform_credentials enable row level security;
alter table public.integration_vendor_mappings enable row level security;
alter table public.integration_mapping_events enable row level security;
alter table public.integration_request_log enable row level security;

-- Platform names are public product information; config is non-secret.
drop policy if exists integration_platforms_select on public.integration_platforms;
create policy integration_platforms_select on public.integration_platforms
  for select to authenticated
  using (public.is_admin() or status = 'active');

drop policy if exists integration_platforms_admin_write on public.integration_platforms;
create policy integration_platforms_admin_write on public.integration_platforms
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Credentials are never readable by browser roles.
drop policy if exists integration_credentials_admin_select on public.integration_platform_credentials;
create policy integration_credentials_admin_select on public.integration_platform_credentials
  for select to authenticated
  using (public.is_admin());

-- Mappings: admins all; a vendor may read its own mappings.
drop policy if exists integration_mappings_select on public.integration_vendor_mappings;
create policy integration_mappings_select on public.integration_vendor_mappings
  for select to authenticated
  using (
    public.is_admin()
    or (vendor_id is not null and public.can_manage_vendor(vendor_id))
    or (partner_id is not null and public.can_manage_partner(partner_id))
  );

drop policy if exists integration_mappings_admin_write on public.integration_vendor_mappings;
create policy integration_mappings_admin_write on public.integration_vendor_mappings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists integration_mapping_events_select on public.integration_mapping_events;
create policy integration_mapping_events_select on public.integration_mapping_events
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.integration_vendor_mappings m
      where m.id = integration_mapping_events.mapping_id
        and m.vendor_id is not null
        and public.can_manage_vendor(m.vendor_id)
    )
  );

drop policy if exists integration_request_log_admin_select on public.integration_request_log;
create policy integration_request_log_admin_select on public.integration_request_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed platform rows. They stay draft until a real, verified integration exists.
-- ---------------------------------------------------------------------------
insert into public.integration_platforms (code, name, status, capabilities, config)
values
  (
    'mock',
    'Mock ordering platform',
    'draft',
    jsonb_build_object(
      'vendor_identification', jsonb_build_object('supported', true,  'verified', true),
      'order_api',             jsonb_build_object('supported', true,  'verified', true),
      'checkout_extension',    jsonb_build_object('supported', true,  'verified', true),
      'partial_payment',       jsonb_build_object('supported', true,  'verified', true),
      'reservation',           jsonb_build_object('supported', true,  'verified', true),
      'capture_confirmation',  jsonb_build_object('supported', true,  'verified', true),
      'cancellation_events',   jsonb_build_object('supported', true,  'verified', true),
      'refund_events',         jsonb_build_object('supported', true,  'verified', true)
    ),
    jsonb_build_object('checkout_mode', 'embedded_sdk', 'ttl_seconds', 600)
  ),
  (
    'snoonu',
    'Snoonu',
    'draft',
    jsonb_build_object(
      'vendor_identification', jsonb_build_object('supported', false, 'verified', false),
      'order_api',             jsonb_build_object('supported', false, 'verified', false),
      'checkout_extension',    jsonb_build_object('supported', false, 'verified', false),
      'partial_payment',       jsonb_build_object('supported', false, 'verified', false),
      'reservation',           jsonb_build_object('supported', false, 'verified', false),
      'capture_confirmation',  jsonb_build_object('supported', false, 'verified', false),
      'cancellation_events',   jsonb_build_object('supported', false, 'verified', false),
      'refund_events',         jsonb_build_object('supported', false, 'verified', false)
    ),
    '{}'::jsonb
  ),
  (
    'talabat',
    'Talabat',
    'draft',
    jsonb_build_object(
      'vendor_identification', jsonb_build_object('supported', false, 'verified', false),
      'order_api',             jsonb_build_object('supported', false, 'verified', false),
      'checkout_extension',    jsonb_build_object('supported', false, 'verified', false),
      'partial_payment',       jsonb_build_object('supported', false, 'verified', false),
      'reservation',           jsonb_build_object('supported', false, 'verified', false),
      'capture_confirmation',  jsonb_build_object('supported', false, 'verified', false),
      'cancellation_events',   jsonb_build_object('supported', false, 'verified', false),
      'refund_events',         jsonb_build_object('supported', false, 'verified', false)
    ),
    '{}'::jsonb
  ),
  (
    'keeta',
    'Keeta',
    'draft',
    jsonb_build_object(
      'vendor_identification', jsonb_build_object('supported', false, 'verified', false),
      'order_api',             jsonb_build_object('supported', false, 'verified', false),
      'checkout_extension',    jsonb_build_object('supported', false, 'verified', false),
      'partial_payment',       jsonb_build_object('supported', false, 'verified', false),
      'reservation',           jsonb_build_object('supported', false, 'verified', false),
      'capture_confirmation',  jsonb_build_object('supported', false, 'verified', false),
      'cancellation_events',   jsonb_build_object('supported', false, 'verified', false),
      'refund_events',         jsonb_build_object('supported', false, 'verified', false)
    ),
    '{}'::jsonb
  )
on conflict (code) do nothing;
