-- 0182_integration_admin_actions.sql
--
-- Admin actions needed to operate the integration network: resolve
-- reconciliation cases and change platform status. Mapping verification and
-- status changes already exist in 0174.

create or replace function public.integration_admin_resolve_case(
  p_case_id uuid,
  p_resolution text,
  p_evidence jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_case public.integration_reconciliation_cases%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_resolution not in ('resolved_captured', 'resolved_released', 'resolved_refunded', 'ignored') then
    raise exception 'invalid resolution';
  end if;

  select c.* into v_case
  from public.integration_reconciliation_cases c
  where c.id = p_case_id
  for update;

  if v_case.id is null then
    raise exception 'case not found';
  end if;
  if v_case.status <> 'open' then
    raise exception 'case is already resolved';
  end if;

  update public.integration_reconciliation_cases c
  set status = p_resolution,
      evidence = coalesce(c.evidence, '{}'::jsonb) || coalesce(p_evidence, '{}'::jsonb),
      resolved_by = auth.uid(),
      resolved_at = now()
  where c.id = p_case_id;

  perform public.write_audit(
    'integration_reconciliation_resolved',
    'integration_reconciliation_cases',
    p_case_id::text,
    jsonb_build_object('status', v_case.status, 'reason', v_case.reason),
    jsonb_build_object('status', p_resolution, 'evidence', p_evidence)
  );
end;
$$;

create or replace function public.integration_admin_set_platform_status(
  p_platform_code text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_platform public.integration_platforms%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_status not in ('draft', 'active', 'suspended', 'retired') then
    raise exception 'invalid status';
  end if;

  select p.* into v_platform
  from public.integration_platforms p
  where p.code = p_platform_code
  for update;

  if v_platform.id is null then
    raise exception 'platform not found';
  end if;

  update public.integration_platforms p
  set status = p_status, updated_at = now()
  where p.id = v_platform.id;

  perform public.write_audit(
    'integration_platform_status_changed',
    'integration_platforms',
    v_platform.id::text,
    jsonb_build_object('status', v_platform.status),
    jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.integration_admin_resolve_case(uuid, text, jsonb) from public, anon;
revoke all on function public.integration_admin_set_platform_status(text, text) from public, anon;
grant execute on function public.integration_admin_resolve_case(uuid, text, jsonb) to authenticated;
grant execute on function public.integration_admin_set_platform_status(text, text) to authenticated;
