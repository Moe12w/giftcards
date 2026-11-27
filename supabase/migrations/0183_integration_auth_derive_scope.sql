-- 0183_integration_auth_derive_scope.sql
--
-- A credential key is unique and already records its platform and environment.
-- Requiring the caller to repeat X-Platform-Code / X-Environment added no
-- security and forced vendors to understand internal identifiers. Those
-- headers are now optional: when omitted, the credential's own values are used.
-- Supplying a mismatching header is still rejected.

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
#variable_conflict use_column
declare
  v_cred public.integration_platform_credentials%rowtype;
  v_platform public.integration_platforms%rowtype;
begin
  if p_key_hash is null or p_key_hash = '' then
    return;
  end if;

  if p_environment is not null and p_environment not in ('sandbox', 'production') then
    return;
  end if;

  select c.* into v_cred
  from public.integration_platform_credentials c
  where c.key_hash = p_key_hash
    and (p_environment is null or c.environment = p_environment)
  limit 1;

  if v_cred.id is null then
    return;
  end if;

  select p.* into v_platform
  from public.integration_platforms p
  where p.id = v_cred.platform_id
    and (p_platform_code is null or p.code = p_platform_code)
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
