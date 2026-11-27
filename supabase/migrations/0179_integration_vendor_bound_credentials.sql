-- 0179_integration_vendor_bound_credentials.sql
--
-- WordPress/WooCommerce sites are independent vendors. A platform-scoped key
-- can currently send any verified external_vendor_id, which is not a closed
-- loop. This migration binds a credential to one verified mapping.
--
-- Platform-level credentials (Snoonu/Talabat/Keeta) keep mapping_id null and
-- continue to resolve the business from the signed request.

alter table public.integration_platform_credentials
  add column if not exists mapping_id uuid
    references public.integration_vendor_mappings (id) on delete set null;

create index if not exists integration_credentials_mapping_idx
  on public.integration_platform_credentials (mapping_id)
  where mapping_id is not null;

-- ---------------------------------------------------------------------------
-- Authenticate: expose the credential's bound mapping to the gateway
-- ---------------------------------------------------------------------------
-- The OUT-parameter row type changed, so CREATE OR REPLACE is not enough.
drop function if exists public.integration_authenticate(text, text, text);

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
  capabilities jsonb,
  mapping_id uuid
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

  select c.* into v_cred
  from public.integration_platform_credentials c
  where c.key_hash = p_key_hash
    and c.environment = p_environment
  limit 1;

  if v_cred.id is null then
    return;
  end if;

  select p.* into v_platform
  from public.integration_platforms p
  where p.id = v_cred.platform_id
    and p.code = p_platform_code
  limit 1;

  if v_platform.id is null then
    return;
  end if;

  update public.integration_platform_credentials c
  set last_used_at = now()
  where c.id = v_cred.id;

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
    v_platform.capabilities,
    v_cred.mapping_id;
end;
$$;

revoke all on function public.integration_authenticate(text, text, text) from public, anon, authenticated;
grant execute on function public.integration_authenticate(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Admin RPC: issue a credential bound to one verified mapping
-- ---------------------------------------------------------------------------
create or replace function public.integration_admin_create_vendor_credential(
  p_mapping_id uuid,
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
  v_mapping public.integration_vendor_mappings%rowtype;
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

  select * into v_mapping
  from public.integration_vendor_mappings
  where id = p_mapping_id;

  if v_mapping.id is null then
    raise exception 'mapping not found';
  end if;
  if v_mapping.status <> 'active' then
    raise exception 'mapping must be active before issuing a credential';
  end if;

  v_prefix := left(p_key, 12);

  insert into public.integration_platform_credentials (
    platform_id, environment, label, key_prefix, key_hash,
    signing_secret_ciphertext, mapping_id, created_by
  )
  values (
    v_mapping.platform_id,
    p_environment,
    coalesce(nullif(trim(p_label), ''), 'vendor-default'),
    v_prefix,
    public.integration_hash_key(p_key),
    case
      when p_signing_secret is null or p_signing_secret = '' then null
      else public.integration_encrypt_secret(p_signing_secret)
    end,
    v_mapping.id,
    auth.uid()
  )
  returning id into v_id;

  perform public.write_audit(
    'integration_vendor_credential_created',
    'integration_platform_credentials',
    v_id::text,
    null,
    jsonb_build_object(
      'mapping_id', p_mapping_id,
      'platform_id', v_mapping.platform_id,
      'vendor_id', v_mapping.vendor_id,
      'environment', p_environment,
      'label', p_label,
      'key_prefix', v_prefix
    )
  );

  return query select v_id, v_prefix;
end;
$$;

revoke all on function public.integration_admin_create_vendor_credential(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.integration_admin_create_vendor_credential(uuid, text, text, text, text)
  to authenticated;
