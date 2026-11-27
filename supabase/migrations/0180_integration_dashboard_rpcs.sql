-- 0180_integration_dashboard_rpcs.sql
--
-- Safe RPCs for the vendor self-service and admin integration dashboards.
-- Browser roles never select key_hash or signing_secret_ciphertext directly.

-- ---------------------------------------------------------------------------
-- Vendor self-service: issue a credential bound to one verified mapping
-- ---------------------------------------------------------------------------
create or replace function public.integration_vendor_issue_credential(
  p_mapping_id uuid,
  p_environment text,
  p_label text,
  p_key text,
  p_signing_secret text
)
returns table (credential_id uuid, key_prefix text)
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_mapping public.integration_vendor_mappings%rowtype;
  v_platform public.integration_platforms%rowtype;
  v_id uuid;
  v_prefix text;
begin
  if p_environment not in ('sandbox', 'production') then
    raise exception 'invalid environment';
  end if;
  if p_key is null or length(p_key) < 24 then
    raise exception 'key too short';
  end if;
  if p_signing_secret is null or length(p_signing_secret) < 24 then
    raise exception 'signing secret too short';
  end if;

  select m.* into v_mapping
  from public.integration_vendor_mappings m
  where m.id = p_mapping_id;

  if v_mapping.id is null then
    raise exception 'mapping not found';
  end if;
  if v_mapping.vendor_id is null then
    raise exception 'mapping is not a vendor mapping';
  end if;
  if not public.can_manage_vendor(v_mapping.vendor_id) then
    raise exception 'not allowed';
  end if;
  if v_mapping.status <> 'active' then
    raise exception 'mapping must be active before issuing a key';
  end if;

  select p.* into v_platform
  from public.integration_platforms p
  where p.id = v_mapping.platform_id;

  if v_platform.id is null or v_platform.status <> 'active' then
    raise exception 'platform not active';
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
    public.integration_encrypt_secret(p_signing_secret),
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
      'vendor_id', v_mapping.vendor_id,
      'environment', p_environment,
      'key_prefix', v_prefix
    )
  );

  return query select v_id, v_prefix;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vendor self-service: revoke a credential belonging to their mapping(s)
-- ---------------------------------------------------------------------------
create or replace function public.integration_vendor_revoke_credential(p_credential_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_mapping_id uuid;
  v_vendor_id uuid;
begin
  select c.mapping_id into v_mapping_id
  from public.integration_platform_credentials c
  where c.id = p_credential_id;

  if v_mapping_id is null then
    raise exception 'credential not found';
  end if;

  select m.vendor_id into v_vendor_id
  from public.integration_vendor_mappings m
  where m.id = v_mapping_id;

  if v_vendor_id is null or not public.can_manage_vendor(v_vendor_id) then
    raise exception 'not allowed';
  end if;

  update public.integration_platform_credentials c
  set status = 'revoked', revoked_at = now()
  where c.id = p_credential_id
    and c.status = 'active';

  perform public.write_audit(
    'integration_vendor_credential_revoked',
    'integration_platform_credentials',
    p_credential_id::text,
    null,
    null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Vendor self-service: safe credential list (no secrets)
-- ---------------------------------------------------------------------------
create or replace function public.integration_vendor_list_credentials(p_vendor_id uuid)
returns table (
  credential_id uuid,
  mapping_id uuid,
  platform_code text,
  environment text,
  label text,
  key_prefix text,
  status text,
  last_used_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if p_vendor_id is null or not public.can_manage_vendor(p_vendor_id) then
    raise exception 'not allowed';
  end if;

  return query
  select
    c.id,
    c.mapping_id,
    p.code,
    c.environment,
    c.label,
    c.key_prefix,
    c.status,
    c.last_used_at,
    c.created_at
  from public.integration_platform_credentials c
  join public.integration_platforms p on p.id = c.platform_id
  join public.integration_vendor_mappings m on m.id = c.mapping_id
  where m.vendor_id = p_vendor_id
  order by c.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: safe credential list across all mappings
-- ---------------------------------------------------------------------------
create or replace function public.integration_admin_list_credentials()
returns table (
  credential_id uuid,
  mapping_id uuid,
  platform_code text,
  environment text,
  label text,
  key_prefix text,
  status text,
  last_used_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  return query
  select
    c.id,
    c.mapping_id,
    p.code,
    c.environment,
    c.label,
    c.key_prefix,
    c.status,
    c.last_used_at,
    c.created_at
  from public.integration_platform_credentials c
  join public.integration_platforms p on p.id = c.platform_id
  left join public.integration_vendor_mappings m on m.id = c.mapping_id
  order by c.created_at desc;
end;
$$;

revoke all on function public.integration_vendor_issue_credential(uuid, text, text, text, text) from public, anon;
revoke all on function public.integration_vendor_revoke_credential(uuid) from public, anon;
revoke all on function public.integration_vendor_list_credentials(uuid) from public, anon;
revoke all on function public.integration_admin_list_credentials() from public, anon;

grant execute on function public.integration_vendor_issue_credential(uuid, text, text, text, text) to authenticated;
grant execute on function public.integration_vendor_revoke_credential(uuid) to authenticated;
grant execute on function public.integration_vendor_list_credentials(uuid) to authenticated;
grant execute on function public.integration_admin_list_credentials() to authenticated;
