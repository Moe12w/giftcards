-- 0176_integration_authenticate_fix.sql
--
-- 0174 declared an OUT parameter named `environment`, which shadows the
-- integration_platform_credentials.environment column inside the function body.
-- Postgres rejects the unqualified reference with SQLSTATE 42702. Qualify the
-- credential columns through an alias and re-apply the grants.

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
    v_platform.capabilities;
end;
$$;

revoke all on function public.integration_authenticate(text, text, text) from public, anon, authenticated;
grant execute on function public.integration_authenticate(text, text, text) to service_role;
